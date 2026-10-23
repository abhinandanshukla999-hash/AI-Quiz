import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { analyticsAPI } from '../services/api';
import {
  FileText,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Clock,
  RotateCcw,
  BookOpen,
  Calendar,
  Loader2,
  BarChart2
} from 'lucide-react';

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        const data = await analyticsAPI.getDashboardAnalytics();
        if (data.success) {
          setAnalytics(data.analytics);
        }
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
        setError('Could not load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  const formatSeconds = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Loading student analytics...</p>
      </div>
    );
  }

  const {
    total_notes = 0,
    total_quizzes = 0,
    average_score_percentage = 0,
    weak_questions_count = 0,
    recent_attempts = [],
    recent_notes = []
  } = analytics || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Learning Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track your mastery, review missed questions, and test your notes with AI
          </p>
        </div>

        <div className="flex items-center gap-3">
          {weak_questions_count > 0 && (
            <Link
              to="/weak-areas"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200/80 transition-all"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Practice {weak_questions_count} Weak Areas</span>
            </Link>
          )}

          <Link
            to="/create-quiz"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all active:scale-[0.99]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate New Quiz</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          {error}
        </div>
      )}

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Notes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Notes Uploaded
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{total_notes}</div>
          <p className="text-xs text-slate-500 mt-1">Ingested study materials</p>
        </div>

        {/* Quizzes Taken */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Quizzes Completed
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{total_quizzes}</div>
          <p className="text-xs text-slate-500 mt-1">Evaluated exam sessions</p>
        </div>

        {/* Average Accuracy */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Average Score
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <div className="text-3xl font-extrabold text-slate-900">{average_score_percentage}%</div>
            <span className="text-xs text-slate-400 font-medium">accuracy</span>
          </div>
          {/* Visual Mini Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                average_score_percentage >= 80
                  ? 'bg-emerald-500'
                  : average_score_percentage >= 60
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, average_score_percentage)}%` }}
            />
          </div>
        </div>

        {/* Weak Areas Count */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Weak Questions
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{weak_questions_count}</div>
          <div className="text-xs text-slate-500 mt-1">Concepts needing review</div>
        </div>
      </div>

      {/* Main Content Grid: Recent Attempts Table + Notes Library */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Attempts (2 columns on large screens) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-600" />
              <span>Recent Quiz Attempts</span>
            </h2>
          </div>

          {recent_attempts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">No quizzes completed yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Upload your lecture or study notes to generate your first auto-graded practice test!
              </p>
              <Link
                to="/create-quiz"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-xs"
              >
                Create Your First Quiz
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Note / Topic</th>
                      <th className="py-3.5 px-4">Difficulty</th>
                      <th className="py-3.5 px-4">Score</th>
                      <th className="py-3.5 px-4">Time</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recent_attempts.map((att) => (
                      <tr key={att.attempt_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-800 max-w-[180px] truncate">
                          {att.note_title}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              att.difficulty === 'Easy'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : att.difficulty === 'Hard'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            }`}
                          >
                            {att.difficulty}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900">
                              {att.score}/{att.total_questions}
                            </span>
                            <span
                              className={`text-[11px] font-bold ${
                                att.percentage >= 80
                                  ? 'text-emerald-600'
                                  : att.percentage >= 60
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              ({att.percentage}%)
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono">
                          {formatSeconds(att.time_taken_seconds)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {formatDate(att.attempted_at)}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                navigate(`/quiz/${att.quiz_id}/results?attemptId=${att.attempt_id}`)
                              }
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors"
                            >
                              Review Solutions
                            </button>
                            <button
                              onClick={() => navigate(`/quiz/${att.quiz_id}`)}
                              title="Retake Quiz"
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Notes Library (1 column on large screens) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <span>Notes Library</span>
            </h2>
            <Link
              to="/create-quiz"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
            >
              <span>+ Add Note</span>
            </Link>
          </div>

          {recent_notes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-2">
              <p className="text-xs text-slate-500">No study notes uploaded yet.</p>
              <Link
                to="/create-quiz"
                className="inline-block text-xs font-bold text-indigo-600 hover:underline"
              >
                Upload PDF, DOCX, or text notes
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-xs">
              {recent_notes.map((note) => (
                <div key={note.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <h4 className="font-bold text-slate-800 text-xs truncate">{note.title}</h4>
                      <p className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{note.character_count?.toLocaleString()} chars</span>
                        <span>•</span>
                        <span>{note.quizzes_count} quizzes created</span>
                      </p>
                    </div>

                    <button
                      onClick={() => navigate(`/create-quiz?noteId=${note.id}`)}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-[11px] font-bold transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>New Quiz</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
