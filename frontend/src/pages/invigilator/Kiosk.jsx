import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, ShieldCheck, User, CreditCard, FileText,
  CheckCircle, XCircle, RefreshCcw, Loader2, Scan,
  AlertTriangle, ChevronRight, Clock, Zap, Eye,
  Activity, BarChart3, ThumbsUp, ThumbsDown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { verificationApi, logisticsApi } from '../../services/api';

const STEPS = [
  { id: 1, name: 'Ready',      desc: 'Initialize verification', icon: Zap },
  { id: 2, name: 'Face Scan',  desc: 'Biometric face match',    icon: User },
  { id: 3, name: 'Admit Card', desc: 'OCR document scan',       icon: FileText },
  { id: 4, name: 'ID Card',    desc: 'Photo ID verification',   icon: CreditCard },
  { id: 5, name: 'Result',     desc: 'Verification complete',   icon: ShieldCheck },
];

// Confidence bar component
const ScoreBar = ({ label, score, color = 'indigo' }) => {
  const pct = Math.min(Math.max(score || 0, 0), 100);
  const colorMap = {
    indigo: 'from-indigo-500 to-violet-500',
    green:  'from-emerald-500 to-teal-500',
    amber:  'from-amber-500 to-orange-500',
    rose:   'from-rose-500 to-red-500',
    sky:    'from-sky-500 to-blue-500',
  };
  const barColor = pct >= 85 ? 'green' : pct >= 68 ? 'amber' : 'rose';
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className={`text-[10px] font-black ${pct >= 85 ? 'text-emerald-400' : pct >= 68 ? 'text-amber-400' : 'text-rose-400'}`}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${colorMap[barColor]} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const Kiosk = () => {
  const [step, setStep]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');
  const [examId, setExamId]     = useState(null);
  const [exams, setExams]       = useState([]);
  const [intermediate, setIntermediate] = useState({});

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    logisticsApi.getExams()
      .then(res => {
        setExams(res.data);
        if (res.data.length > 0) setExamId(res.data[0].id);
      })
      .catch(() => {});
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setError('Camera access denied. Check browser permissions.');
    }
  };

  useEffect(() => {
    if (step >= 2 && step <= 4) startCamera();
    else stopCamera();
    return stopCamera;
  }, [step]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return '';
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  };

  const captureAndAdvance = async () => {
    if (!examId) { alert('Please select an ongoing exam first.'); return; }
    const b64 = capturePhoto();
    setLoading(true);
    setError('');

    try {
      if (step === 2) {
        const res = await verificationApi.verifyFace({ exam_id: examId, face_image_b64: b64 });
        setIntermediate(res.data);
        setStep(3);
      } else if (step === 3) {
        const res = await verificationApi.verifyAdmit({ student_id: intermediate.student_id, admit_card_b64: b64 });
        setIntermediate(prev => ({ ...prev, ...res.data }));
        setStep(4);
      } else if (step === 4) {
        stopCamera();
        setStep(5);
        const res = await verificationApi.verifyId({
          exam_id: examId,
          student_id: intermediate.student_id,
          id_card_b64: b64,
          face_score: intermediate.face_score,
          liveness_score: intermediate.liveness_score,
          enrollment_score: intermediate.enrollment_score,
          name_score: intermediate.name_score,
          father_name_score: intermediate.father_name_score
        });
        setResult(res.data);
        if (res.data.verified && res.data.decision === 'AUTO_APPROVE') {
          confetti({
            particleCount: 130,
            spread: 80,
            origin: { y: 0.5 },
            colors: ['#6366f1', '#10b981', '#f59e0b']
          });
        }
      }
    } catch (err) {
      stopCamera();
      setStep(5);
      const detail = err.response?.data?.detail || 'Verification failed.';
      setError(detail);
      setResult({ verified: false, decision: 'REJECT' });
    } finally {
      setLoading(false);
    }
  };

  const resetKiosk = () => {
    setStep(1);
    setResult(null);
    setError('');
    setLoading(false);
    setIntermediate({});
    stopCamera();
  };

  const isManualReview = result?.decision === 'MANUAL_REVIEW';

  return (
    <div className="min-h-[calc(100vh-4rem)] animate-fade-slide">
      <canvas ref={canvasRef} hidden />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Kiosk Active</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Entry Verification Terminal</h1>
          <p className="text-sm text-slate-400 mt-0.5">Face + Admit Card + ID Card — AI confidence scoring</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="seas-input py-1.5 text-xs w-56"
            value={examId || ''}
            onChange={e => setExamId(parseInt(e.target.value))}
          >
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.subject_code} — {e.subject_name}</option>
            ))}
            {exams.length === 0 && <option>No exams scheduled</option>}
          </select>
          <button onClick={resetKiosk} className="btn-secondary text-xs py-2">
            <RefreshCcw size={13} /> Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Step tracker */}
        <div className="lg:col-span-3 space-y-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-3">Verification Steps</p>
          {STEPS.map(s => {
            const Icon    = s.icon;
            const isActive = step === s.id;
            const isDone   = step > s.id;
            return (
              <div key={s.id} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300 ${
                isActive ? 'bg-indigo-500/10 border-indigo-500/30 shadow-lg shadow-indigo-500/5' :
                isDone   ? 'bg-emerald-500/5 border-emerald-500/20' :
                           'bg-white/[0.02] border-white/[0.05] opacity-60'
              }`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isActive ? 'bg-indigo-500 shadow-lg shadow-indigo-500/30' :
                  isDone   ? 'bg-emerald-500/20' : 'bg-white/[0.05]'
                }`}>
                  {isDone ? <CheckCircle size={15} className="text-emerald-400" /> :
                            <Icon size={15} className={isActive ? 'text-white' : 'text-slate-500'} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isActive ? 'text-white' : isDone ? 'text-emerald-400' : 'text-slate-500'}`}>{s.name}</p>
                  <p className="text-[10px] text-slate-600">{s.desc}</p>
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* Main panel */}
        <div className="lg:col-span-9">
          <div className="glass-card overflow-hidden min-h-[520px] flex flex-col">
            {/* Progress bar */}
            <div className="w-full h-1 bg-white/[0.05]">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                style={{ width: `${Math.min(((step - 1) / 4) * 100, 100)}%` }}
              />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-10">

              {/* STEP 1: Ready */}
              {step === 1 && (
                <div className="text-center max-w-md animate-fade-slide">
                  <div className="relative w-32 h-32 mx-auto mb-8">
                    <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-pulse" />
                    <div className="w-32 h-32 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center relative">
                      <Scan size={48} className="text-indigo-400" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Ready to Verify</h2>
                  <p className="text-slate-400 mb-3 leading-relaxed">
                    3-step AI verification: <strong className="text-white">Face</strong> →{' '}
                    <strong className="text-white">Admit Card OCR</strong> →{' '}
                    <strong className="text-white">ID Card</strong>
                  </p>
                  <p className="text-[11px] text-slate-600 mb-8">
                    System performs liveness detection, field-level OCR extraction, fuzzy name/enrollment matching, and confidence scoring.
                  </p>
                  <button id="start-scan-btn" onClick={() => setStep(2)} className="btn-primary text-base px-10 py-4 shadow-2xl shadow-indigo-500/20">
                    <Zap size={18} /> Start Verification
                  </button>
                </div>
              )}

              {/* STEPS 2–4: Camera */}
              {step >= 2 && step <= 4 && (
                <div className="w-full max-w-2xl animate-fade-slide">
                  <div className="text-center mb-5">
                    <p className="text-sm font-semibold text-slate-300 mb-1">
                      Step {step - 1} of 3 —{' '}
                      {step === 2 ? '🔬 Face Biometric + Liveness' :
                       step === 3 ? '📄 Admit Card OCR Scan' : '🪪 Photo ID Card Scan'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {step === 2 ? 'Look directly at camera. System checks liveness automatically.' :
                       step === 3 ? 'Hold admit card clearly — face the printed text toward camera.' :
                                    'Hold college ID card facing the camera.'}
                    </p>
                  </div>

                  <div className="relative w-full rounded-2xl overflow-hidden bg-black border border-white/[0.08] shadow-2xl">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent z-20 shadow-[0_0_12px_rgba(99,102,241,0.8)] animate-scan-line" />
                    <video
                      ref={videoRef}
                      autoPlay playsInline muted
                      className="w-full aspect-video object-cover"
                    />
                    {/* Guide overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {step === 2
                        ? <div className="w-56 h-72 border-2 border-dashed border-indigo-400/40 rounded-full" />
                        : <div className="w-4/5 h-3/5 border-2 border-dashed border-amber-400/40 rounded-2xl" />}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-5 z-20 flex items-center justify-center">
                      <button
                        id="capture-btn"
                        onClick={captureAndAdvance}
                        disabled={loading}
                        className="w-16 h-16 bg-white hover:bg-indigo-50 active:scale-95 rounded-full shadow-2xl flex items-center justify-center transition-all disabled:opacity-50"
                      >
                        {loading ? <Loader2 size={28} className="text-slate-900 animate-spin" /> : <Camera size={28} className="text-slate-900" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Result */}
              {step === 5 && (
                <div className="w-full max-w-xl animate-fade-slide">
                  {loading ? (
                    <div className="text-center py-12">
                      <Loader2 size={48} className="text-indigo-500 animate-spin mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-white mb-2">AI Engine Processing...</h3>
                      <div className="space-y-2 text-xs text-slate-500 mt-4">
                        <p>⚡ Running liveness detection</p>
                        <p>🔬 Extracting OCR fields from admit card</p>
                        <p>🧠 Computing confidence scores</p>
                        <p>✅ Cross-matching identity data</p>
                      </div>
                    </div>

                  ) : result?.verified && result?.decision === 'AUTO_APPROVE' ? (
                    <div className="space-y-4">
                      {/* Success banner */}
                      <div className="flex items-center gap-4 p-5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl">
                        <CheckCircle size={40} className="text-emerald-500 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">AUTO APPROVED</p>
                          <h3 className="text-xl font-bold text-white">{result.student_name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{result.branch} · Sem {result.semester}</p>
                          {result.father_name && <p className="text-[10px] text-slate-600 mt-0.5">F/O {result.father_name}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black text-emerald-400">{result.final_confidence}%</p>
                          <p className="text-[10px] text-slate-500">Overall Confidence</p>
                        </div>
                      </div>

                      {/* Confidence breakdown */}
                      {result.component_scores && (
                        <div className="glass-card p-4 space-y-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <BarChart3 size={11} /> Confidence Breakdown
                          </p>
                          <ScoreBar label="Face Biometric" score={result.component_scores.face_score} />
                          <ScoreBar label="Enrollment Match" score={result.component_scores.enrollment_score} />
                          <ScoreBar label="Name Match (OCR)" score={result.component_scores.name_score} />
                          <ScoreBar label="Father Name Match" score={result.component_scores.father_name_score} />
                          <ScoreBar label="ID Card Cross-Match" score={result.component_scores.id_score} />
                          <ScoreBar label="Liveness Score" score={result.component_scores.liveness_score} />
                        </div>
                      )}

                      {/* Seat info */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="glass p-4 rounded-xl text-center">
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Enrollment</p>
                          <p className="text-sm font-bold text-white font-mono">{result.enrollment_no}</p>
                        </div>
                        <div className="glass p-4 rounded-xl border-indigo-500/20 bg-indigo-500/5 text-center">
                          <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider mb-1">Room</p>
                          <p className="text-3xl font-black text-white">{result.room}</p>
                        </div>
                        <div className="glass p-4 rounded-xl border-violet-500/20 bg-violet-500/5 text-center">
                          <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider mb-1">Seat</p>
                          <p className="text-3xl font-black text-white">{result.seat}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-600 px-1">
                        <span>⏱ {result.processing_time_ms}ms processing time</span>
                        <span>✅ Attendance marked automatically</span>
                      </div>

                      <button id="next-student-btn" onClick={resetKiosk} className="btn-primary w-full justify-center py-4">
                        Verify Next Student <RefreshCcw size={14} className="ml-2" />
                      </button>
                    </div>

                  ) : result?.decision === 'MANUAL_REVIEW' ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 p-5 bg-amber-500/10 border border-amber-500/25 rounded-2xl">
                        <AlertTriangle size={40} className="text-amber-400 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Manual Review Required</p>
                          <h3 className="text-xl font-bold text-white">{result.student_name || 'Unknown'}</h3>
                          <p className="text-xs text-slate-400 mt-1">{result.reason}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black text-amber-400">{result.final_confidence}%</p>
                          <p className="text-[10px] text-slate-500">Confidence</p>
                        </div>
                      </div>
                      {result.component_scores && (
                        <div className="glass-card p-4 space-y-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Score Breakdown</p>
                          <ScoreBar label="Face Biometric"   score={result.component_scores.face_score} />
                          <ScoreBar label="Enrollment Match" score={result.component_scores.enrollment_score} />
                          <ScoreBar label="Name Match"       score={result.component_scores.name_score} />
                          <ScoreBar label="Liveness"         score={result.component_scores.liveness_score} />
                        </div>
                      )}
                      <p className="text-xs text-center text-slate-500">Case queued in the Manual Review panel. Invigilator must approve or reject.</p>
                      <button onClick={resetKiosk} className="btn-primary w-full justify-center">Next Student</button>
                    </div>

                  ) : (
                    <div className="text-center space-y-5">
                      <XCircle size={60} className="text-rose-500 mx-auto" />
                      <div>
                        <h3 className="text-xl font-bold text-white mb-2">Verification Failed</h3>
                        <p className="text-sm text-slate-400">{error || result?.reason || 'Identity could not be confirmed.'}</p>
                      </div>
                      {result?.component_scores && (
                        <div className="glass-card p-4 text-left space-y-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Failure Analysis</p>
                          <ScoreBar label="Face Biometric"   score={result.component_scores.face_score} />
                          <ScoreBar label="Enrollment Match" score={result.component_scores.enrollment_score} />
                          <ScoreBar label="Liveness"         score={result.component_scores.liveness_score} />
                        </div>
                      )}
                      <button onClick={resetKiosk} className="btn-primary w-full justify-center">Try Again</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kiosk;
