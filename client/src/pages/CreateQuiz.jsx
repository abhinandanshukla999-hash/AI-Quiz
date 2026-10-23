import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { notesAPI, quizzesAPI } from '../services/api';
import {
  UploadCloud,
  FileText,
  FileCheck,
  Sparkles,
  Sliders,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Loader2,
  Trash2,
  BrainCircuit,
  Database,
  ArrowRight,
  Camera,
  Image as ImageIcon,
  RotateCcw,
  Check,
  X,
  FileCode,
  BookOpen
} from 'lucide-react';

export default function CreateQuiz() {
  const [searchParams] = useSearchParams();
  const preselectedNoteId = searchParams.get('noteId');
  const navigate = useNavigate();

  // Input Mode: 'file' | 'text' | 'existing'
  const [activeTab, setActiveTab] = useState(preselectedNoteId ? 'existing' : 'file');
  const [existingNotes, setExistingNotes] = useState([]);
  const [selectedExistingNoteId, setSelectedExistingNoteId] = useState(preselectedNoteId || '');

  // Form Fields
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [rawText, setRawText] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [quizType, setQuizType] = useState('mcq'); // 'mcq' | 'theoretical' | 'mixed'
  const [questionCount, setQuestionCount] = useState(10);

  // Drag and Drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Camera capture modal state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Generation status and staged progress
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0); 
  // 1: "Extracting text from notes / Transcribing photo..."
  // 2: "Generating exam questions with AI..."
  // 3: "Saving to database..."
  const [error, setError] = useState('');

  // Fetch existing notes on mount
  useEffect(() => {
    async function loadNotes() {
      try {
        const data = await notesAPI.getNotes();
        if (data.success && data.notes) {
          setExistingNotes(data.notes);
          if (preselectedNoteId) {
            setSelectedExistingNoteId(preselectedNoteId);
            setActiveTab('existing');
          }
        }
      } catch (err) {
        console.warn('Could not fetch existing notes library:', err);
      }
    }
    loadNotes();
  }, [preselectedNoteId]);

  // Cleanup object preview URL when file changes
  useEffect(() => {
    if (file && file.type?.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFilePreview(null);
    }
  }, [file]);

  // Statistics calculation for raw text
  const cleanText = rawText.trim();
  const characterCount = cleanText.length;
  const wordCount = cleanText.length > 0 ? cleanText.split(/\s+/).filter(Boolean).length : 0;
  const isTooShort = characterCount < 40; // Relaxed minimum
  const isTooLong = wordCount > 15000;

  // File Handlers
  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    setError('');

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    const validExtensions = ['.pdf', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.webp'];
    const fileName = selectedFile.name.toLowerCase();
    const isImage = selectedFile.type?.startsWith('image/');
    const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext)) || isImage;

    if (!hasValidExt) {
      setError('Invalid file format. Please upload PDF (.pdf), Word (.docx), Text (.txt), or Photos (.jpg, .jpeg, .png, .webp).');
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setError('File is too large. Maximum file upload limit is 15MB.');
      return;
    }

    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  // --- Real-time Camera Handlers ---
  const startCamera = async () => {
    setCameraError('');
    setIsCameraOpen(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your current browser.');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Environment camera failed, attempting user camera fallback:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setCameraStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackErr) {
        console.error('Camera access error:', fallbackErr);
        setCameraError(fallbackErr.message || 'Unable to access camera. Please check camera permissions.');
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setCameraError('');
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Failed to capture snapshot from camera.');
          return;
        }
        const snapFile = new File([blob], `captured_notes_${Date.now()}.jpg`, { type: 'image/jpeg' });
        validateAndSetFile(snapFile);
        stopCamera();
        setActiveTab('file');
      },
      'image/jpeg',
      0.95
    );
  };

  // Submit Handler
  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');

    // Pre-flight validation
    let noteIdToUse = null;

    if (activeTab === 'existing') {
      if (!selectedExistingNoteId) {
        setError('Please select a study note from your library.');
        return;
      }
      noteIdToUse = selectedExistingNoteId;
    } else if (activeTab === 'file') {
      if (!file) {
        setError('Please choose a file, photo of questions, or snap with your camera.');
        return;
      }
    } else if (activeTab === 'text') {
      if (isTooShort) {
        setError(`Note text is too short (${characterCount} characters). Minimum 40 characters required.`);
        return;
      }
      if (isTooLong) {
        setError(`Note text exceeds 15,000 words limit (${wordCount.toLocaleString()} words).`);
        return;
      }
    }

    try {
      setIsGenerating(true);

      // Step 1: Note Ingestion / Extraction (if not using existing)
      setGenerationStep(1);

      if (!noteIdToUse) {
        let uploadPayload;
        if (activeTab === 'file') {
          const formData = new FormData();
          formData.append('file', file);
          if (title.trim()) formData.append('title', title.trim());
          uploadPayload = formData;
        } else {
          uploadPayload = {
            title: title.trim() || undefined,
            text: rawText
          };
        }

        const noteResponse = await notesAPI.uploadNote(uploadPayload);
        if (!noteResponse.success || !noteResponse.note?.id) {
          throw new Error(noteResponse.message || 'Failed to process and ingest notes.');
        }
        noteIdToUse = noteResponse.note.id;
      }

      // Step 2: AI Question Generation with Selected Format
      setGenerationStep(2);
      const quizResponse = await quizzesAPI.generateQuiz({
        note_id: noteIdToUse,
        difficulty,
        count: Number(questionCount),
        quiz_type: quizType
      });

      // Step 3: Saving to database & redirect
      setGenerationStep(3);

      if (quizResponse.success && quizResponse.quiz?.id) {
        setTimeout(() => {
          navigate(`/quiz/${quizResponse.quiz.id}`);
        }, 600);
      } else {
        throw new Error(quizResponse.message || 'Quiz generation failed.');
      }
    } catch (err) {
      console.error('Quiz creation error:', err);
      const msg = err.response?.data?.message || err.message || 'Quiz generation encountered an error.';
      setError(msg);
      setIsGenerating(false);
      setGenerationStep(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hidden canvas for taking camera photo snapshots */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Multimodal AI Exam Generator</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Create Interactive Practice Quiz
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Upload documents, snap photos of physical notes, or test yourself with MCQs & Theoretical questions
        </p>
      </div>

      {/* Main Configuration Form Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-100 p-6 sm:p-8 space-y-8">
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Error generating quiz:</span>
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-8">
          {/* Section 1: Note Source */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Select Note / Document Source
              </label>

              {/* Source Switch Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('file');
                    setError('');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    activeTab === 'file'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  File & Photo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('text');
                    setError('');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    activeTab === 'text'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Paste Text
                </button>
                {existingNotes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('existing');
                      setError('');
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      activeTab === 'existing'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Notes Library ({existingNotes.length})
                  </button>
                )}
              </div>
            </div>

            {/* Note Title Input */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Note Title / Subject (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Organic Chemistry - Reaction Mechanisms or Physics Quiz"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 hover:bg-white"
              />
            </div>

            {/* TAB 1: File & Photo Drag & Drop + Live Camera Snap */}
            {activeTab === 'file' && (
              <div className="space-y-3">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-indigo-600 bg-indigo-50/50'
                      : file
                      ? 'border-emerald-300 bg-emerald-50/30'
                      : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,image/*"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />

                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      {filePreview ? (
                        <div className="relative group mb-2">
                          <img
                            src={filePreview}
                            alt="Uploaded notes preview"
                            className="w-32 h-32 object-cover rounded-2xl shadow-md border-2 border-white ring-2 ring-emerald-400"
                          />
                          <div className="absolute inset-0 bg-slate-900/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                            Click to change
                          </div>
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <FileCheck className="w-6 h-6" />
                        </div>
                      )}
                      
                      <div className="font-bold text-sm text-slate-800">{file.name}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI {filePreview ? 'Vision OCR & Extraction' : 'Parsing'}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove File</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center mb-1">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div className="text-sm font-bold text-slate-800">
                        Drag & Drop document or photo here or <span className="text-indigo-600 underline">browse files</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Supports PDF, Word (.docx), Text (.txt), and Images (.jpg, .jpeg, .png, .webp) up to 15MB
                      </p>
                    </div>
                  )}
                </div>

                {/* Real-time Camera Action Bar */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Have physical paper notes or whiteboard?</h4>
                      <p className="text-[11px] text-slate-500">Use your device camera to capture and transcribe instantly</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Snap Photo</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Paste Raw Notes */}
            {activeTab === 'text' && (
              <div className="space-y-2">
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste your lecture notes, summaries, or questions here (minimum 40 characters)..."
                  className="w-full p-4 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 hover:bg-white transition-colors"
                />
                <div className="flex items-center justify-between text-xs px-1">
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-mono font-medium ${
                        characterCount < 40 ? 'text-rose-600 font-bold' : 'text-slate-600'
                      }`}
                    >
                      {characterCount} chars (min 40)
                    </span>
                    <span>•</span>
                    <span
                      className={`font-mono font-medium ${
                        wordCount > 15000 ? 'text-rose-600 font-bold' : 'text-slate-600'
                      }`}
                    >
                      {wordCount.toLocaleString()} words (max 15,000)
                    </span>
                  </div>
                  {characterCount >= 40 && wordCount <= 15000 && (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Valid length
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Select From Existing Notes */}
            {activeTab === 'existing' && (
              <div className="space-y-2">
                <select
                  value={selectedExistingNoteId}
                  onChange={(e) => setSelectedExistingNoteId(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                >
                  <option value="">-- Choose an uploaded note from library --</option>
                  {existingNotes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title} ({n.character_count?.toLocaleString()} characters)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 px-1">
                  Re-use your previously uploaded notes to generate questions with customized theoretical or MCQ formats!
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Quiz Configuration & Question Format Liberty */}
          <div className="space-y-6 pt-6 border-t border-slate-200">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              2. Quiz Mode & Liberty Options
            </label>

            {/* Question Format / Style Selector (Liberty to test with theoretical / optional) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Question Format & Testing Liberty</span>
                <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  {quizType === 'mcq' ? 'Objective Practice' : quizType === 'theoretical' ? 'Conceptual & AI Graded' : 'Comprehensive Blend'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'mcq',
                    name: 'Multiple Choice (MCQ)',
                    badge: 'Standard Recall',
                    desc: '4 options (A, B, C, D) with instant scoring and explanation.',
                    icon: CheckCircle
                  },
                  {
                    id: 'theoretical',
                    name: 'Theoretical & Subjective',
                    badge: 'Deep Understanding',
                    desc: 'Type comprehensive open answers evaluated by AI rubric against key concepts.',
                    icon: BookOpen
                  },
                  {
                    id: 'mixed',
                    name: 'Mixed Practice (MCQ + Theory)',
                    badge: 'Ultimate Prep',
                    desc: 'Combined challenge of both multiple-choice and conceptual essays.',
                    icon: BrainCircuit
                  }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = quizType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setQuizType(item.id)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900">{item.name}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty Selector Pills */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-600">Cognitive Difficulty Level</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    level: 'Easy',
                    tag: 'Foundational Recall',
                    desc: 'Direct definitions, key terms, and core facts directly stated.'
                  },
                  {
                    level: 'Medium',
                    tag: 'Conceptual Application',
                    desc: 'Applying principles, cause & effect, and comparing related topics.'
                  },
                  {
                    level: 'Hard',
                    tag: 'Critical Analysis',
                    desc: 'Complex reasoning, multi-concept synthesis, edge cases & scenarios.'
                  }
                ].map((item) => (
                  <button
                    key={item.level}
                    type="button"
                    onClick={() => setDifficulty(item.level)}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      difficulty === item.level
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-sm text-slate-900">{item.level}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                          item.level === 'Easy'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.level === 'Hard'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Total Questions to Generate</span>
                <span className="text-sm font-extrabold text-indigo-700 font-mono">
                  {questionCount} Questions
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuestionCount(num)}
                    className={`py-2.5 rounded-xl border font-bold text-xs transition-all ${
                      questionCount === num
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {num} Questions
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-extrabold text-sm sm:text-base shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing Notes & Generating Quiz...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate AI Practice Quiz ({quizType.toUpperCase()})</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Real-time Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 rounded-3xl border border-slate-800 max-w-xl w-full p-6 shadow-2xl space-y-4 text-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Real-time Document Camera</h3>
                  <p className="text-[11px] text-slate-400">Position your physical notes or exam paper within view</p>
                </div>
              </div>

              <button
                type="button"
                onClick={stopCamera}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Viewfinder with viewfinder overlay */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center border border-slate-800">
              {cameraError ? (
                <div className="p-6 text-center space-y-2">
                  <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                  <p className="text-xs text-rose-400 font-semibold">{cameraError}</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-bold hover:bg-indigo-700"
                  >
                    Retry Camera
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Framing Guide Lines */}
                  <div className="absolute inset-6 border-2 border-dashed border-white/50 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                    <div className="flex justify-between text-[10px] uppercase font-mono tracking-widest text-white/70">
                      <span>DOC SCANNER</span>
                      <span>READY</span>
                    </div>
                    <div className="text-center text-[11px] text-white/90 bg-black/40 backdrop-blur-xs py-1 px-3 rounded-full mx-auto font-medium">
                      Ensure good lighting & hold document still
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Camera Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!!cameraError}
                onClick={capturePhoto}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-extrabold shadow-lg shadow-indigo-600/40 transition-all disabled:opacity-50"
              >
                <div className="w-3.5 h-3.5 rounded-full bg-white" />
                <span>Capture Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Staged Loading Modal during generation */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-8 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-200 animate-pulse">
              <BrainCircuit className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-900">Crafting Your Practice Exam</h3>
              <p className="text-xs text-slate-500">
                Please wait while Gemini analyzes your content and crafts questions
              </p>
            </div>

            {/* Stepped Progress Checklist */}
            <div className="space-y-3 text-left bg-slate-50 p-4 rounded-2xl border border-slate-200">
              {/* Step 1 */}
              <div className="flex items-center gap-3">
                {generationStep > 1 ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : generationStep === 1 ? (
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                )}
                <span
                  className={`text-xs font-semibold ${
                    generationStep >= 1 ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {file && file.type?.startsWith('image/')
                    ? 'Transcribing photo using Gemini Multimodal Vision...'
                    : 'Extracting and parsing study notes...'}
                </span>
              </div>

              {/* Step 2 */}
              <div className="flex items-center gap-3">
                {generationStep > 2 ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : generationStep === 2 ? (
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                )}
                <span
                  className={`text-xs font-semibold ${
                    generationStep >= 2 ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  Generating {quizType === 'mcq' ? 'MCQ questions' : quizType === 'theoretical' ? 'theoretical & conceptual questions' : 'mixed MCQ & essay questions'}...
                </span>
              </div>

              {/* Step 3 */}
              <div className="flex items-center gap-3">
                {generationStep >= 3 ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                )}
                <span
                  className={`text-xs font-semibold ${
                    generationStep >= 3 ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  Saving exam to your account...
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
