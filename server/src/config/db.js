import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbConfig = {
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

// Check if a full connection URL is passed via DATABASE_URL, MYSQL_URL, or DB_HOST
const rawHostOrUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.DB_HOST || '';
if (rawHostOrUrl.startsWith('mysql://') || rawHostOrUrl.startsWith('mysqls://')) {
  try {
    const parsed = new URL(rawHostOrUrl);
    dbConfig.host = parsed.hostname;
    if (parsed.port) dbConfig.port = parseInt(parsed.port, 10);
    if (parsed.username) dbConfig.user = decodeURIComponent(parsed.username);
    if (parsed.password) dbConfig.password = decodeURIComponent(parsed.password);
    if (parsed.pathname && parsed.pathname.length > 1) {
      dbConfig.database = decodeURIComponent(parsed.pathname.slice(1));
    }
    dbConfig.ssl = { rejectUnauthorized: false };
  } catch (err) {
    console.warn('⚠️ Could not parse MySQL connection URL, using individual config:', err.message);
  }
}

// Enable SSL if explicitly configured or connecting to a remote/cloud MySQL host (e.g., Aiven, TiDB, Render)
if (!dbConfig.ssl) {
  const isCloudHost = dbConfig.host !== 'localhost' && dbConfig.host !== '127.0.0.1' && !dbConfig.host.startsWith('192.168.');
  if (process.env.DB_SSL === 'true' || (isCloudHost && process.env.DB_SSL !== 'false')) {
    dbConfig.ssl = { rejectUnauthorized: false };
  }
}

// Create the connection pool
export const pool = mysql.createPool(dbConfig);

/**
 * Initializes the database and tables if they don't already exist.
 * Reads server/schema.sql and executes statements safely.
 */
export async function initDatabase() {
  try {
    // 1. First attempt to ensure the target database exists if privileges allow (e.g. local MySQL)
    try {
      const setupConfig = {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        ...(dbConfig.ssl ? { ssl: dbConfig.ssl } : {})
      };
      const setupConnection = await mysql.createConnection(setupConfig);
      await setupConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await setupConnection.end();
    } catch (createDbErr) {
      // In managed cloud databases (Aiven, TiDB, etc.), users typically do not have CREATE DATABASE permissions
      // and are assigned a pre-existing database (e.g. defaultdb). We safely continue.
      console.log(`ℹ️ Notice: Managed database detected (${createDbErr.code || createDbErr.message}). Connected directly to database "${dbConfig.database}".`);
    }

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
        .filter(stmt => {
          if (!stmt) return false;
          const upper = stmt.toUpperCase();
          // Filter out CREATE DATABASE and USE statements so schema installs directly on the configured database
          if (upper.startsWith('CREATE DATABASE') || upper.startsWith('USE ')) {
            return false;
          }
          return true;
        });

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
