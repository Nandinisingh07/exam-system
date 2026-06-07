import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, RotateCcw, ShieldCheck, User, CreditCard, FileText,
  CheckCircle, XCircle, RefreshCcw, Loader2, Scan,
  AlertTriangle, ChevronRight, Clock, Zap, Activity,
  ThumbsUp, Play, UserPlus, X, Ban, PenLine
} from 'lucide-react';

const API_BASE = 'https://decaf-brim-steadfast.ngrok-free.dev';

// â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getToken() {
  return localStorage.getItem('token') || '';
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    // FastAPI 422 returns detail as array of objects â€” flatten to string
    const detail = data.detail;
    if (Array.isArray(detail)) {
      const msg = detail.map(e => `${e.loc?.slice(-1)?.[0] ?? 'field'}: ${e.msg}`).join(', ');
      throw new Error(msg);
    }
    throw new Error(typeof detail === 'string' ? detail : `HTTP ${res.status}`);
  }
  return data;
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'ngrok-skip-browser-warning': 'true', Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Capture a JPEG frame from a <video> element.
// Returns base64 string (no prefix) or null if frame is blank/not ready.
function captureFrame(videoEl, quality = 0.92) {
  if (!videoEl) return null;
  const w = videoEl.videoWidth;
  const h = videoEl.videoHeight;
  if (!w || !h) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, w, h);

  const px = ctx.getImageData(0, 0, 16, 16).data;
  const avg = Array.from(px).reduce((s, v, i) => i % 4 < 3 ? s + v : s, 0) / (16 * 16 * 3);
  if (avg < 8) return null;

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return dataUrl.split(',')[1];
}

// Captures 8 frames over 800ms, returns the sharpest one.
// flipH=true for card scanning (un-mirrors the display flip).
async function captureSharpestFrame(videoEl, quality = 0.92, flipH = false) {
  if (!videoEl) return null;
  const w = videoEl.videoWidth;
  const h = videoEl.videoHeight;
  if (!w || !h) return null;

  const frames = [];
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 100));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (flipH) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoEl, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Reject blank frames
    const px = ctx.getImageData(0, 0, 16, 16).data;
    const avg = Array.from(px).reduce((s, v, i) => i % 4 < 3 ? s + v : s, 0) / (16 * 16 * 3);
    if (avg < 8) continue;

    // Sharpness = variance of grayscale in center crop
    const cx = Math.floor(w * 0.2), cy = Math.floor(h * 0.2);
    const cw = Math.floor(w * 0.6), ch = Math.floor(h * 0.6);
    const data = ctx.getImageData(cx, cy, cw, ch).data;
    let mean = 0, count = 0;
    const gray = [];
    for (let p = 0; p < data.length; p += 4) {
      const g = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      gray.push(g); mean += g; count++;
    }
    mean /= count;
    const sharpness = gray.reduce((s, v) => s + (v - mean) ** 2, 0) / count;

    frames.push({ b64: canvas.toDataURL('image/jpeg', quality).split(',')[1], sharpness });
  }

  if (!frames.length) return null;
  frames.sort((a, b) => b.sharpness - a.sharpness);
  console.log('[OCR] Sharpness scores:', frames.map(f => f.sharpness.toFixed(1)));
  return frames[0].b64;
}

