import { Router } from 'express';
import { uploadNote, getUserNotes, getNoteById } from '../controllers/noteController.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleFileUpload } from '../middleware/upload.js';

const router = Router();

// Protect all note routes with JWT auth
router.use(authMiddleware);

// Ingest notes via file or raw text
router.post('/upload', handleFileUpload, uploadNote);

// Get all notes for the logged-in user
router.get('/', getUserNotes);

// Get single note by id
router.get('/:id', getNoteById);

export default router;
