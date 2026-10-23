import { pool } from '../config/db.js';
import { generateQuizQuestions, evaluateTheoreticalAnswer } from '../services/geminiService.js';

/**
 * Generate a new quiz from notes using Gemini AI
 * POST /api/quizzes/generate
 */
export async function generateQuiz(req, res) {
  const userId = req.user.id;
  const { note_id, difficulty = 'Medium', quiz_type = 'mcq', count = 5 } = req.body;

  // Validate inputs
  if (!note_id) {
    return res.status(400).json({ success: false, message: 'Note ID is required.' });
  }

  const validDifficulties = ['Easy', 'Medium', 'Hard'];
  if (!validDifficulties.includes(difficulty)) {
    return res.status(400).json({
      success: false,
      message: `Invalid difficulty "${difficulty}". Must be Easy, Medium, or Hard.`
    });
  }

  const validTypes = ['mcq', 'theoretical', 'mixed'];
  const safeType = validTypes.includes(quiz_type) ? quiz_type : 'mcq';

  const questionCount = parseInt(count, 10);
  if (isNaN(questionCount) || questionCount < 3 || questionCount > 20) {
    return res.status(400).json({
      success: false,
      message: 'Question count must be an integer between 3 and 20.'
    });
  }

  // Fetch the note and verify ownership
  const [noteRows] = await pool.query(
    'SELECT id, title, extracted_text FROM notes WHERE id = ? AND user_id = ?',
    [note_id, userId]
  );

  if (noteRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Note not found or access denied.'
    });
  }

  const note = noteRows[0];

  try {
    // 1. Generate questions using Gemini with structured schema
    const generatedQuestions = await generateQuizQuestions({
      noteContent: note.extracted_text,
      difficulty,
      quizType: safeType,
      count: questionCount
    });

    if (!generatedQuestions || generatedQuestions.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'AI failed to generate valid quiz questions from the note.'
      });
    }

    // 2. ATOMIC SQL TRANSACTION: Save Quiz and Questions
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Insert Quiz
      const [quizResult] = await connection.query(
        'INSERT INTO quizzes (note_id, difficulty, quiz_type, total_questions) VALUES (?, ?, ?, ?)',
        [note.id, difficulty, safeType, generatedQuestions.length]
      );

      const quizId = quizResult.insertId;

      // Prepare bulk insertion values for questions
      const questionValues = generatedQuestions.map((q) => [
        quizId,
        q.question_type || (safeType === 'theoretical' ? 'theoretical' : 'mcq'),
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_option,
        q.ideal_answer || '',
        q.key_points || '',
        q.explanation || ''
      ]);

      await connection.query(
        `INSERT INTO questions 
          (quiz_id, question_type, question_text, option_a, option_b, option_c, option_d, correct_option, ideal_answer, key_points, explanation) 
         VALUES ?`,
        [questionValues]
      );

      // Commit transaction
      await connection.commit();

      return res.status(201).json({
        success: true,
        message: 'Quiz generated and saved successfully.',
        quiz: {
          id: quizId,
          note_id: note.id,
          note_title: note.title,
          difficulty,
          quiz_type: safeType,
          total_questions: generatedQuestions.length,
          created_at: new Date()
        }
      });
    } catch (transactionError) {
      await connection.rollback();
      console.error('Transaction Rolled Back on Quiz Creation:', transactionError);
      throw transactionError;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Quiz Generation Route Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate quiz questions.'
    });
  }
}

/**
 * Get Quiz by ID for Exam Mode
 * Strictly EXCLUDES correct_option, explanation, and ideal_answer to prevent cheating!
 * GET /api/quizzes/:quizId
 */
export async function getQuizById(req, res) {
  try {
    const userId = req.user.id;
    const quizId = req.params.quizId;

    // Verify quiz exists and user owns the linked note
    const [quizRows] = await pool.query(
      `SELECT q.id, q.note_id, q.difficulty, q.quiz_type, q.total_questions, q.created_at, n.title AS note_title
       FROM quizzes q
       JOIN notes n ON q.note_id = n.id
       WHERE q.id = ? AND n.user_id = ?`,
      [quizId, userId]
    );

    if (quizRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or unauthorized.'
      });
    }

    const quiz = quizRows[0];

    // Fetch questions EXCLUDING solutions
    const [questions] = await pool.query(
      `SELECT id, quiz_id, question_type, question_text, option_a, option_b, option_c, option_d
       FROM questions
       WHERE quiz_id = ?
       ORDER BY id ASC`,
      [quizId]
    );

    return res.status(200).json({
      success: true,
      quiz: {
        id: quiz.id,
        note_id: quiz.note_id,
        note_title: quiz.note_title,
        difficulty: quiz.difficulty,
        quiz_type: quiz.quiz_type,
        total_questions: quiz.total_questions,
        created_at: quiz.created_at,
        questions
      }
    });
  } catch (error) {
    console.error('Get Quiz Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve quiz details.'
    });
  }
}

