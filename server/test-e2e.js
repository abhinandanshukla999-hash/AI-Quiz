import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool, initDatabase } from './src/config/db.js';
import authRoutes from './src/routes/authRoutes.js';
import noteRoutes from './src/routes/noteRoutes.js';
import quizRoutes from './src/routes/quizRoutes.js';
import analyticsRoutes from './src/routes/analyticsRoutes.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/analytics', analyticsRoutes);

async function runTests() {
  console.log('--- 🧪 STARTING RECURSIVE END-TO-END VALIDATION ---');
  
  // 1. Initialize DB
  await initDatabase();
  console.log('✓ Step 1: Database initialized & schema verified');

  const server = app.listen(5099);
  const BASE = 'http://localhost:5099/api';

  try {
    const testEmail = `tester_${Date.now()}@example.com`;
    const testPassword = 'Password@123';
    const testName = 'Test Student';

    // 2. Register
    const regRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testName, email: testEmail, password: testPassword })
    });
    const regData = await regRes.json();
    if (!regData.success || !regData.token) {
      throw new Error(`Register failed: ${JSON.stringify(regData)}`);
    }
    console.log('✓ Step 2: Register successful, token acquired');
    const token = regData.token;

    // 3. Login
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    console.log('✓ Step 3: Login successful');

    // 4. Get Current User Profile
    const meRes = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const meData = await meRes.json();
    if (!meData.success || meData.user.email !== testEmail) {
      throw new Error(`Get current user failed: ${JSON.stringify(meData)}`);
    }
    console.log('✓ Step 4: Profile /auth/me verified');

    // 5. Upload Notes (Note must be >= 150 chars)
    const sampleNotes = 
      'Mitochondria are double-membrane-bound organelle found in most eukaryotic organisms. ' +
      'They generate most of the cell supply of adenosine triphosphate (ATP), used as a source of chemical energy. ' +
      'A mitochondrion contains outer and inner membranes composed of phospholipid bilayers and proteins. ' +
      'The inner membrane has folds known as cristae that expand surface area for ATP synthesis.';
    
    const noteRes = await fetch(`${BASE}/notes/upload`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({
        title: 'Mitochondria and Cellular Energy',
        text: sampleNotes
      })
    });
    const noteData = await noteRes.json();
    if (!noteData.success || !noteData.note?.id) {
      throw new Error(`Note upload failed: ${JSON.stringify(noteData)}`);
    }
    const noteId = noteData.note.id;
    console.log(`✓ Step 5: Note uploaded successfully with ID: ${noteId}`);

    // 6. Get User Notes
    const notesListRes = await fetch(`${BASE}/notes`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const notesListData = await notesListRes.json();
    if (!notesListData.success || !notesListData.notes.length) {
      throw new Error(`Get notes list failed: ${JSON.stringify(notesListData)}`);
    }
    console.log(`✓ Step 6: Retrieved ${notesListData.notes.length} note(s) for user`);

    // 7. Get Note By ID
    const singleNoteRes = await fetch(`${BASE}/notes/${noteId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const singleNoteData = await singleNoteRes.json();
    if (!singleNoteData.success || singleNoteData.note.id !== noteId) {
      throw new Error(`Get note by ID failed: ${JSON.stringify(singleNoteData)}`);
    }
    console.log('✓ Step 7: Note details retrieved by ID');

    // 8. Generate Quiz via Gemini AI
    console.log('⏳ Step 8: Generating quiz questions via Gemini AI...');
    const quizGenRes = await fetch(`${BASE}/quizzes/generate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({
        note_id: noteId,
        difficulty: 'Easy',
        count: 5
      })
    });
    const quizGenData = await quizGenRes.json();
    if (!quizGenData.success || !quizGenData.quiz?.id) {
      throw new Error(`Quiz generation failed: ${JSON.stringify(quizGenData)}`);
    }
    const quizId = quizGenData.quiz.id;
    console.log(`✓ Step 8: AI Quiz generated successfully with ID: ${quizId} (${quizGenData.quiz.total_questions} questions)`);

    // 9. Fetch Quiz for Exam Mode (Verify answers/explanations are hidden)
    const examRes = await fetch(`${BASE}/quizzes/${quizId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const examData = await examRes.json();
    if (!examData.success || !examData.quiz?.questions?.length) {
      throw new Error(`Fetch exam quiz failed: ${JSON.stringify(examData)}`);
    }
    const firstQ = examData.quiz.questions[0];
    if (firstQ.correct_option !== undefined || firstQ.explanation !== undefined) {
      throw new Error('SECURITY VIOLATION: correct_option or explanation leaked in exam mode!');
    }
    console.log('✓ Step 9: Exam mode verified (solutions safely hidden from student)');

    // 10. Submit Quiz Answers
    const answersToSubmit = examData.quiz.questions.map((q, idx) => ({
      question_id: q.id,
      selected_option: idx % 2 === 0 ? 'A' : 'B'
    }));

    const submitRes = await fetch(`${BASE}/quizzes/${quizId}/submit`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({
        time_taken_seconds: 45,
        answers: answersToSubmit
      })
    });
    const submitData = await submitRes.json();
    if (!submitData.success || !submitData.attempt?.id) {
      throw new Error(`Quiz submission failed: ${JSON.stringify(submitData)}`);
    }
    const attemptId = submitData.attempt.id;
    console.log(`✓ Step 10: Quiz submitted & graded! Score: ${submitData.attempt.score}/${submitData.attempt.total_questions} (${submitData.attempt.accuracy_percentage}%)`);

    // 11. Fetch Attempt Results & Breakdown
    const resultsRes = await fetch(`${BASE}/quizzes/${quizId}/attempts/${attemptId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const resultsData = await resultsRes.json();
    if (!resultsData.success || !resultsData.breakdown?.length) {
      throw new Error(`Fetch attempt results failed: ${JSON.stringify(resultsData)}`);
    }
    console.log(`✓ Step 11: Attempt results retrieved with ${resultsData.breakdown.length} explanations`);

    // 12. Fetch Weak Areas
    const weakRes = await fetch(`${BASE}/quizzes/weak-areas`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const weakData = await weakRes.json();
    if (!weakData.success) {
      throw new Error(`Fetch weak areas failed: ${JSON.stringify(weakData)}`);
    }
    console.log(`✓ Step 12: Weak areas retrieved (Identified ${weakData.count} missed concepts)`);

    // 13. Fetch Dashboard Analytics
    const analyticsRes = await fetch(`${BASE}/analytics/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const analyticsData = await analyticsRes.json();
    if (!analyticsData.success || analyticsData.analytics.total_notes === 0) {
      throw new Error(`Analytics dashboard failed: ${JSON.stringify(analyticsData)}`);
    }
    console.log(`✓ Step 13: Dashboard analytics verified:`, analyticsData.analytics);

    console.log('\n========================================');
    console.log('🎉 ALL 13 TEST STEPS PASSED SUCCESSFULLY!');
    console.log('========================================');

    server.close();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err.message);
    server.close();
    await pool.end();
    process.exit(1);
  }
}

runTests();
