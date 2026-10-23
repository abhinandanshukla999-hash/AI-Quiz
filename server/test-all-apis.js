import 'dotenv/config';
import { pool } from './src/config/db.js';

const BASE = 'http://localhost:5000/api';

async function testAllApis() {
  console.log('====================================================');
  console.log('🔍 COMPREHENSIVE API DIAGNOSTIC & VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST GROUP 1: HEALTH
  // ----------------------------------------------------
  console.log('--- [1/6] Health Endpoint ---');
  try {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    assert(res.status === 200 && data.status === 'healthy', 'GET /api/health responds 200 with healthy status');
  } catch (e) {
    assert(false, `GET /api/health failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST GROUP 2: AUTHENTICATION
  // ----------------------------------------------------
  console.log('\n--- [2/6] Authentication APIs ---');
  const uniqueEmail = `test_member_${Date.now()}@university.edu`;
  const password = 'SecurePassword123!';
  let token = null;
  let userId = null;

  // 2.1 Register New User
  try {
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alex River', email: uniqueEmail, password })
    });
    const data = await res.json();
    assert(res.status === 201 && data.success && data.token, `POST /api/auth/register (New User): Status 201, token issued for ${uniqueEmail}`);
    token = data.token;
    userId = data.user?.id;
  } catch (e) {
    assert(false, `POST /api/auth/register failed: ${e.message}`);
  }

  // 2.2 Register Duplicate Email (Expect 409)
  try {
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alex River Duplicate', email: uniqueEmail, password })
    });
    const data = await res.json();
    assert(res.status === 409 && !data.success, 'POST /api/auth/register (Duplicate Email): Status 409 Conflict handled properly');
  } catch (e) {
    assert(false, `POST /api/auth/register duplicate check failed: ${e.message}`);
  }

  // 2.3 Register Validation (Short password < 6 chars, expect 400)
  try {
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Short Pass', email: `short_${Date.now()}@example.com`, password: '123' })
    });
    const data = await res.json();
    assert(res.status === 400 && !data.success, 'POST /api/auth/register (Short Password): Status 400 rejected with error');
  } catch (e) {
    assert(false, `POST /api/auth/register validation failed: ${e.message}`);
  }

  // 2.4 Login Valid Credentials
  try {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password })
    });
    const data = await res.json();
    assert(res.status === 200 && data.success && data.token, 'POST /api/auth/login (Correct Credentials): Status 200, JWT returned');
  } catch (e) {
    assert(false, `POST /api/auth/login failed: ${e.message}`);
  }

  // 2.5 Login Incorrect Password (Expect 401)
  try {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password: 'WrongPassword!' })
    });
    const data = await res.json();
    assert(res.status === 401 && !data.success, 'POST /api/auth/login (Wrong Password): Status 401 Unauthorized');
  } catch (e) {
    assert(false, `POST /api/auth/login wrong pass failed: ${e.message}`);
  }

  // 2.6 Get Profile (GET /api/auth/me)
  try {
    const res = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    assert(res.status === 200 && data.success && data.user.email === uniqueEmail, 'GET /api/auth/me: Status 200, returns authenticated user profile');
  } catch (e) {
    assert(false, `GET /api/auth/me failed: ${e.message}`);
  }

  // 2.7 Missing Token on Protected Route (Expect 401)
  try {
    const res = await fetch(`${BASE}/auth/me`);
    const data = await res.json();
    assert(res.status === 401 && !data.success, 'GET /api/auth/me (No Token): Status 401 rejected');
  } catch (e) {
    assert(false, `GET /api/auth/me no token check failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST GROUP 3: NOTES MANAGEMENT
  // ----------------------------------------------------
  console.log('\n--- [3/6] Notes APIs ---');
  let noteId = null;

  // 3.1 Upload Note (Text format >= 150 chars)
  const validNoteText = 
    'The nervous system is the main telecommunications network of the human body. ' +
    'It contains billions of nerve cells called neurons which transmit electrical signals. ' +
    'The central nervous system consists of the brain and spinal cord, while the peripheral nervous system ' +
    'consists of nerves branching out to every tissue and sensory organ in the entire body.';

  try {
    const res = await fetch(`${BASE}/notes/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Human Nervous System & Neurobiology',
        text: validNoteText
      })
    });
    const data = await res.json();
    assert(res.status === 201 && data.success && data.note?.id, `POST /api/notes/upload (Valid Text): Status 201, created note ID ${data.note?.id}`);
    noteId = data.note?.id;
  } catch (e) {
    assert(false, `POST /api/notes/upload failed: ${e.message}`);
  }

  // 3.2 Upload Note Too Short (< 150 chars, expect 400)
  try {
    const res = await fetch(`${BASE}/notes/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Too Short',
        text: 'This is too short.'
      })
    });
    const data = await res.json();
    assert(res.status === 400 && !data.success, 'POST /api/notes/upload (Too Short < 150 chars): Status 400 properly rejected');
  } catch (e) {
    assert(false, `POST /api/notes/upload short validation failed: ${e.message}`);
  }

  // 3.3 Get Notes List
  try {
    const res = await fetch(`${BASE}/notes`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    assert(res.status === 200 && data.success && Array.isArray(data.notes) && data.notes.length > 0, `GET /api/notes: Status 200, retrieved ${data.notes?.length} note(s)`);
  } catch (e) {
    assert(false, `GET /api/notes failed: ${e.message}`);
  }

  // 3.4 Get Note By ID
  try {
    const res = await fetch(`${BASE}/notes/${noteId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    assert(res.status === 200 && data.success && data.note?.id === noteId, `GET /api/notes/:id: Status 200, retrieved note title "${data.note?.title}"`);
  } catch (e) {
    assert(false, `GET /api/notes/:id failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST GROUP 4: QUIZ GENERATION & EXAM MODE
  // ----------------------------------------------------
  console.log('\n--- [4/6] Quiz Generation & Exam Mode APIs ---');
  let quizId = null;
  let questions = [];

  // 4.1 Generate Quiz with Gemini AI
  try {
    console.log('  ⏳ Calling Gemini AI for 5 multiple choice questions...');
    const res = await fetch(`${BASE}/quizzes/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        note_id: noteId,
        difficulty: 'Medium',
        count: 5
      })
    });
    const data = await res.json();
    assert(res.status === 201 && data.success && data.quiz?.id, `POST /api/quizzes/generate: Status 201, Quiz ID ${data.quiz?.id} with ${data.quiz?.total_questions} questions`);
    quizId = data.quiz?.id;
  } catch (e) {
    assert(false, `POST /api/quizzes/generate failed: ${e.message}`);
  }

  // 4.2 Get Quiz Details for Exam (Verify Anti-Cheat Protection)
  try {
    const res = await fetch(`${BASE}/quizzes/${quizId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    questions = data.quiz?.questions || [];
    const leaksAnswers = questions.some(q => q.correct_option !== undefined || q.explanation !== undefined);
    assert(
      res.status === 200 && data.success && questions.length === 5 && !leaksAnswers,
      'GET /api/quizzes/:id (Exam Mode): Status 200, anti-cheat verified (no answer keys or explanations leaked)'
    );
  } catch (e) {
    assert(false, `GET /api/quizzes/:id failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST GROUP 5: QUIZ SUBMISSION & SCORING
  // ----------------------------------------------------
  console.log('\n--- [5/6] Quiz Submission & Grading APIs ---');
  let attemptId = null;

  try {
    // Provide answers (answer some right, some wrong deliberately to test weak areas)
    const answers = questions.map((q, idx) => ({
      question_id: q.id,
      selected_option: idx === 0 ? 'A' : idx === 1 ? 'B' : idx === 2 ? 'C' : 'D'
    }));

    const res = await fetch(`${BASE}/quizzes/${quizId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        time_taken_seconds: 52,
        answers
      })
    });
    const data = await res.json();
    attemptId = data.attempt?.id;
    assert(
      res.status === 200 && data.success && data.attempt && Array.isArray(data.breakdown),
      `POST /api/quizzes/:id/submit: Status 200, Graded score: ${data.attempt?.score}/${data.attempt?.total_questions} (${data.attempt?.accuracy_percentage}%)`
    );
  } catch (e) {
    assert(false, `POST /api/quizzes/:id/submit failed: ${e.message}`);
  }

  // 5.2 Get Attempt Results & Explanations
  try {
    const res = await fetch(`${BASE}/quizzes/${quizId}/attempts/${attemptId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const hasExplanations = data.breakdown?.every(b => b.explanation && b.correct_option);
    assert(
      res.status === 200 && data.success && hasExplanations,
      `GET /api/quizzes/:id/attempts/:attemptId: Status 200, returned full explanations for all ${data.breakdown?.length} questions`
    );
  } catch (e) {
    assert(false, `GET /api/quizzes/:id/attempts/:attemptId failed: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST GROUP 6: ANALYTICS & WEAK AREAS
  // ----------------------------------------------------
  console.log('\n--- [6/6] Analytics & Weak Areas APIs ---');

  // 6.1 Weak Areas
  try {
    const res = await fetch(`${BASE}/quizzes/weak-areas`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    assert(res.status === 200 && data.success && Array.isArray(data.weak_questions), `GET /api/quizzes/weak-areas: Status 200, identified ${data.count} question(s) for remediation`);
  } catch (e) {
    assert(false, `GET /api/quizzes/weak-areas failed: ${e.message}`);
  }

  // 6.2 Dashboard Analytics
  try {
    const res = await fetch(`${BASE}/analytics/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const validMetrics = 
      data.analytics?.total_notes >= 1 &&
      data.analytics?.total_quizzes >= 1 &&
      typeof data.analytics?.average_score_percentage === 'number';

    assert(
      res.status === 200 && data.success && validMetrics,
      `GET /api/analytics/dashboard: Status 200, calculated metrics (Notes: ${data.analytics?.total_notes}, Quizzes: ${data.analytics?.total_quizzes}, Avg: ${data.analytics?.average_score_percentage}%)`
    );
  } catch (e) {
    assert(false, `GET /api/analytics/dashboard failed: ${e.message}`);
  }

  console.log('\n====================================================');
  console.log(`🏁 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

testAllApis();
