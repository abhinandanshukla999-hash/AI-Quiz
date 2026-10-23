import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';

/**
 * Initializes and validates the Google GenAI client instance
 */
function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'GEMINI_API_KEY is missing or invalid in server environment. Please set GEMINI_API_KEY in server/.env.'
    );
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Generates structured quiz questions (MCQ, Theoretical / Conceptual, or Mixed)
 * using Gemini with structured responseSchema.
 *
 * @param {Object} params
 * @param {string} params.noteContent - The extracted study notes text
 * @param {string} params.difficulty - 'Easy', 'Medium', or 'Hard'
 * @param {string} params.quizType - 'mcq', 'theoretical', or 'mixed'
 * @param {number} params.count - Number of questions (3 to 20)
 * @returns {Promise<Array<Object>>}
 */
export async function generateQuizQuestions({ 
  noteContent, 
  difficulty = 'Medium', 
  quizType = 'mcq', 
  count = 5 
}) {
  const ai = getGenAIClient();

  const difficultyInstructions = {
    Easy: 'Focus on direct recall, key terminology, foundational definitions, and straightforward facts stated in the notes.',
    Medium: 'Focus on conceptual understanding, application of principles, cause-and-effect relationships, and comparing related topics.',
    Hard: 'Focus on deep critical thinking, multi-concept synthesis, tricky edge cases, evaluating scenario-based problems, and distinguishing subtle differences.'
  };

  const instruction = difficultyInstructions[difficulty] || difficultyInstructions.Medium;

  let typePrompt = '';
  if (quizType === 'theoretical') {
    typePrompt = `Generate all ${count} questions strictly as open-ended, analytical THEORETICAL questions (question_type: 'theoretical'). Do NOT provide multiple choice options for these. For each question, provide a comprehensive 'ideal_answer', core 'key_points', and detailed 'explanation'.`;
  } else if (quizType === 'mixed') {
    typePrompt = `Generate a balanced MIX of both Multiple Choice Questions (question_type: 'mcq') and Theoretical Questions (question_type: 'theoretical'), totaling ${count} questions. For MCQ questions, provide 4 options (A-D) and correct_option. For theoretical questions, leave options empty/null and provide 'ideal_answer' and 'key_points'.`;
  } else {
    typePrompt = `Generate all ${count} questions strictly as MULTIPLE CHOICE questions (question_type: 'mcq'). Each question must have 4 distinct options (A, B, C, D), a single correct_option ('A', 'B', 'C', or 'D'), and an explanation.`;
  }

  const prompt = `
You are an expert academic examiner and professor.
Create practice quiz questions strictly based on the provided study notes.

Target Quantity: Exactly ${count} questions.
Difficulty Level: ${difficulty} (${instruction})
Format Requirement: ${typePrompt}

---
STUDY NOTES CONTENT:
${noteContent}
---
`;

  const candidateModels = Array.from(
    new Set([
      process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.5-flash'
    ])
  );

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question_text: {
                  type: Type.STRING,
                  description: 'The question prompt'
                },
                question_type: {
                  type: Type.STRING,
                  enum: ['mcq', 'theoretical'],
                  description: 'Type of question: mcq or theoretical'
                },
                option_a: {
                  type: Type.STRING,
                  description: 'Option A text (for mcq, or empty for theoretical)'
                },
                option_b: {
                  type: Type.STRING,
                  description: 'Option B text'
                },
                option_c: {
                  type: Type.STRING,
                  description: 'Option C text'
                },
                option_d: {
                  type: Type.STRING,
                  description: 'Option D text'
                },
                correct_option: {
                  type: Type.STRING,
                  description: 'Letter of the single correct option for MCQ (A, B, C, or D), or empty for theoretical'
                },
                ideal_answer: {
                  type: Type.STRING,
                  description: 'Comprehensive model answer for theoretical questions'
                },
                key_points: {
                  type: Type.STRING,
                  description: 'Key concepts, criteria, or keywords that a student response should touch on'
                },
                explanation: {
                  type: Type.STRING,
                  description: 'Detailed explanation and pedagogical rationale'
                }
              },
              required: [
                'question_text',
                'question_type',
                'explanation'
              ]
            }
          }
        }
      });

      const rawOutput = response.text;
      if (!rawOutput) {
        throw new Error('Received empty response from Gemini API.');
      }

      const parsedQuestions = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;

      if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
        throw new Error('Gemini API did not return an array of questions.');
      }

      // Clean questions
      const cleanedQuestions = parsedQuestions.map((q, idx) => {
        const isTheoretical = q.question_type === 'theoretical' || quizType === 'theoretical';
        const type = isTheoretical ? 'theoretical' : 'mcq';
        const correct = String(q.correct_option || 'A').trim().toUpperCase();
        const validOptions = ['A', 'B', 'C', 'D'];
        const safeCorrect = validOptions.includes(correct) ? correct : 'A';

        return {
          question_text: String(q.question_text || `Question ${idx + 1}`).trim(),
          question_type: type,
          option_a: isTheoretical ? null : String(q.option_a || '').trim(),
          option_b: isTheoretical ? null : String(q.option_b || '').trim(),
          option_c: isTheoretical ? null : String(q.option_c || '').trim(),
          option_d: isTheoretical ? null : String(q.option_d || '').trim(),
          correct_option: isTheoretical ? null : safeCorrect,
          ideal_answer: String(q.ideal_answer || q.explanation || '').trim(),
          key_points: String(q.key_points || '').trim(),
          explanation: String(q.explanation || 'No explanation provided.').trim()
        };
      });

      return cleanedQuestions;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Warning: Model "${modelName}" failed (${error.status || error.message}). Attempting fallback...`);
    }
  }

  console.error('All Gemini model candidates failed:', lastError);
  throw new Error(`AI Quiz Generation failed: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Automatically grades a student's open-ended theoretical response against the ideal answer
 * @returns {Promise<{ score: number, feedback: string }>}
 */
export async function evaluateTheoreticalAnswer({ questionText, idealAnswer, keyPoints, userAnswer }) {
  if (!userAnswer || !userAnswer.trim()) {
    return {
      score: 0.0,
      feedback: 'No answer was provided by the student.'
    };
  }

  const ai = getGenAIClient();
  const prompt = `
You are an academic grader evaluating a student's answer to an open-ended theoretical question.

QUESTION:
${questionText}

IDEAL MODEL ANSWER:
${idealAnswer}

KEY POINTS / CRITERIA:
${keyPoints || 'Not specified'}

STUDENT'S SUBMITTED ANSWER:
${userAnswer}

Evaluate the student's submission.
Return a valid JSON object matching:
{
  "score": number between 0.0 and 1.0 (e.g. 0.85 for 85%),
  "feedback": "2-3 sentences of constructive feedback noting what was answered well and any missed key concepts"
}
`;

  try {
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: 'Score between 0.0 and 1.0' },
            feedback: { type: Type.STRING, description: 'Evaluation feedback' }
          },
          required: ['score', 'feedback']
        }
      }
    });

    const parsed = JSON.parse(res.text);
    return {
      score: Math.min(1.0, Math.max(0.0, Number(parsed.score) || 0.0)),
      feedback: String(parsed.feedback || 'Good attempt.')
    };
  } catch (err) {
    console.warn('AI Grading evaluation fallback:', err.message);
    // Simple heuristic fallback if Gemini grading is unavailable
    const lengthScore = Math.min(1.0, userAnswer.trim().length / 100);
    return {
      score: lengthScore > 0.3 ? 0.8 : 0.4,
      feedback: 'Answer recorded. Compare your response with the ideal answer below.'
    };
  }
}