// Wait for video to have real pixels
async function waitForVideoReady(videoEl, maxMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (videoEl.videoWidth > 0 && videoEl.readyState >= 2) {
      const frame = captureFrame(videoEl);
      if (frame) return true;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

// â”€â”€â”€ Step badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STEPS = [
  { id: 1, label: 'Face Scan', icon: User, desc: 'Biometric face match' },
  { id: 2, label: 'Admit Card', icon: FileText, desc: 'OCR document scan' },
  { id: 3, label: 'ID Card', icon: CreditCard, desc: 'Photo ID verification' },
  { id: 4, label: 'Result', icon: CheckCircle, desc: 'Verification complete' },
];

function StepBadge({ step, current, done, error }) {
  const Icon = step.icon;
  const active = step.id === current;
  const bg = done
    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
    : error
      ? 'bg-rose-500/20 border-rose-500 text-rose-400'
      : active
        ? 'bg-violet-500/20 border-violet-500 text-violet-300'
        : 'bg-slate-800 border-slate-700 text-slate-500';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${bg} transition-all duration-300`}>
      {done ? <CheckCircle size={15} className="text-emerald-400" />
        : error ? <XCircle size={15} className="text-rose-400" />
          : <Icon size={15} />}
      <div>
        <div className="text-[11px] font-semibold">{step.label}</div>
        <div className="text-[10px] opacity-60">{step.desc}</div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Webcam panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function WebcamPanel({ videoRef, streamActive, label, onFlip, hasMultipleCameras, facingMode, isMobile }) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-700"
      style={{ height: isMobile ? 'min(52vw,360px)' : '420px' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
      />
      {hasMultipleCameras && (
        <button onClick={onFlip} title="Flip camera"
          className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/75 text-white rounded-full p-2 transition-all"
        >
          <RotateCcw size={20} />
        </button>
      )}
      {/* Animated scan ring */}
      {streamActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-40 h-48 rounded-[50%] border-2 border-violet-400/60"
            style={{ boxShadow: '0 0 20px rgba(124,58,237,0.4)', animation: 'pulse 2s infinite' }} />
        </div>
      )}
      {!streamActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <div className="text-center">
            <Camera size={40} className="text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Camera initializingâ€¦</p>
          </div>
        </div>
      )}
      {label && (
        <div className="absolute bottom-2 left-2 right-2 text-center">
          <span className="text-[10px] font-mono text-violet-300 bg-slate-900/70 px-2 py-1 rounded-md">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Face Registration Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ Fast Bulk Registration Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Drop this in to replace the existing RegisterModal in Kiosk.jsx
//
// WHAT'S DIFFERENT:
//   â€¢ Auto-advances to next unregistered student after each success
//   â€¢ SPACE or ENTER = capture + register in one shot (no separate buttons)
//   â€¢ Shows "12 / 70 done" progress so you know where you are
//   â€¢ Skips already-registered students (shown in green, can still re-do)
//   â€¢ Keyboard-first: never need to touch the mouse

function RegisterModal({ students, videoRef, onClose, onSuccess }) {
  const [queue, setQueue] = React.useState([]); // ordered list of students
  const [idx, setIdx] = React.useState(0);  // current index in queue
  const [doneIds, setDoneIds] = React.useState(new Set());
  const [status, setStatus] = React.useState('idle'); // idle | capturing | registering | success | error
  const [message, setMessage] = React.useState('');
  const [registered, setRegistered] = React.useState(0);
  const inputRef = React.useRef(null);

  // Build queue on mount â€” unregistered first, then registered
  React.useEffect(() => {
    const unregistered = students.filter(s => !s.face_encoding);
    const alreadyDone = students.filter(s => s.face_encoding);
    setQueue([...unregistered, ...alreadyDone]);
    setRegistered(alreadyDone.length);
  }, [students]);

  // Focus trap for keyboard
  React.useEffect(() => {
    inputRef.current?.focus();
  }, [idx, queue]);

  // Keyboard handler
  React.useEffect(() => {
    function onKey(e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (status === 'idle' || status === 'error') handleCaptureAndRegister();
      }
      if (e.key === 'ArrowRight' || e.key === 'n') goNext();
      if (e.key === 'ArrowLeft' || e.key === 'p') goPrev();
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, idx, queue]);

  const current = queue[idx];
  const total = students.length;

  function goNext() {
    setIdx(i => Math.min(i + 1, queue.length - 1));
    setStatus('idle');
    setMessage('');
  }
  function goPrev() {
    setIdx(i => Math.max(i - 1, 0));
    setStatus('idle');
    setMessage('');
  }

  async function handleCaptureAndRegister() {
    if (!current) return;
    setStatus('capturing');
    setMessage('Capturing...');

    const frame = captureFrame(videoRef.current);
    if (!frame) {
      setStatus('error');
      setMessage('No frame â€” wait for camera then press Space again');
      return;
    }

    setStatus('registering');
    setMessage('Registering...');

    try {
      const res = await apiPost('/api/verify/register-face', {
        student_id: current.id,
        face_images_b64: [frame],
      });

      setDoneIds(prev => new Set([...prev, current.id]));
      setRegistered(prev => prev + (doneIds.has(current.id) ? 0 : 1));
      setStatus('success');
      setMessage(`Done â€” ${res.student_name}`);
      onSuccess?.(res);

      // Auto-advance after 800ms
      setTimeout(() => {
        if (idx < queue.length - 1) {
          goNext();
        } else {
          setMessage('All students registered!');
        }
      }, 800);

    } catch (e) {
      setStatus('error');
      setMessage(e.message);
    }
  }

  if (!queue.length) return null;

  const pct = Math.round((registered / total) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>

      {/* invisible focus target for keyboard */}
      <button ref={inputRef} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />

      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-violet-400" />
            <span className="font-bold text-white text-sm">Bulk Face Registration</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-3 pb-2">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400">Progress</span>
            <span className="text-white font-mono font-medium">{registered} / {total} registered</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: pct + '%', background: pct === 100 ? '#10b981' : '#7c3aed' }}
            />
          </div>
        </div>

        {/* Current student card */}
        <div className="px-5 py-4">
          <div className={`rounded-xl border p-4 mb-4 transition-all ${doneIds.has(current?.id)
            ? 'border-emerald-500/40 bg-emerald-500/10'
            : 'border-slate-700 bg-slate-800'
            }`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-white font-semibold text-sm">{current?.name}</span>
              {doneIds.has(current?.id) && (
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                  Registered
                </span>
              )}
            </div>
            <span className="text-slate-400 text-xs font-mono">{current?.enrollment_no}</span>
          </div>

          {/* Big action button */}
          <button
            onClick={handleCaptureAndRegister}
            disabled={status === 'capturing' || status === 'registering'}
            className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${status === 'success'
              ? 'bg-emerald-600 text-white'
              : status === 'error'
                ? 'bg-rose-600/80 hover:bg-rose-600 text-white'
                : status === 'capturing' || status === 'registering'
                  ? 'bg-violet-700/50 text-white cursor-wait'
                  : 'bg-violet-600 hover:bg-violet-500 active:scale-[0.98] text-white'
              }`}
          >
            {status === 'capturing' && <><Loader2 size={16} className="animate-spin" /> Capturing...</>}
            {status === 'registering' && <><Loader2 size={16} className="animate-spin" /> Saving...</>}
            {status === 'success' && <><CheckCircle size={16} /> Registered â€” next in 0.8s</>}
            {status === 'error' && <><AlertTriangle size={16} /> Retry (Space)</>}
            {status === 'idle' && <><Camera size={16} /> Capture &amp; Register</>}
          </button>

          {message && status === 'error' && (
            <p className="text-rose-400 text-xs mt-2 text-center">{message}</p>
          )}

          {/* Nav */}
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={goPrev}
              disabled={idx === 0}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 px-2 py-1"
            >
              â† Prev
            </button>
            <span className="text-xs text-slate-500">
              {idx + 1} of {queue.length}
            </span>
            <button
              onClick={goNext}
              disabled={idx === queue.length - 1}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 px-2 py-1"
            >
              Next â†’
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <div className="px-5 pb-4 text-center">
          <p className="text-[11px] text-slate-600">
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Space</kbd> capture &nbsp;Â·&nbsp;
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">â†â†’</kbd> navigate &nbsp;Â·&nbsp;
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Esc</kbd> close
          </p>
        </div>

        {/* Mini student list */}
        <div className="border-t border-slate-800 max-h-36 overflow-y-auto">
          {queue.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setIdx(i); setStatus('idle'); setMessage(''); }}
              className={`w-full flex items-center justify-between px-5 py-2 text-xs transition-colors
                ${i === idx ? 'bg-violet-600/20 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <span>{s.name}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-slate-500">{s.enrollment_no}</span>
                {doneIds.has(s.id)
                  ? <CheckCircle size={11} className="text-emerald-400" />
                  : <div className="w-2.5 h-2.5 rounded-full border border-slate-600" />
                }
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Kiosk Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function Kiosk() {
  const videoRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window));
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [examId, setExamId] = useState('');
  const [step, setStep] = useState(0);    // 0=idle, 1=face, 2=admit, 3=id, 4=done
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // accumulated data
  const [stepError, setStepError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [time, setTime] = useState(new Date());
  const [showTerminate, setShowTerminate] = useState(false);
  const [terminateReason, setTerminateReason] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualEnrollment, setManualEnrollment] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Camera detection
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(d => {
      setHasMultipleCameras(d.filter(x => x.kind === 'videoinput').length > 1);
    }).catch(() => {});
    const onResize = () => setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Webcam restarts on flip
  useEffect(() => {
    let stream;
    let el = videoRef.current;
    if (el && el.srcObject) { el.srcObject.getTracks().forEach(t => t.stop()); el.srcObject = null; setStreamActive(false); }
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode },
          audio: false,
        });
        el = videoRef.current;
        if (el) { el.srcObject = stream; el.onloadedmetadata = () => setStreamActive(true); }
      } catch (e) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          el = videoRef.current;
          if (el) { el.srcObject = stream; el.onloadedmetadata = () => setStreamActive(true); }
        } catch (e2) { console.error('Camera error:', e2); }
      }
    })();
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, [facingMode]);

  const [myDuty, setMyDuty] = useState(null);

  // Load duty first, then exams + students
  useEffect(() => {
    apiGet('/api/logistics/my-duty')
      .then(duty => {
        setMyDuty(duty);
        apiGet('/api/logistics/exams').then(exams => {
          setExams(exams);
          const match = exams.find(e => e.subject_code === duty.code || e.subject_name === duty.exam);
          if (match) setExamId(String(match.id));
        }).catch(console.error);
      })
      .catch(() => {
        apiGet('/api/logistics/exams').then(setExams).catch(console.error);
      });
    apiGet('/api/students').then(setStudents).catch(() => setStudents([]));
  }, []);

  function flipCamera() {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }

  function resetKiosk() {
    setStep(0);
    setResult(null);
    setStepError('');
    setLoading(false);
  }

  async function handleStart() {
    if (!examId) { setStepError('Please select an exam first'); return; }
    setStep(1);
    setStepError('');
    setResult(null);
  }

  // â”€â”€ Step 1: Face scan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleScanFace() {
    setLoading(true);
    setStepError('');
    try {
      const ready = await waitForVideoReady(videoRef.current, 5000);
      if (!ready) throw new Error('Camera not ready â€” please wait a moment and try again');

      const frame = captureFrame(videoRef.current);
      if (!frame) throw new Error('Could not capture frame â€” ensure camera is working');

      const data = await apiPost('/api/verify/step-face', {
        exam_id: parseInt(examId),
        face_image_b64: frame,
      });

      setResult(prev => ({ ...prev, ...data }));
      setStep(2);
    } catch (e) {
      setStepError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // â”€â”€ Step 2: Admit card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleScanAdmit() {
    setLoading(true);
    setStepError('');
    try {
      if (!result?.student_id) throw new Error('Student not identified â€” please restart from Step 1');

      const ready = await waitForVideoReady(videoRef.current, 5000);
      if (!ready) throw new Error('Camera not ready');

      setStepError('Hold admit card flat and stillâ€¦');
      const frame = await captureSharpestFrame(videoRef.current, 0.92, false);
      setStepError('');
      if (!frame) throw new Error('Could not capture frame â€” check camera');

      const payload = {
        exam_id: parseInt(examId),
        student_id: result?.student_id,
        admit_image_b64: frame,
      };
      console.log('[DEBUG] step-admit payload:', {
        exam_id: payload.exam_id,
        student_id: payload.student_id,
        admit_image_b64_len: payload.admit_image_b64?.length,
      });
      if (!payload.student_id || isNaN(payload.exam_id)) {
        throw new Error(`Bad payload â€” student_id=${payload.student_id} exam_id=${payload.exam_id}`);
      }
      const data = await apiPost('/api/verify/step-admit', payload);

      setResult(prev => ({ ...prev, ...data }));
      setStep(3);
    } catch (e) {
      setStepError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // â”€â”€ Step 3: ID card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleScanID() {
    setLoading(true);
    setStepError('');
    try {
      if (!result?.student_id) throw new Error('Student not identified â€” please restart from Step 1');

      const ready = await waitForVideoReady(videoRef.current, 5000);
      if (!ready) throw new Error('Camera not ready');
      setStepError('Hold ID card flat and stillâ€¦');
      const frame = await captureSharpestFrame(videoRef.current, 0.92, false);
      setStepError('');
      if (!frame) throw new Error('Could not capture frame â€” check camera');

      const data = await apiPost('/api/verify/step-id', {
        exam_id: parseInt(examId),
        student_id: result.student_id,
        id_image_b64: frame,
      });

      setResult(prev => ({ ...prev, ...data }));
      setStep(4);
    } catch (e) {
      setStepError(e.message);
    } finally {
      setLoading(false);
    }
  }
  // â”€â”€ Terminate session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function handleTerminate() {
    if (!terminateReason.trim()) return;
    console.warn(`[Kiosk] Session terminated. Reason: ${terminateReason}`);
    setShowTerminate(false);
    setTerminateReason('');
    resetKiosk();
  }

  // â”€â”€ Manual entry override â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleManualEntry() {
    if (!manualEnrollment.trim()) { setManualError('Enter enrollment number'); return; }
    setManualLoading(true);
    setManualError('');
    try {
      const all = await apiGet('/api/students');
      const normalized = manualEnrollment.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const found = all.find(s =>
        s.enrollment_no.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === normalized
      );
      if (!found) throw new Error(`No student found with enrollment: ${manualEnrollment}`);
      // Inject student into result and skip to step 2
      setResult({ student_id: found.id, student_name: found.name, enrollment_no: found.enrollment_no, confidence: 0, manual_override: true });
      setShowManual(false);
      setManualEnrollment('');
      setStep(2);
    } catch (e) {
      setManualError(e.message);
    } finally {
      setManualLoading(false);
    }
  }
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const stepDone = id => step > id || (id === 4 && step === 4);
  const stepErr = id => stepError && step === id;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      {/* â”€â”€ Terminate Session Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showTerminate && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <Ban size={18} className="text-rose-400" />
              <span className="font-bold text-white">Terminate Session</span>
            </div>
            <p className="text-slate-400 text-xs mb-4">
              This will cancel the current verification and reset the kiosk. Provide a reason for the log.
            </p>
            <textarea
              autoFocus
              value={terminateReason}
              onChange={e => setTerminateReason(e.target.value)}
              placeholder="e.g. Student left, camera failure, wrong exam..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm mb-4 resize-none focus:outline-none focus:border-rose-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowTerminate(false); setTerminateReason(''); }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-sm text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleTerminate}
                disabled={!terminateReason.trim()}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Ban size={14} /> Terminate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Manual Entry Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showManual && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <PenLine size={18} className="text-amber-400" />
                <span className="font-bold text-white">Manual Entry Override</span>
              </div>
              <button onClick={() => { setShowManual(false); setManualEnrollment(''); setManualError(''); }}
                className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-slate-400 text-xs mb-4">
              Use only when face scan fails (injury, camera issue). This is logged as a manual override.
            </p>
            <input
              autoFocus
              type="text"
              value={manualEnrollment}
              onChange={e => setManualEnrollment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualEntry()}
              placeholder="e.g. 0818CL231046"
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm mb-2 focus:outline-none focus:border-amber-500 font-mono"
            />
            {manualError && <p className="text-rose-400 text-xs mb-3">{manualError}</p>}
            <button
              onClick={handleManualEntry}
              disabled={manualLoading || !manualEnrollment.trim()}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {manualLoading ? <><Loader2 size={14} className="animate-spin" /> Looking up...</> : <><PenLine size={14} /> Find & Continue</>}
            </button>
          </div>
        </div>
      )}
      {showRegister && (
        <RegisterModal
          students={students}
          videoRef={videoRef}
          onClose={() => setShowRegister(false)}
          onSuccess={() => { }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck size={22} className="text-violet-400" />
            Entry Verification Terminal
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Face + Admit Card + ID Card â€” AI confidence scoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-slate-300 font-mono text-sm">
              {time.toLocaleTimeString()}
            </div>
            <div className="flex items-center gap-1 justify-end">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400">System Live</span>
            </div>
          </div>
          <button
            onClick={() => setShowRegister(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs transition-colors
    ${showRegister
                ? 'bg-violet-600 border-violet-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
              }`}
          >
            <UserPlus size={14} className={showRegister ? 'text-white' : 'text-violet-400'} />
            <span className="hidden sm:inline">
              {showRegister ? 'Close Registration' : 'Register Face'}
            </span>
            <span className="sm:hidden">
              {showRegister ? 'Close' : 'Register'}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left â€” webcam + exam select */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <WebcamPanel
            videoRef={videoRef}
            streamActive={streamActive}
            facingMode={facingMode}
            hasMultipleCameras={hasMultipleCameras}
            isMobile={isMobile}
            onFlip={flipCamera}
            label={
              step === 0 ? 'Waiting for exam selection'
                : step === 1 ? 'Position face in oval â€” then click Scan Face'
                  : step === 2 ? 'Hold ADMIT CARD clearly in frame â€” then scan'
                    : step === 3 ? 'Hold ID CARD clearly in frame â€” then scan'
                      : 'Verification complete'
            }
          />

          {/* Duty Info */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
            {myDuty ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Duty Assigned</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><div className="text-slate-400 text-xs mb-0.5">Exam</div><div className="text-white font-semibold text-sm">{myDuty.code}</div><div className="text-slate-300 text-xs">{myDuty.exam}</div></div>
                  <div><div className="text-slate-400 text-xs mb-0.5">Room</div><div className="text-white font-semibold text-sm">{myDuty.room}</div><div className="text-slate-300 text-xs">{myDuty.floor}</div></div>
                  <div><div className="text-slate-400 text-xs mb-0.5">Date</div><div className="text-slate-200 text-xs">{myDuty.date}</div></div>
                  <div><div className="text-slate-400 text-xs mb-0.5">Students</div><div className="text-slate-200 text-xs">{myDuty.totalStudents} assigned</div></div>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-400 mb-2 block font-medium uppercase tracking-wider">Select Exam</label>
                <select value={examId} onChange={e => { setExamId(e.target.value); resetKiosk(); }} disabled={loading} className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500">
                  <option value="">— Choose exam —</option>
                  {exams.map(e => (<option key={e.id} value={e.id}>{e.subject_code} — {e.subject_name}</option>))}
                </select>
                <p className="text-amber-400 text-xs mt-2">No duty assigned. Contact admin.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right â€” steps + controls */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Step indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {STEPS.map(s => (
              <StepBadge
                key={s.id}
                step={s}
                current={step}
                done={stepDone(s.id)}
                error={stepErr(s.id)}
              />
            ))}
          </div>

          {/* Action panel */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 flex-1">

            {/* â”€â”€ Idle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {step === 0 && (
              <div className="text-center py-8">
                <Zap size={40} className="text-violet-400 mx-auto mb-3" />
                <h2 className="text-lg font-bold mb-1">Ready to Verify</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Select an exam above, then click Start Verification.
                </p>
                <button
                  onClick={handleStart}
                  disabled={!examId}
                  className="px-8 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white rounded-2xl font-semibold flex items-center gap-2 mx-auto transition-all"
                >
                  <Play size={18} /> Start Verification
                </button>
                {stepError && (
                  <p className="text-rose-400 text-sm mt-3">{stepError}</p>
                )}
              </div>
            )}

            {/* â”€â”€ Step 1: Face â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {step === 1 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <User size={18} className="text-violet-400" />
                  <h2 className="font-bold">Step 1 of 3 â€” Face Biometric</h2>
                </div>
                <p className="text-slate-400 text-sm mb-5">
                  Position face clearly in the oval guide, ensure good lighting,
                  then click <strong className="text-white">Scan Face</strong>.
                </p>

                {stepError && (
                  <div className="bg-rose-900/30 border border-rose-500/50 rounded-xl p-3 mb-4 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-rose-400 mt-0.5 shrink-0" />
                    <p className="text-rose-300 text-sm">{stepError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleScanFace}
                    disabled={loading}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    {loading
                      ? <><Loader2 size={18} className="animate-spin" /> Scanningâ€¦</>
                      : <><Scan size={18} /> Scan Face</>}
                  </button>
                  {stepError && (
                    <button
                      onClick={() => { setStepError(''); }}
                      className="px-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-slate-300 border border-slate-600"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* â”€â”€ Step 2: Admit card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {step === 2 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span className="text-emerald-400 text-sm font-semibold">
                    Face matched: {result?.student_name} ({result?.confidence?.toFixed(1)}%)
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <FileText size={18} className="text-violet-400" />
                  <h2 className="font-bold">Step 2 of 3 â€” Admit Card OCR</h2>
                </div>
                <p className="text-slate-400 text-sm mb-5">
                  Hold the <strong className="text-white">admit card</strong> flat and fully visible
                  in the camera, then click <strong className="text-white">Scan Admit Card</strong>.
                </p>

                {stepError && (
                  <div className="bg-rose-900/30 border border-rose-500/50 rounded-xl p-3 mb-4 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-rose-400 mt-0.5 shrink-0" />
                    <p className="text-rose-300 text-sm">{stepError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleScanAdmit}
                    disabled={loading}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
                  >
                    {loading
                      ? <><Loader2 size={18} className="animate-spin" /> Scanningâ€¦</>
                      : <><Scan size={18} /> Scan Admit Card</>}
                  </button>
                  {stepError && (
                    <button
                      onClick={() => setStepError('')}
                      className="px-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-slate-300 border border-slate-600"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* â”€â”€ Step 3: ID card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {step === 3 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span className="text-emerald-400 text-sm font-semibold">
                    Admit card verified â€” {result?.ocr_enrollment || result?.enrollment_no}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <CreditCard size={18} className="text-violet-400" />
                  <h2 className="font-bold">Step 3 of 3 â€” ID Card OCR</h2>
                </div>
                <p className="text-slate-400 text-sm mb-5">
                  Hold the <strong className="text-white">college ID card</strong> facing the camera,
                  then click <strong className="text-white">Scan ID Card</strong>.
                </p>

                {stepError && (
                  <div className="bg-rose-900/30 border border-rose-500/50 rounded-xl p-3 mb-4 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-rose-400 mt-0.5 shrink-0" />
                    <p className="text-rose-300 text-sm">{stepError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleScanID}
                    disabled={loading}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
                  >
                    {loading
                      ? <><Loader2 size={18} className="animate-spin" /> Scanningâ€¦</>
                      : <><Scan size={18} /> Scan ID Card</>}
                  </button>
                  {stepError && (
                    <button
                      onClick={() => setStepError('')}
                      className="px-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-slate-300 border border-slate-600"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* â”€â”€ Step 4: Success â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {step === 4 && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ boxShadow: '0 0 30px rgba(16,185,129,0.3)' }}>
                  <CheckCircle size={36} className="text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-emerald-400 mb-1">Verified âœ“</h2>
                <p className="text-white text-lg font-semibold mb-1">{result?.student_name}</p>
                <p className="text-slate-400 text-sm mb-1">#{result?.enrollment_no}</p>
                <p className="text-slate-500 text-xs mb-5">
                  Attendance #{result?.attendance_id} recorded at {result?.verified_at?.slice(11, 19)}
                </p>

                {/* Score cards */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-slate-800 rounded-xl p-3">
                    <div className="text-emerald-400 font-bold text-lg">
                      {result?.confidence?.toFixed(0)}%
                    </div>
                    <div className="text-slate-400 text-xs">Face Match</div>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-3">
                    <div className="text-emerald-400 font-bold text-lg">
                      {result?.ocr_match !== false ? 'âœ“' : '~'}
                    </div>
                    <div className="text-slate-400 text-xs">Admit Card</div>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-3">
                    <div className="text-emerald-400 font-bold text-lg">
                      {result?.id_match !== false ? 'âœ“' : '~'}
                    </div>
                    <div className="text-slate-400 text-xs">ID Card</div>
                  </div>
                </div>

                <button
                  onClick={resetKiosk}
                  className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-semibold flex items-center gap-2 mx-auto transition-all"
                >
                  <RefreshCcw size={16} /> Next Student
                </button>
              </div>
            )}
          </div>

          {/* Bottom action bar â€” visible during active verification */}
          {step > 0 && step < 4 && (
            <div className="flex gap-2">
              <button
                onClick={resetKiosk}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-sm text-slate-400 flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCcw size={14} /> Reset
              </button>
              {step === 1 && (
                <button
                  onClick={() => { setShowManual(true); setManualError(''); }}
                  className="flex-1 py-2.5 bg-amber-900/40 hover:bg-amber-900/60 border border-amber-500/40 rounded-xl text-sm text-amber-400 flex items-center justify-center gap-2 transition-colors"
                >
                  <PenLine size={14} /> Manual Entry
                </button>
              )}
              <button
                onClick={() => setShowTerminate(true)}
                className="flex-1 py-2.5 bg-rose-900/30 hover:bg-rose-900/50 border border-rose-500/30 rounded-xl text-sm text-rose-400 flex items-center justify-center gap-2 transition-colors"
              >
                <Ban size={14} /> Terminate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

