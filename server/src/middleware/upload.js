import multer from 'multer';
import path from 'path';

// Use memory storage to process file buffers in-memory without polluting disk
const storage = multer.memoryStorage();

// Allowed file extensions and mime types (Documents and Images/Photos)
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isExtensionValid = ALLOWED_EXTENSIONS.includes(ext);
  const isMimeValid = ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype.startsWith('image/');

  if (isExtensionValid || isMimeValid) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type "${ext}". Supported formats: PDF (.pdf), Word (.docx), plain text (.txt), and Photos (.jpg, .jpeg, .png, .webp).`
      ),
      false
    );
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 Megabytes limit
  },
  fileFilter
});

/**
 * Express wrapper for multer to handle multer-specific errors gracefully
 */
export function handleFileUpload(req, res, next) {
  const uploadSingle = upload.single('file');

  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds maximum allowed limit of 10MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: `File upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next();
  });
}

export default handleFileUpload;
