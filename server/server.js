import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './src/config/db.js';
import authRoutes from './src/routes/authRoutes.js';
import noteRoutes from './src/routes/noteRoutes.js';
import quizRoutes from './src/routes/quizRoutes.js';
import analyticsRoutes from './src/routes/analyticsRoutes.js';
import { generalApiLimiter } from './src/middleware/rateLimiter.js';

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Security & Cross-Origin Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or matching CLIENT_URL / localhost
      if (!origin || origin.startsWith('http://localhost') || origin === CLIENT_URL) {
        callback(null, true);
      } else {
        callback(null, true); // Dev-friendly fallback
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Body Parsing Middleware
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Apply general rate limiter
app.use('/api', generalApiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'AI Notes-to-Question Practice Platform API'
  });
});

// Mount Modular API Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start Server and Initialize Database
async function startServer() {
  try {
    console.log('🔄 Connecting to MySQL and verifying schema...');
    await initDatabase();
    console.log('✅ MySQL connection established successfully.');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📚 Ready to ingest notes and generate quizzes via Gemini AI!`);
    });
  } catch (error) {
    console.warn('⚠️ Warning: MySQL auto-init encountered an issue:', error.message);
    console.warn(' ℹ️ exitPlease ensure MySQL is running and DB_PASSWORD is set in server/.env.');
    
    // Still start server so API endpoints can be inspected or tested
    app.listen(PORT, () => {
      console.log(`🚀 Server running in fallback mode on http://localhost:${PORT}`);
    });
  }
}

startServer();
