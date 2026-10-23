import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { quizzesAPI } from '../services/api';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Lightbulb,
  RotateCcw,
  ArrowRight,
  Filter,
  LayoutDashboard,
  AlertTriangle,
  Loader2,
  BookOpen,
  Award,
  HelpCircle,
  Check,
  FileText
} from 'lucide-react';

export default function QuizResults() {
  const { quizId } = useParams();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'correct' | 'incorrect'

  useEffect(() => {
    async function loadResults() {
      if (!attemptId) {
        setError('No attempt ID provided in URL parameters.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await quizzesAPI.getAttemptResults(quizId, attemptId);
        if (res.success) {
          setData(res);
        } else {
          setError(res.message || 'Failed to fetch attempt results.');
        }
      } catch (err) {
        console.error('Results load error:', err);
        setError(err.response?.data?.message || 'Could not load quiz solutions.');
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, [quizId, attemptId]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  if (loading) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-bold text-slate-600">Grading & Generating Solution Explanations with Gemini...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-4">
        <XCircle className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="font-extrabold text-slate-900 text-base">Results Not Found</h3>
        <p className="text-xs text-rose-700">{error}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const { attempt, breakdown = [] } = data;
  const { score, total_questions, accuracy_percentage, time_taken_seconds, difficulty, note_title, quiz_type } = attempt;

  const correctCount = breakdown.filter((item) => item.is_correct).length;
  const incorrectCount = total_questions - correctCount;

  // Filtered list
  const filteredQuestions = breakdown.filter((item) => {
    if (activeFilter === 'correct') return item.is_correct;
    if (activeFilter === 'incorrect') return !item.is_correct;
    return true;
  });

  // Feedback message based on performance
  const getFeedbackMessage = () => {
    if (accuracy_percentage >= 90) {
      return {
        title: 'Mastery Achieved! 🌟',
        subtitle: 'Outstanding understanding of the study notes. Ready for the actual exam!',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      };
    }
    if (accuracy_percentage >= 70) {
      return {
        title: 'Strong Conceptual Grasp! 🎯',
        subtitle: 'Great performance. Review the solution feedback below to cement your recall.',
        color: 'text-indigo-700 bg-indigo-50 border-indigo-200'
      };
    }
    return {
      title: 'Targeted Review Recommended 📖',
      subtitle: 'Focus on the highlighted AI explanations and model answers below.',
      color: 'text-amber-800 bg-amber-50 border-amber-200'
    };
  };

  const feedback = getFeedbackMessage();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Scorecard Hero Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl shadow-slate-100 space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-100 text-center sm:text-left">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span
                className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-sm ${
                  difficulty === 'Easy'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : difficulty === 'Hard'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                    : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                }`}
              >
                {difficulty} Practice Exam
              </span>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-sm bg-indigo-50 text-indigo-700 border border-indigo-200">
                {quiz_type === 'theoretical' ? 'Theoretical' : quiz_type === 'mixed' ? 'Mixed Mode' : 'MCQ'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {note_title}
            </h1>
            <p className="text-xs text-slate-500">Auto-graded examination breakdown & AI analysis</p>
          </div>

          {/* Large Score Gauge */}
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 px-6 py-4 rounded-3xl">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex flex-col items-center justify-center shadow-md shadow-indigo-200">
              <span className="text-xl font-black">{accuracy_percentage}%</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-100">Score</span>
            </div>
            <div className="text-left space-y-0.5">
              <div className="text-lg font-black text-slate-900">
                {score} / {total_questions}
              </div>
              <div className="text-xs text-slate-500 font-medium">Points Earned</div>
            </div>
          </div>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-extrabold text-emerald-950">{correctCount} Questions</div>
              <div className="text-xs text-emerald-700 font-medium">Full Credit Awarded</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-extrabold text-rose-950">{incorrectCount} Questions</div>
              <div className="text-xs text-rose-700 font-medium">Missed / Review Needed</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200/70 text-slate-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-extrabold text-slate-900">{formatTimer(time_taken_seconds)}</div>
              <div className="text-xs text-slate-500 font-medium">Completion Time</div>
            </div>
          </div>
        </div>

        {/* Motivational Feedback Card */}
        <div className={`p-4 rounded-2xl border flex items-start gap-3 ${feedback.color}`}>
          <Trophy className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h3 className="font-extrabold text-sm">{feedback.title}</h3>
            <p className="text-xs leading-relaxed">{feedback.subtitle}</p>
          </div>
        </div>

        {/* Navigation Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to={`/quiz/${quizId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retake Exam</span>
            </Link>

            <Link
              to="/create"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm shadow-indigo-200 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create New Quiz</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* Solutions Review Header & Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Detailed Solution & Explanations
          </h2>
          <p className="text-xs text-slate-500">
            Learn why each choice was right or wrong with Gemini pedagogical analysis
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeFilter === 'all'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({total_questions})
          </button>
          <button
            onClick={() => setActiveFilter('correct')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeFilter === 'correct'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Correct ({correctCount})
          </button>
          <button
            onClick={() => setActiveFilter('incorrect')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeFilter === 'incorrect'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Incorrect ({incorrectCount})
          </button>
        </div>
      </div>

      {/* Question-by-Question Review List */}
      <div className="space-y-6">
        {filteredQuestions.map((q, idx) => {
          const isTheoretical = q.question_type === 'theoretical';
          const selected = q.selected_option;
          const correct = q.correct_option;
          const isUserCorrect = q.is_correct;
          const pointsEarned = Number(q.score_awarded || (isUserCorrect ? 1.0 : 0.0));

          return (
            <div
              key={q.question_id || idx}
              className={`bg-white rounded-3xl border p-6 sm:p-7 shadow-xs space-y-5 transition-all ${
                isUserCorrect
                  ? 'border-emerald-200/80 ring-1 ring-emerald-500/10'
                  : 'border-rose-200/80 ring-1 ring-rose-500/10'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Question {idx + 1}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isTheoretical ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                    {isTheoretical ? 'Theoretical' : 'MCQ'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isTheoretical && (
                    <span className="text-xs font-extrabold font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                      Points: {(pointsEarned * 100).toFixed(0)}%
                    </span>
                  )}

                  <span
                    className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                      isUserCorrect
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {isUserCorrect ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isTheoretical ? 'Accepted' : 'Correct'}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>{isTheoretical ? 'Revision Needed' : (selected ? 'Incorrect' : 'Unanswered')}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Question Prompt */}
              <div className="text-base font-bold text-slate-900 leading-relaxed">
                {q.question_text}
              </div>

              {/* Branch: Theoretical Review vs MCQ Options */}
              {isTheoretical ? (
                <div className="space-y-4">
                  {/* Student's Answer */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                      Your Submitted Answer:
                    </span>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                      {q.user_answer ? q.user_answer : <span className="italic text-slate-400">No answer submitted</span>}
                    </div>
                  </div>

                  {/* AI Grader Feedback */}
                  {q.ai_feedback && (
                    <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-purple-900 font-bold text-xs uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>AI Evaluator Feedback:</span>
                      </div>
                      <p className="text-xs sm:text-sm text-purple-950 font-medium leading-relaxed pl-5">
                        {q.ai_feedback}
                      </p>
                    </div>
                  )}

                  {/* Ideal Model Answer */}
                  {q.ideal_answer && (
                    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Ideal Model Answer:</span>
                      </div>
                      <p className="text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed pl-5">
                        {q.ideal_answer}
                      </p>
                    </div>
                  )}

                  {/* Key Points Evaluated */}
                  {q.key_points && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                      <span className="font-bold text-slate-600 block">Key Concepts Rubric:</span>
                      <p className="text-slate-600 pl-1">{q.key_points}</p>
                    </div>
                  )}
                </div>
              ) : (
                /* MCQ 4 Options with Visual Highlight */
                <div className="space-y-2.5">
                  {[
                    { letter: 'A', text: q.option_a },
                    { letter: 'B', text: q.option_b },
                    { letter: 'C', text: q.option_c },
                    { letter: 'D', text: q.option_d }
                  ].map((opt) => {
                    const isThisCorrect = opt.letter === correct;
                    const isThisSelected = opt.letter === selected;

                    let cardStyle = 'border-slate-200 bg-slate-50/50 text-slate-700';
                    let badgeStyle = 'bg-slate-100 text-slate-600 border-slate-200';

                    if (isThisCorrect) {
                      cardStyle = 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold';
                      badgeStyle = 'bg-emerald-600 text-white';
                    } else if (isThisSelected && !isUserCorrect) {
                      cardStyle = 'border-rose-400 bg-rose-50/80 text-rose-950 font-semibold';
                      badgeStyle = 'bg-rose-600 text-white';
                    }

                    return (
                      <div
                        key={opt.letter}
                        className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-colors ${cardStyle}`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${badgeStyle}`}
                        >
                          {opt.letter}
                        </div>

                        <div className="flex-1 pt-0.5 text-sm leading-normal">{opt.text}</div>

                        {isThisCorrect && (
                          <div className="shrink-0 flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Correct Answer</span>
                          </div>
                        )}

                        {isThisSelected && !isThisCorrect && (
                          <div className="shrink-0 flex items-center gap-1 text-[11px] font-extrabold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Your Choice</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* AI-Generated Explanation Box */}
              {q.explanation && (
                <div className="bg-indigo-50/60 rounded-2xl p-4 sm:p-5 border border-indigo-100 space-y-1.5">
                  <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs uppercase tracking-wider">
                    <Lightbulb className="w-4 h-4 text-amber-500 fill-amber-400" />
                    <span>AI Solution Explanation</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed pl-6 font-medium">
                    {q.explanation}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
