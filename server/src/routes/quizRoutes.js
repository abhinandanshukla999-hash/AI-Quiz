import { Router } from 'express';
import {
  generateQuiz,
  getQuizById,
  submitQuizAttempt,
  getAttemptResults,
  getWeakAreas
} from '../controllers/quizController.js';
import { authMiddleware } from '../middleware/auth.js';
import { quizGenerationLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Protect all quiz routes with JWT auth
router.use(authMiddleware);

// Generate new quiz from note with AI rate limiting
router.post('/generate', quizGenerationLimiter, generateQuiz);

// Get student's weak areas (declared before /:quizId to prevent route conflict)
router.get('/weak-areas', getWeakAreas);

// Get quiz by id for exam mode (excludes solutions)
router.get('/:quizId', getQuizById);

// Submit quiz answers and receive auto-graded breakdown
router.post('/:quizId/submit', submitQuizAttempt);

// Get full results & explanations for a specific past attempt
router.get('/:quizId/attempts/:attemptId', getAttemptResults);

export default router;