/**
 * Submit Quiz Answers, Evaluate Score, and Record Attempt
 * POST /api/quizzes/:quizId/submit
 */
export async function submitQuizAttempt(req, res) {
  const userId = req.user.id;
  const quizId = req.params.quizId;
  const { time_taken_seconds = 0, answers = [] } = req.body;

  try {
    // 1. Verify quiz and fetch all questions WITH answers
    const [questionRows] = await pool.query(
      `SELECT q.id, q.question_type, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, 
              q.correct_option, q.ideal_answer, q.key_points, q.explanation
       FROM questions q
       JOIN quizzes qz ON q.quiz_id = qz.id
       JOIN notes n ON qz.note_id = n.id
       WHERE q.quiz_id = ? AND n.user_id = ?
       ORDER BY q.id ASC`,
      [quizId, userId]
    );

    if (questionRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or you are not authorized to submit for this quiz.'
      });
    }

    // Map user answers for fast lookup
    const answerMap = new Map();
    if (Array.isArray(answers)) {
      answers.forEach((ans) => {
        if (ans && ans.question_id) {
          answerMap.set(Number(ans.question_id), {
            selected_option: ans.selected_option ? String(ans.selected_option).toUpperCase() : null,
            user_answer: ans.user_answer ? String(ans.user_answer).trim() : null
          });
        }
      });
    }

    // Evaluate answers
    let calculatedScore = 0;
    const gradedBreakdown = [];
    const attemptAnswersToInsert = [];

    for (const q of questionRows) {
      const userSubmission = answerMap.get(q.id) || { selected_option: null, user_answer: null };
      const isTheoretical = q.question_type === 'theoretical';

      let isCorrect = false;
      let scoreAwarded = 0.0;
      let aiFeedback = null;

      if (isTheoretical) {
        const studentAnswer = userSubmission.user_answer;
        if (studentAnswer && studentAnswer.trim()) {
          const evalResult = await evaluateTheoreticalAnswer({
            questionText: q.question_text,
            idealAnswer: q.ideal_answer,
            keyPoints: q.key_points,
            userAnswer: studentAnswer
          });
          scoreAwarded = evalResult.score;
          aiFeedback = evalResult.feedback;
          isCorrect = scoreAwarded >= 0.6; // Considered correct if >= 60%
        } else {
          scoreAwarded = 0.0;
          aiFeedback = 'Question left unanswered.';
          isCorrect = false;
        }
        calculatedScore += scoreAwarded;
      } else {
        // MCQ grading
        const selected = userSubmission.selected_option;
        isCorrect = selected !== null && selected === q.correct_option;
        scoreAwarded = isCorrect ? 1.0 : 0.0;
        calculatedScore += scoreAwarded;
      }

      gradedBreakdown.push({
        question_id: q.id,
        question_type: q.question_type,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        selected_option: userSubmission.selected_option,
        user_answer: userSubmission.user_answer,
        correct_option: q.correct_option,
        ideal_answer: q.ideal_answer,
        key_points: q.key_points,
        is_correct: isCorrect,
        score_awarded: Number(scoreAwarded.toFixed(2)),
        ai_feedback: aiFeedback,
        explanation: q.explanation
      });

      attemptAnswersToInsert.push({
        question_id: q.id,
        selected_option: userSubmission.selected_option,
        user_answer: userSubmission.user_answer,
        is_correct: isCorrect,
        score_awarded: Number(scoreAwarded.toFixed(2)),
        ai_feedback: aiFeedback
      });
    }

    const totalQuestions = questionRows.length;
    const finalScore = Number(calculatedScore.toFixed(2));
    const accuracyPercentage = Math.round((finalScore / totalQuestions) * 100);

    // 2. ATOMIC SQL TRANSACTION: Record Attempt and Detailed Answers
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Insert into quiz_attempts
      const [attemptResult] = await connection.query(
        `INSERT INTO quiz_attempts (user_id, quiz_id, score, time_taken_seconds) 
         VALUES (?, ?, ?, ?)`,
        [userId, quizId, finalScore, Math.max(0, parseInt(time_taken_seconds, 10) || 0)]
      );

      const attemptId = attemptResult.insertId;

      // Bulk insert into attempt_answers
      if (attemptAnswersToInsert.length > 0) {
        const answerValues = attemptAnswersToInsert.map((ans) => [
          attemptId,
          ans.question_id,
          ans.selected_option,
          ans.user_answer,
          ans.is_correct,
          ans.score_awarded,
          ans.ai_feedback
        ]);

        await connection.query(
          `INSERT INTO attempt_answers 
            (attempt_id, question_id, selected_option, user_answer, is_correct, score_awarded, ai_feedback) 
           VALUES ?`,
          [answerValues]
        );
      }

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: 'Quiz submitted and graded successfully.',
        attempt: {
          id: attemptId,
          quiz_id: Number(quizId),
          score: finalScore,
          total_questions: totalQuestions,
          accuracy_percentage: accuracyPercentage,
          time_taken_seconds: parseInt(time_taken_seconds, 10) || 0,
          attempted_at: new Date()
        },
        breakdown: gradedBreakdown
      });
    } catch (transactionError) {
      await connection.rollback();
      console.error('Transaction Rolled Back on Quiz Submission:', transactionError);
      throw transactionError;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Quiz Submission Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process quiz submission.'
    });
  }
}

