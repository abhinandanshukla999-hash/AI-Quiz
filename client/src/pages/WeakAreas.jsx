import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { quizzesAPI } from '../services/api';
import {
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  BookOpen,
  Loader2,
  ArrowRight
} from 'lucide-react';

export default function WeakAreas() {
  const [weakQuestions, setWeakQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revealedIds, setRevealedIds] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchWeakAreas() {
      try {
        setLoading(true);
        const res = await quizzesAPI.getWeakAreas();
        if (res.success && res.weak_questions) {
          setWeakQuestions(res.weak_questions);
        }
      } catch (err) {
        console.error('Failed to load weak areas:', err);
        setError('Could not load missed questions. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchWeakAreas();
  }, []);

  const toggleReveal = (id) => {
    setRevealedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
        <p className="text-sm font-bold text-slate-600">Gathering your missed concepts...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Weak Areas & Missed Concepts
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Review every question you've answered incorrectly across all practice quizzes
          </p>
        </div>

        <Link
          to="/create-quiz"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>Generate New Quiz</span>
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
          {error}
        </div>
      )}

      {/* Zero Weak Questions Empty State */}
      {weakQuestions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm shadow-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-slate-900">Zero Weak Areas Detected!</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You either haven't missed any questions yet or have not completed any quizzes. Great job!
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/create-quiz"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
            >
              <span>Test Your Knowledge with a Quiz</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Found {weakQuestions.length} concept{weakQuestions.length === 1 ? '' : 's'} requiring reinforcement
          </div>

          {weakQuestions.map((q, idx) => {
            const isRevealed = revealedIds.includes(q.question_id);

            return (
              <div
                key={q.question_id || idx}
                className="bg-white rounded-3xl border border-rose-200/80 p-6 sm:p-7 shadow-xs space-y-5"
              >
                {/* Card Top Meta */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md truncate max-w-[200px]">
                      {q.note_title}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm ${
                        q.difficulty === 'Easy'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : q.difficulty === 'Hard'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                      }`}
                    >
                      {q.difficulty}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200/60">
                      Missed {q.times_missed} {q.times_missed === 1 ? 'time' : 'times'}
                    </span>
                    <button
                      onClick={() => navigate(`/quiz/${q.quiz_id}`)}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Retake Quiz Containing This Question"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <div className="text-base font-bold text-slate-900 leading-relaxed">
                  {q.question_text}
                </div>

                {/* Option Choices */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { letter: 'A', text: q.option_a },
                    { letter: 'B', text: q.option_b },
                    { letter: 'C', text: q.option_c },
                    { letter: 'D', text: q.option_d }
                  ].map((opt) => {
                    const isCorrect = isRevealed && opt.letter === q.correct_option;
                    return (
                      <div
                        key={opt.letter}
                        className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2.5 transition-colors ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                            : 'bg-slate-50/60 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-md text-[11px] font-black flex items-center justify-center shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {opt.letter}
                        </div>
                        <span className="pt-0.5 flex-1">{opt.text}</span>
                        {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>

                {/* Reveal Answer & Solution Toggle */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => toggleReveal(q.question_id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    {isRevealed ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide Solution Explanation</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Reveal Correct Answer & AI Explanation</span>
                      </>
                    )}
                  </button>

                  {/* Revealed Explanation Box */}
                  {isRevealed && (
                    <div className="mt-3 bg-indigo-50/70 rounded-2xl p-4 border border-indigo-100 space-y-1.5 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs uppercase tracking-wider">
                        <Lightbulb className="w-4 h-4 text-amber-500 fill-amber-400" />
                        <span>Explanation (Correct Option: {q.correct_option})</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium pl-6">
                        {q.explanation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
