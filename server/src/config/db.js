import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ai_notes_quiz_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true
};

// Create the connection pool
export const pool = mysql.createPool(dbConfig);

/**
 * Initializes the database and tables if they don't already exist.
 * Reads server/schema.sql and executes statements safely.
 */
export async function initDatabase() {
  try {
    // 1. First ensure the target database exists using an unselected connection
    const setupConnection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await setupConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await setupConnection.end();

    // 2. Read schema.sql from server root
    const schemaPath = path.resolve(__dirname, '../../schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      
      // Strip single-line (--) and multi-line (/* */) comments before splitting on ';'
      const cleanSql = schemaSql
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');

      const statements = cleanSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      const connection = await pool.getConnection();
      try {
        for (const statement of statements) {
          if (statement.length > 0) {
            await connection.query(statement);
          }
        }

        // 3. Automated safe migrations for existing tables
        const checkAndAddColumn = async (table, column, definition) => {
          const [cols] = await connection.query(
            `SELECT COUNT(*) AS cnt FROM information_schema.columns 
             WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
            [dbConfig.database, table, column]
          );
          if (cols[0].cnt === 0) {
            await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
            console.log(`  ➕ Added column ${column} to table ${table}`);
          }
        };

        // Users migrations
        await checkAndAddColumn('users', 'date_of_birth', 'DATE NULL');
        await checkAndAddColumn('users', 'avatar_url', 'LONGTEXT NULL');

        // Quizzes migrations
        await checkAndAddColumn('quizzes', 'quiz_type', "ENUM('mcq', 'theoretical', 'mixed') DEFAULT 'mcq'");

        // Questions migrations
        await checkAndAddColumn('questions', 'question_type', "ENUM('mcq', 'theoretical') DEFAULT 'mcq'");
        await checkAndAddColumn('questions', 'ideal_answer', 'TEXT NULL');
        await checkAndAddColumn('questions', 'key_points', 'TEXT NULL');
        // Allow NULL for theoretical questions where MCQ options are absent
        await connection.query(`ALTER TABLE questions 
          MODIFY option_a TEXT NULL, 
          MODIFY option_b TEXT NULL, 
          MODIFY option_c TEXT NULL, 
          MODIFY option_d TEXT NULL, 
          MODIFY correct_option ENUM('A', 'B', 'C', 'D') NULL`);

        // Attempts & Answers migrations
        await checkAndAddColumn('attempt_answers', 'user_answer', 'TEXT NULL');
        await checkAndAddColumn('attempt_answers', 'ai_feedback', 'TEXT NULL');
        await checkAndAddColumn('attempt_answers', 'score_awarded', 'DECIMAL(5,2) DEFAULT 0.00');
        await connection.query(`ALTER TABLE attempt_answers MODIFY selected_option ENUM('A', 'B', 'C', 'D') NULL`);
        await connection.query(`ALTER TABLE quiz_attempts MODIFY score DECIMAL(5,2) NOT NULL`);

        console.log('✅ Database schema verified, migrated, and initialized successfully.');
      } finally {
        connection.release();
      }
    }
  } catch (error) {
    console.error('❌ Failed to initialize database schema:', error.message);
    throw error;
  }
}

export default pool;
