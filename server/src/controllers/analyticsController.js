import { pool } from '../config/db.js';

/**
 * Get Student Dashboard Analytics & Metrics
 * GET /api/analytics/dashboard
 */
export async function getDashboardAnalytics(req, res) {
  try {
    const userId = req.user.id;

    // 1. Total Notes Uploaded
    const [notesCountRows] = await pool.query(
      'SELECT COUNT(*) AS total_notes FROM notes WHERE user_id = ?',
      [userId]
    );
    const totalNotes = notesCountRows[0]?.total_notes || 0;

    // 2. Total Quizzes Completed
    const [attemptsCountRows] = await pool.query(
      'SELECT COUNT(*) AS total_quizzes FROM quiz_attempts WHERE user_id = ?',
      [userId]
    );
    const totalQuizzes = attemptsCountRows[0]?.total_quizzes || 0;

    // 3. Average Accuracy Percentage
    const [avgScoreRows] = await pool.query(
      `SELECT COALESCE(AVG((qa.score / qz.total_questions) * 100), 0) AS average_score
       FROM quiz_attempts qa
       JOIN quizzes qz ON qa.quiz_id = qz.id
       WHERE qa.user_id = ?`,
      [userId]
    );
    const averageScore = Math.round(avgScoreRows[0]?.average_score || 0);

    // 4. Weak Questions Count (distinct questions user has missed)
    const [weakCountRows] = await pool.query(
      `SELECT COUNT(DISTINCT aa.question_id) AS weak_questions_count
       FROM attempt_answers aa
       JOIN quiz_attempts qa ON aa.attempt_id = qa.id
       WHERE qa.user_id = ? AND aa.is_correct = FALSE`,
      [userId]
    );
    const weakQuestionsCount = weakCountRows[0]?.weak_questions_count || 0;

    // 5. Recent Attempt History (last 10 attempts)
    const [recentAttempts] = await pool.query(
      `SELECT 
        qa.id AS attempt_id,
        qa.quiz_id,
        qa.score,
        qa.time_taken_seconds,
        qa.attempted_at,
        qz.difficulty,
        qz.total_questions,
        n.id AS note_id,
        n.title AS note_title,
        ROUND((qa.score / qz.total_questions) * 100) AS percentage
       FROM quiz_attempts qa
       JOIN quizzes qz ON qa.quiz_id = qz.id
       JOIN notes n ON qz.note_id = n.id
       WHERE qa.user_id = ?
       ORDER BY qa.attempted_at DESC
       LIMIT 10`,
      [userId]
    );

    // 6. Recent Notes (last 5 notes)
    const [recentNotes] = await pool.query(
      `SELECT 
        n.id,
        n.title,
        CHAR_LENGTH(n.extracted_text) AS character_count,
        n.created_at,
        COUNT(q.id) AS quizzes_count
       FROM notes n
       LEFT JOIN quizzes q ON n.id = q.note_id
       WHERE n.user_id = ?
       GROUP BY n.id
       ORDER BY n.created_at DESC
       LIMIT 5`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      analytics: {
        total_notes: Number(totalNotes),
        total_quizzes: Number(totalQuizzes),
        average_score_percentage: averageScore,
        weak_questions_count: Number(weakQuestionsCount),
        recent_attempts: recentAttempts,
        recent_notes: recentNotes
      }
    });
  } catch (error) {
    console.error('Analytics Dashboard Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard analytics.'
    });
  }
}
