import { pool } from '../config/db.js';
import { extractText } from '../services/textExtractionService.js';

/**
 * Upload and ingest notes from file or raw text
 * POST /api/notes/upload
 */
export async function uploadNote(req, res) {
  try {
    const userId = req.user.id;
    const { title: rawTitle, text: rawText } = req.body;
    const file = req.file;

    if (!file && (!rawText || !rawText.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a document file (.pdf, .docx, .txt) or paste note text.'
      });
    }

    // Determine default title if not provided
    let title = rawTitle && rawTitle.trim() ? rawTitle.trim() : null;
    if (!title) {
      if (file && file.originalname) {
        // Strip extension from original file name
        title = file.originalname.replace(/\.[^/.]+$/, '');
      } else {
        title = `Study Note - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    }

    // Extract, clean, and validate text
    const { cleanedText, characterCount, wordCount, contentHash } = await extractText({
      file,
      rawText,
      originalName: file?.originalname
    });

    // Check for duplicate note upload by the same user using content hash
    const [existingNotes] = await pool.query(
      'SELECT id, title, created_at FROM notes WHERE user_id = ? AND content_hash = ?',
      [userId, contentHash]
    );

    let isDuplicate = false;
    let existingNoteId = null;

    if (existingNotes.length > 0) {
      isDuplicate = true;
      existingNoteId = existingNotes[0].id;
    }

    // Insert note into MySQL database
    const [result] = await pool.query(
      'INSERT INTO notes (user_id, title, extracted_text, content_hash) VALUES (?, ?, ?, ?)',
      [userId, title, cleanedText, contentHash]
    );

    const noteId = result.insertId;

    return res.status(201).json({
      success: true,
      message: isDuplicate 
        ? 'Note uploaded successfully (Note: You have uploaded identical content previously).'
        : 'Note uploaded and processed successfully.',
      note: {
        id: noteId,
        title,
        character_count: characterCount,
        word_count: wordCount,
        content_hash: contentHash,
        is_duplicate: isDuplicate,
        previous_note_id: existingNoteId,
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error('Note Upload Error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to process and save study notes.'
    });
  }
}

/**
 * Get all notes for the authenticated user
 * GET /api/notes
 */
export async function getUserNotes(req, res) {
  try {
    const userId = req.user.id;

    const [notes] = await pool.query(
      `SELECT 
        n.id, 
        n.title, 
        CHAR_LENGTH(n.extracted_text) AS character_count,
        SUBSTRING(n.extracted_text, 1, 200) AS preview,
        n.content_hash, 
        n.created_at,
        COUNT(q.id) AS total_quizzes_generated
      FROM notes n
      LEFT JOIN quizzes q ON n.id = q.note_id
      WHERE n.user_id = ?
      GROUP BY n.id
      ORDER BY n.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      notes
    });
  } catch (error) {
    console.error('Get Notes Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve notes.'
    });
  }
}

/**
 * Get single note by ID
 * GET /api/notes/:id
 */
export async function getNoteById(req, res) {
  try {
    const userId = req.user.id;
    const noteId = req.params.id;

    const [rows] = await pool.query(
      `SELECT n.id, n.title, n.extracted_text, n.content_hash, n.created_at 
       FROM notes n 
       WHERE n.id = ? AND n.user_id = ?`,
      [noteId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Note not found or access denied.'
      });
    }

    return res.status(200).json({
      success: true,
      note: rows[0]
    });
  } catch (error) {
    console.error('Get Note By ID Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve note.'
    });
  }
}
