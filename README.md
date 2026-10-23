# AI Notes-to-Question Practice Platform 🎓

A production-ready full-stack web application for students that converts uploaded study notes (PDF, DOCX, TXT, or raw text) into interactive, auto-graded multiple-choice practice quizzes using the **Google Gemini SDK (`@google/genai`)** with **Structured Outputs (`responseSchema`)**, backed by a relational **MySQL** database.

---

## 🛠 Tech Stack

- **Frontend (Client-Side):**
  - React 19 + Vite
  - Tailwind CSS (`@tailwindcss/vite`)
  - Lucide React icons
  - React Router DOM v7
  - State Management: React Hooks (`useReducer`, `useState`, `useContext`, `useEffect`)
  - Axios with JWT Interceptor and global unauthorized session handling
- **Backend (Server-Side):**
  - Node.js + Express.js (REST API)
  - MySQL with `mysql2/promise` connection pooling & atomic SQL transactions
  - Official Google Gemini SDK (`@google/genai`) with structured JSON response schema
  - File Processing: `multer` (in-memory buffer handling), `pdf-parse` (PDF extraction), `mammoth` (DOCX extraction)
  - Security & Guardrails: `bcryptjs`, `jsonwebtoken` (JWT), `cors`, `express-rate-limit` (10 AI requests/hr/user limit)

---

## 🗄️ Relational Database Schema

The system uses 6 normalized MySQL tables:
1. `users`: Stores user credentials (`id`, `name`, `email`, `password_hash`, `created_at`).
2. `notes`: Ingested study materials with SHA-256 fingerprint (`id`, `user_id`, `title`, `extracted_text`, `content_hash`, `created_at`).
3. `quizzes`: Generated quiz metadata (`id`, `note_id`, `difficulty`, `total_questions`, `created_at`).
4. `questions`: Questions with distractors, correct answers, and explanations (`id`, `quiz_id`, `question_text`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_option`, `explanation`).
5. `quiz_attempts`: Student exam sessions (`id`, `user_id`, `quiz_id`, `score`, `time_taken_seconds`, `attempted_at`).
6. `attempt_answers`: Detailed answer log (`id`, `attempt_id`, `question_id`, `selected_option`, `is_correct`).

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+)
- MySQL Server (v8.0+)
- Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### 1. Database & Environment Configuration

1. Copy the server environment template:
   ```bash
   cd server
   cp .env.example .env
   ```
2. Open `server/.env` and update your MySQL credentials and Gemini API Key:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=ai_notes_quiz_db
   JWT_SECRET=your_secure_random_jwt_secret_min32chars
   GEMINI_API_KEY=your_actual_gemini_api_key
   ```
   *(Note: The server automatically runs schema verification and creates the database and tables on startup via `schema.sql`).*

3. (Optional) Copy client environment template:
   ```bash
   cd ../client
   cp .env.example .env
   ```

### 2. Install Dependencies

In the `server` directory:
```bash
cd server
npm install
```

In the `client` directory:
```bash
cd client
npm install
```

### 3. Run the Application

Start the backend server (runs on `http://localhost:5000`):
```bash
cd server
npm run dev
```

In a separate terminal, start the frontend Vite client (runs on `http://localhost:5173`):
```bash
cd client
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🔒 Security & Guardrails Highlights

1. **Anti-Cheating Shield:** `GET /api/quizzes/:quizId` strictly excludes `correct_option` and `explanation` from API payloads during exam mode. Solutions are only revealed after official submission.
2. **AI Quota Protection:** `express-rate-limit` enforces a maximum of 10 AI quiz generations per hour per authenticated student.
3. **Length Validation:** Notes with fewer than 150 characters or greater than 15,000 words are rejected before reaching Gemini.
4. **Duplicate Fingerprinting:** Each note's cleaned text is fingerprinted with `SHA-256` to detect duplicate materials.
5. **Atomic Transactions:** Quiz generation and student answer grading use database transactions (`BEGIN ... COMMIT / ROLLBACK`) to prevent partial database writes.