/**
 * Get past attempt results with full breakdown and explanations
 * GET /api/quizzes/:quizId/attempts/:attemptId
 */
export async function getAttemptResults(req, res) {
  try {
    const userId = req.user.id;
    const { quizId, attemptId } = req.params;

    // Verify attempt ownership
    const [attemptRows] = await pool.query(
      `SELECT qa.id, qa.quiz_id, qa.score, qa.time_taken_seconds, qa.attempted_at,
              qz.difficulty, qz.quiz_type, qz.total_questions, n.title AS note_title
       FROM quiz_attempts qa
       JOIN quizzes qz ON qa.quiz_id = qz.id
       JOIN notes n ON qz.note_id = n.id
       WHERE qa.id = ? AND qa.quiz_id = ? AND qa.user_id = ?`,
      [attemptId, quizId, userId]
    );

    if (attemptRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attempt results not found or unauthorized.'
      });
    }

    const attempt = attemptRows[0];

    // Fetch all questions for this quiz joined with the user's selected answers in this attempt
    const [breakdownRows] = await pool.query(
      `SELECT 
        q.id AS question_id,
        q.question_type,
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_option,
        q.ideal_answer,
        q.key_points,
        q.explanation,
        aa.selected_option,
        aa.user_answer,
        aa.score_awarded,
        aa.ai_feedback,
        COALESCE(aa.is_correct, FALSE) AS is_correct
       FROM questions q
       LEFT JOIN attempt_answers aa ON q.id = aa.question_id AND aa.attempt_id = ?
       WHERE q.quiz_id = ?
       ORDER BY q.id ASC`,
      [attemptId, quizId]
    );

    const scoreNum = Number(attempt.score);
    return res.status(200).json({
      success: true,
      attempt: {
        id: attempt.id,
        quiz_id: attempt.quiz_id,
        note_title: attempt.note_title,
        difficulty: attempt.difficulty,
        quiz_type: attempt.quiz_type,
        score: scoreNum,
        total_questions: attempt.total_questions,
        accuracy_percentage: Math.round((scoreNum / attempt.total_questions) * 100),
        time_taken_seconds: attempt.time_taken_seconds,
        attempted_at: attempt.attempted_at
      },
      breakdown: breakdownRows
    });
  } catch (error) {
    console.error('Get Attempt Results Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve attempt results.'
    });
  }
}

/**
 * Get Weak Areas (questions answered incorrectly by the user)
 * GET /api/quizzes/weak-areas
 */
export async function getWeakAreas(req, res) {
  try {
    const userId = req.user.id;

    const [weakQuestions] = await pool.query(
      `SELECT 
        q.id AS question_id,
        q.quiz_id,
        q.question_type,
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_option,
        q.ideal_answer,
        q.key_points,
        q.explanation,
        qz.difficulty,
        qz.quiz_type,
        n.title AS note_title,
        COUNT(aa.id) AS times_missed,
        MAX(qa.attempted_at) AS last_missed_at
       FROM attempt_answers aa
       JOIN quiz_attempts qa ON aa.attempt_id = qa.id
       JOIN questions q ON aa.question_id = q.id
       JOIN quizzes qz ON q.quiz_id = qz.id
       JOIN notes n ON qz.note_id = n.id
       WHERE qa.user_id = ? AND aa.is_correct = FALSE
       GROUP BY 
        q.id, q.quiz_id, q.question_type, q.question_text, q.option_a, q.option_b, 
        q.option_c, q.option_d, q.correct_option, q.ideal_answer, q.key_points, q.explanation, 
        qz.difficulty, qz.quiz_type, n.title
       ORDER BY times_missed DESC, last_missed_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      count: weakQuestions.length,
      weak_questions: weakQuestions
    });
  } catch (error) {
    console.error('Get Weak Areas Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve weak areas.'
    });
  }
}
