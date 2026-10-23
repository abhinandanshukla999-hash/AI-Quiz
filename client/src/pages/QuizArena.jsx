import React, { useReducer, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { quizzesAPI } from '../services/api';
import {
  Clock,
  CheckCircle,
  Flag,
  ArrowLeft,
  ArrowRight,
  Send,
  RotateCcw,
  AlertCircle,
  Loader2,
  BookmarkCheck,
  Check,
  X,
  BookOpen,
  Sparkles,
  PenTool
} from 'lucide-react';

// Initial state for Quiz Arena Reducer
const initialState = {
  quiz: null,
  questions: [],
  currentIndex: 0,
  answers: {}, // { [questionId]: 'A' | 'B' | 'C' | 'D' | string (for theoretical) }
  markedForReview: [], // array of questionIds
  secondsElapsed: 0,
  status: 'loading', // 'loading' | 'active' | 'submitting' | 'error'
  errorMessage: '',
  showSubmitModal: false
};

function quizReducer(state, action) {
  switch (action.type) {
    case 'FETCH_SUCCESS':
      return {
        ...state,
        quiz: action.payload.quiz,
        questions: action.payload.quiz.questions || [],
        status: 'active',
        currentIndex: 0,
        errorMessage: ''
      };
    case 'FETCH_ERROR':
      return {
        ...state,
        status: 'error',
        errorMessage: action.payload
      };
    case 'SET_CURRENT_INDEX':
      return {
        ...state,
        currentIndex: action.payload
      };
    case 'SELECT_OPTION': {
      const { questionId, option } = action.payload;
      return {
        ...state,
        answers: {
          ...state.answers,
          [questionId]: option
        }
      };
    }
    case 'SET_THEORETICAL_ANSWER': {
      const { questionId, text } = action.payload;
      return {
        ...state,
        answers: {
          ...state.answers,
          [questionId]: text
        }
      };
    }
    case 'CLEAR_RESPONSE': {
      const { questionId } = action.payload;
      const nextAnswers = { ...state.answers };
      delete nextAnswers[questionId];
      return {
        ...state,
        answers: nextAnswers
      };
    }
    case 'TOGGLE_MARK_REVIEW': {
      const { questionId } = action.payload;
      const exists = state.markedForReview.includes(questionId);
      return {
        ...state,
        markedForReview: exists
          ? state.markedForReview.filter((id) => id !== questionId)
          : [...state.markedForReview, questionId]
      };
    }
    case 'TICK_TIMER':
      return {
        ...state,
        secondsElapsed: state.secondsElapsed + 1
      };
    case 'OPEN_SUBMIT_MODAL':
      return {
        ...state,
        showSubmitModal: true
      };
    case 'CLOSE_SUBMIT_MODAL':
      return {
        ...state,
        showSubmitModal: false
      };
    case 'START_SUBMITTING':
      return {
        ...state,
        status: 'submitting'
      };
    default:
      return state;
  }
}

export default function QuizArena() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(quizReducer, initialState);

  // Fetch Quiz details on mount
  useEffect(() => {
    async function loadQuiz() {
      try {
        const data = await quizzesAPI.getQuizById(quizId);
        if (data.success && data.quiz) {
          dispatch({ type: 'FETCH_SUCCESS', payload: data });
        } else {
          dispatch({ type: 'FETCH_ERROR', payload: data.message || 'Failed to load exam.' });
        }
      } catch (err) {
        console.error('Quiz load error:', err);
        const msg = err.response?.data?.message || 'Could not load quiz questions.';
        dispatch({ type: 'FETCH_ERROR', payload: msg });
      }
    }

    loadQuiz();
  }, [quizId]);

  // Live Timer Interval
  useEffect(() => {
    if (state.status !== 'active') return;
    const interval = setInterval(() => {
      dispatch({ type: 'TICK_TIMER' });
    }, 1000);
    return () => clearInterval(interval);
  }, [state.status]);

  const currentQuestion = state.questions[state.currentIndex];
  const totalQuestions = state.questions.length;
  const currentQuestionId = currentQuestion?.id;
  const isTheoretical = currentQuestion?.question_type === 'theoretical';
  const currentAnswer = currentQuestionId ? state.answers[currentQuestionId] || '' : '';
  const selectedOption = !isTheoretical ? currentAnswer : null;
  const isMarked = currentQuestionId ? state.markedForReview.includes(currentQuestionId) : false;

  // Question Answered Checker
  const isQuestionAnswered = (q) => {
    const ans = state.answers[q.id];
    if (ans === undefined || ans === null) return false;
    if (q.question_type === 'theoretical') {
      return typeof ans === 'string' && ans.trim().length > 0;
    }
    return Boolean(ans);
  };

  const answeredCount = state.questions.filter(isQuestionAnswered).length;
  const markedCount = state.markedForReview.length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  // Keyboard shortcut listener for MCQ 1-4, A-D, Next, Prev, Mark
  useEffect(() => {
    if (state.status !== 'active' || !currentQuestionId) return;

    const handleKeyDown = (e) => {
      // Ignore if user is currently typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const key = e.key.toUpperCase();

      if (!isTheoretical) {
        if (key === '1' || key === 'A') {
          dispatch({ type: 'SELECT_OPTION', payload: { questionId: currentQuestionId, option: 'A' } });
        } else if (key === '2' || key === 'B') {
          dispatch({ type: 'SELECT_OPTION', payload: { questionId: currentQuestionId, option: 'B' } });
        } else if (key === '3' || key === 'C') {
          dispatch({ type: 'SELECT_OPTION', payload: { questionId: currentQuestionId, option: 'C' } });
        } else if (key === '4' || key === 'D') {
          dispatch({ type: 'SELECT_OPTION', payload: { questionId: currentQuestionId, option: 'D' } });
        }
      }

      if (key === 'M') {
        dispatch({ type: 'TOGGLE_MARK_REVIEW', payload: { questionId: currentQuestionId } });
      } else if (e.key === 'ArrowRight' && state.currentIndex < totalQuestions - 1) {
        dispatch({ type: 'SET_CURRENT_INDEX', payload: state.currentIndex + 1 });
      } else if (e.key === 'ArrowLeft' && state.currentIndex > 0) {
        dispatch({ type: 'SET_CURRENT_INDEX', payload: state.currentIndex - 1 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.status, currentQuestionId, state.currentIndex, totalQuestions, isTheoretical]);

  // Submit Quiz Handler
  const handleSubmitQuiz = async () => {
    try {
      dispatch({ type: 'START_SUBMITTING' });

      // Build payload matching backend expectations for both MCQ and Theoretical
      const payloadAnswers = state.questions.map((q) => {
        const rawAns = state.answers[q.id];
        const isTheo = q.question_type === 'theoretical';
        return {
          question_id: q.id,
          selected_option: !isTheo ? (rawAns || null) : null,
          user_answer: isTheo ? (rawAns ? String(rawAns).trim() : '') : null
        };
      });

      const res = await quizzesAPI.submitQuiz(quizId, {
        time_taken_seconds: state.secondsElapsed,
        answers: payloadAnswers
      });

      if (res.success && res.attempt?.id) {
        navigate(`/quiz/${quizId}/results?attemptId=${res.attempt.id}`);
      } else {
        throw new Error(res.message || 'Submission failed.');
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert(err.response?.data?.message || 'Failed to submit exam. Please try again.');
      dispatch({ type: 'FETCH_SUCCESS', payload: { quiz: state.quiz } });
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (state.status === 'loading') {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-bold text-slate-600">Initializing Exam Arena...</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="max-w-md mx-auto my-16 p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="font-extrabold text-slate-900 text-base">Quiz Not Found</h3>
        <p className="text-xs text-rose-700">{state.errorMessage}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Bar: Exam Title, Live Timer, Progress Bar, Submit Button */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 truncate max-w-xs sm:max-w-md">
                {state.quiz?.note_title}
              </h1>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm ${
                  state.quiz?.difficulty === 'Easy'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : state.quiz?.difficulty === 'Hard'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                    : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                }`}
              >
                {state.quiz?.difficulty}
              </span>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-sm bg-indigo-50 text-indigo-700 border border-indigo-200">
                {state.quiz?.quiz_type === 'theoretical' ? 'Theoretical Exam' : state.quiz?.quiz_type === 'mixed' ? 'Mixed Exam' : 'MCQ Exam'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Exam Mode • Anti-Cheat Solution Shielded</p>
          </div>
        </div>

        {/* Center: Live Timer & Progress */}
        <div className="flex items-center gap-6">
          {/* Timer */}
          <div className="flex items-center gap-2 bg-slate-100/80 border border-slate-200 px-3.5 py-1.5 rounded-xl font-mono text-sm font-bold text-slate-800">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>{formatTimer(state.secondsElapsed)}</span>
          </div>

          {/* Progress Indicator */}
          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="text-xs font-bold text-slate-700">
              {answeredCount} of {totalQuestions} answered
            </div>
            <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / (totalQuestions || 1)) * 100}%` }}
              />
            </div>
          </div>

          {/* Submit Exam Button */}
          <button
            onClick={() => dispatch({ type: 'OPEN_SUBMIT_MODAL' })}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-extrabold shadow-sm shadow-emerald-200 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit Exam</span>
          </button>
        </div>
      </div>

      {/* Split Layout: Left/Main Panel (Question Card) + Right Sidebar (Palette) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left/Main Panel (3 Columns on Large Screens) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            {/* Question Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-extrabold text-xs flex items-center justify-center">
                  {state.currentIndex + 1}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Question {state.currentIndex + 1} of {totalQuestions}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isTheoretical ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                  {isTheoretical ? 'Theoretical' : 'MCQ'}
                </span>
              </div>

              {/* Mark for Review Toggle Button */}
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'TOGGLE_MARK_REVIEW',
                    payload: { questionId: currentQuestionId }
                  })
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  isMarked
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                <Flag className={`w-3.5 h-3.5 ${isMarked ? 'fill-purple-600' : ''}`} />
                <span>{isMarked ? 'Marked for Review' : 'Mark for Review'}</span>
              </button>
            </div>

            {/* Question Text */}
            <div className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
              {currentQuestion?.question_text}
            </div>

            {/* Branch: Either Theoretical Rich Textarea OR MCQ 4-Option Cards */}
            {isTheoretical ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                    <BookOpen className="w-3.5 h-3.5" />
                    Subjective Response Area
                  </span>
                  <span className="font-mono text-slate-500">
                    {currentAnswer.length} chars • {currentAnswer.trim() ? currentAnswer.trim().split(/\s+/).filter(Boolean).length : 0} words
                  </span>
                </div>

                <textarea
                  rows={8}
                  value={currentAnswer}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_THEORETICAL_ANSWER',
                      payload: { questionId: currentQuestionId, text: e.target.value }
                    })
                  }
                  placeholder="Type your detailed explanation and answers here. Be comprehensive—Gemini AI Grader will review conceptual understanding, reasoning, and key terminology against the ideal model answer..."
                  className="w-full p-4 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 hover:bg-white transition-colors leading-relaxed"
                />

                <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-900">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>AI Rubric Advice:</strong> Make sure to explain the "why" and "how". Partial credit is awarded based on key concepts accurately articulated in your response.
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {[
                  { letter: 'A', text: currentQuestion?.option_a },
                  { letter: 'B', text: currentQuestion?.option_b },
                  { letter: 'C', text: currentQuestion?.option_c },
                  { letter: 'D', text: currentQuestion?.option_d }
                ].map((opt) => {
                  const isSelected = selectedOption === opt.letter;
                  return (
                    <button
                      key={opt.letter}
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: 'SELECT_OPTION',
                          payload: { questionId: currentQuestionId, option: opt.letter }
                        })
                      }
                      className={`w-full p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {opt.letter}
                      </div>

                      <div className="flex-1 pt-1 text-sm font-semibold text-slate-800 leading-normal">
                        {opt.text}
                      </div>

                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Question Actions Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={state.currentIndex === 0}
                  onClick={() =>
                    dispatch({ type: 'SET_CURRENT_INDEX', payload: state.currentIndex - 1 })
                  }
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                {Boolean(currentAnswer) && (
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: 'CLEAR_RESPONSE',
                        payload: { questionId: currentQuestionId }
                      })
                    }
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear Response</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {state.currentIndex < totalQuestions - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: 'SET_CURRENT_INDEX', payload: state.currentIndex + 1 })
                    }
                    className="flex items-center gap-1 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
                  >
                    <span>Next Question</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'OPEN_SUBMIT_MODAL' })}
                    className="flex items-center gap-1 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Finish Exam</span>
                  </button>
                )}
              </div>
            </div>

            {/* Keyboard Shortcuts Hint Bar (for MCQ) */}
            {!isTheoretical && (
              <div className="hidden md:flex items-center justify-center gap-4 text-[11px] text-slate-400 pt-2 border-t border-slate-50 font-mono">
                <span>Keys <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-slate-600">A-D</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-slate-600">1-4</kbd> select option</span>
                <span>•</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-slate-600">M</kbd> flag for review</span>
                <span>•</span>
                <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-slate-600">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-slate-600">→</kbd> navigate</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Question Palette (1 Column on Large Screens) */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Question Palette
            </h3>

            {/* Grid of Numbered Question Buttons */}
            <div className="grid grid-cols-5 gap-2">
              {state.questions.map((q, idx) => {
                const isCurrent = idx === state.currentIndex;
                const isAnswered = isQuestionAnswered(q);
                const isFlagged = state.markedForReview.includes(q.id);
                const isQTheo = q.question_type === 'theoretical';

                let buttonClass = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';

                if (isFlagged && isAnswered) {
                  buttonClass = 'bg-purple-600 text-white border-purple-600 ring-2 ring-emerald-400';
                } else if (isFlagged) {
                  buttonClass = 'bg-purple-500 text-white border-purple-500';
                } else if (isAnswered) {
                  buttonClass = 'bg-emerald-600 text-white border-emerald-600';
                }

                if (isCurrent) {
                  buttonClass += ' ring-3 ring-indigo-500 ring-offset-2 font-black scale-105';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => dispatch({ type: 'SET_CURRENT_INDEX', payload: idx })}
                    className={`relative h-9 rounded-xl border text-xs font-extrabold flex items-center justify-center transition-all ${buttonClass}`}
                  >
                    <span>{idx + 1}</span>
                    {isQTheo && (
                      <span className="absolute top-0.5 right-1 text-[8px] font-black opacity-75">T</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Palette Legend */}
            <div className="pt-3 border-t border-slate-100 space-y-2 text-[11px] font-semibold text-slate-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-md bg-emerald-600" />
                  <span>Answered</span>
                </div>
                <span className="font-mono font-bold text-slate-800">{answeredCount}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-md bg-purple-500" />
                  <span>Marked for Review</span>
                </div>
                <span className="font-mono font-bold text-slate-800">{markedCount}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-300" />
                  <span>Unanswered</span>
                </div>
                <span className="font-mono font-bold text-slate-800">{unansweredCount}</span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="font-bold">Note:</span>
                <span>Buttons marked with "T" denote theoretical essay questions.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal Before Submission */}
      {state.showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">Submit Exam for Grading?</h3>
              <p className="text-xs text-slate-500">
                Your responses will be graded by Gemini AI against the official rubric and model answers.
              </p>
            </div>

            {/* Submission Status Summary Box */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs font-semibold">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Total Questions:</span>
                <span className="font-bold text-slate-800">{totalQuestions}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-emerald-700">Answered Questions:</span>
                <span className="font-bold text-emerald-700">{answeredCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-purple-700">Marked for Review:</span>
                <span className="font-bold text-purple-700">{markedCount}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-rose-700">Unanswered Questions:</span>
                <span className="font-bold text-rose-700">{unansweredCount}</span>
              </div>
            </div>

            {unansweredCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>You have {unansweredCount} unanswered questions. They will receive 0 marks.</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => dispatch({ type: 'CLOSE_SUBMIT_MODAL' })}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Keep Practicing
              </button>
              <button
                type="button"
                disabled={state.status === 'submitting'}
                onClick={handleSubmitQuiz}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {state.status === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Grading with AI...</span>
                  </>
                ) : (
                  <span>Confirm & Submit</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
