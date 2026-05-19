import React, { useState, useEffect, useRef } from 'react';
import {
  Users, UserPlus, FileUp, Search,
  MoreHorizontal, Download, CheckCircle2, X,
  Hash, Shield, Eye, Trash2,
  Camera, AlertCircle, UserCheck, Clock, RefreshCw,
  Building2, BookOpen, MapPin, Calendar, Info
} from 'lucide-react';
import { adminApi } from '../../services/api';

const STATUS_CONFIG = {
  Verified:   { cls: 'badge-success',  icon: CheckCircle2 },
  Incomplete: { cls: 'badge-warning',  icon: AlertCircle },
  Pending:    { cls: 'badge-neutral',  icon: Clock },
};

// ─── Webcam Component ────────────────────────────────────────────────────────
const WebcamCapture = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let s;
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        setError('Camera access denied or not found.');
      }
    })();
    return () => { if (s) s.getTracks().forEach(t => t.stop()); };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(blob => {
        if (stream) stream.getTracks().forEach(t => t.stop());
        onCapture(blob, canvas.toDataURL('image/jpeg'));
      }, 'image/jpeg', 0.95);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md glass-card overflow-hidden border-indigo-500/30 shadow-2xl shadow-indigo-500/20">
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <Camera size={14} className="text-indigo-400" /> Live Biometric Capture
          </p>
          <button onClick={onCancel} className="btn-icon w-7 h-7"><X size={14} /></button>
        </div>
        <div className="relative aspect-video bg-black flex items-center justify-center">
          {error ? (
            <p className="text-rose-400 text-xs font-bold p-4 text-center">{error}</p>
          ) : (
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
          )}
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-64 border-2 border-dashed border-indigo-400/60 rounded-full" />
          </div>
        </div>
        <div className="p-5 flex flex-col items-center gap-3">
          <p className="text-[10px] text-slate-400 text-center">
            Ensure face is centred & well-lit. Keep a neutral expression.
          </p>
          <div className="flex items-center gap-3 w-full">
            <button onClick={onCancel} className="btn-secondary flex-1 justify-center py-3">Cancel</button>
            <button onClick={capture} disabled={!!error} className="btn-primary flex-1 justify-center py-3">
              <Camera size={16} /> Capture
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Registration Modal ──────────────────────────────────────────────────────
const AddStudentModal = ({ onClose, onAdd }) => {
  const [form, setForm] = useState({
    name: '', enrollment_no: '', email: '', phone: '',
    class_name: 'BE-CS-A', year: 1, semester: 1, college_name: '',
    face_image: null,
  });
  const [preview, setPreview] = useState(null);
  const [showCam, setShowCam] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCapture = (blob, dataUrl) => {
    set('face_image', blob);
    setPreview(dataUrl);
    setShowCam(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.face_image) { alert('Please capture face biometric first.'); return; }
    setLoading(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'face_image') data.append(k, v, 'biometric.jpg');
        else if (v !== null && v !== undefined && v !== '') data.append(k, v);
      });
      // Append default values for backend requirements
      data.append('fee_status', 'paid');
      data.append('is_eligible', true);
      
      await adminApi.registerStudent(data);
      onAdd();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || 'Registration failed. Check all fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showCam && <WebcamCapture onCapture={handleCapture} onCancel={() => setShowCam(false)} />}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <form
          onSubmit={handleSubmit}
          className="relative z-50 w-full max-w-3xl glass-card p-0 animate-fade-slide shadow-2xl shadow-black/60 overflow-hidden"
          style={{ maxHeight: '90vh', overflowY: 'auto' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/[0.06] sticky top-0 bg-[#0f1117] z-10">
            <div>
              <h2 className="text-lg font-bold text-white">Register New Student</h2>
              <p className="text-xs text-slate-400 mt-0.5">Biometric and academic details</p>
            </div>
            <button type="button" onClick={onClose} className="btn-icon"><X size={16} /></button>
          </div>

          {/* Face capture banner */}
          <div
            onClick={() => setShowCam(true)}
            className="mx-6 mt-5 flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/5 border border-dashed border-indigo-500/30 cursor-pointer hover:bg-indigo-500/10 transition-all"
          >
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
              {preview
                ? <img src={preview} className="w-full h-full object-cover scale-x-[-1]" alt="Face" />
                : <Camera size={28} className="text-indigo-400" />}
            </div>
            <div>
              <p className="text-sm font-bold text-white">Face Biometric {preview ? '✅ Captured' : '— Required'}</p>
              <p className="text-[10px] text-slate-500 mt-1">
                {preview
                  ? 'Click to re-capture if needed. Face encoding will be stored for cross-verification.'
                  : 'Click to open webcam. Good lighting improves verification accuracy.'}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="seas-label">Full Name *</label>
                <input className="seas-input" placeholder="e.g. Arjun Kumar Sharma" required
                  value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label className="seas-label">Enrollment / Roll No. *</label>
                <input className="seas-input font-mono" placeholder="e.g. CS20230042" required
                  value={form.enrollment_no} onChange={e => set('enrollment_no', e.target.value)} />
              </div>
              <div>
                <label className="seas-label">Email Address</label>
                <input className="seas-input" type="email" placeholder="student@college.edu"
                  value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className="seas-label">Phone Number</label>
                <input className="seas-input" placeholder="10-digit mobile"
                  value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label className="seas-label">College / University Name</label>
                <input className="seas-input" placeholder="e.g. Rajiv Gandhi Technical University"
                  value={form.college_name} onChange={e => set('college_name', e.target.value)} />
              </div>
              <div>
                <label className="seas-label">Branch / Section *</label>
                <input className="seas-input" list="branches" placeholder="e.g. BE-CS-A" value={form.class_name} onChange={e => set('class_name', e.target.value)} />
                <datalist id="branches">
                  {['BE-CS-A','BE-CS-B','BE-IT-A','BE-IT-B','BE-ME-A','BE-EC-A','BE-CE-A','MCA-A','MBA-A'].map(b =>
                    <option key={b} value={b} />
                  )}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="seas-label">Year *</label>
                  <select className="seas-input" value={form.year} onChange={e => set('year', parseInt(e.target.value))}>
                    {[1,2,3,4].map(y => <option key={y} value={y}>{y}{y===1?'st':y===2?'nd':y===3?'rd':'th'} Year</option>)}
                  </select>
                </div>
                <div>
                  <label className="seas-label">Semester *</label>
                  <select className="seas-input" value={form.semester} onChange={e => set('semester', parseInt(e.target.value))}>
                    {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 p-6 pt-0 border-t border-white/[0.06]">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? <RefreshCw size={15} className="animate-spin" /> : <><UserPlus size={15} /> Complete Registration</>}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
const AdminStudents = () => {
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showModal, setShowModal]     = useState(false);
  const [students, setStudents]       = useState([]);
  const [loading, setLoading]         = useState(true);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getStudents();
      setStudents(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Delete this student and all biometric data permanently?')) {
      try { await adminApi.deleteStudent(id); fetchStudents(); }
      catch (err) { console.error(err); }
    }
  };

  const getStatus = (s) => s.face_registered ? 'Verified' : 'Pending';

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = s.name.toLowerCase().includes(q) ||
      s.enrollment_no.toLowerCase().includes(q) ||
      (s.class_name || '').toLowerCase().includes(q) ||
      (s.centre_code || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'All' || getStatus(s) === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-slide">
      {showModal && <AddStudentModal onClose={() => setShowModal(false)} onAdd={fetchStudents} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">Student Database</h1>
          <p className="page-subtitle">Biometric identity + academic records + exam centre pre-registration</p>
        </div>
        <div className="flex items-center gap-2">
          <button id="add-student-btn" onClick={() => setShowModal(true)} className="btn-primary text-sm py-2.5 px-4">
            <UserPlus size={14} /> New Registration
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Registered', val: students.length, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: 'Biometrics Verified', val: students.filter(s => s.face_registered).length, icon: UserCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Pending Biometrics', val: students.filter(s => !s.face_registered).length, icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Fee Paid', val: students.filter(s => s.fee_status === 'paid').length, icon: Shield, color: 'text-sky-400', bg: 'bg-sky-500/10' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={16} className={s.color} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{s.label}</p>
              <p className="text-lg font-black text-white">{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="section-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-5 border-b border-white/[0.06]">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="student-search"
              type="text"
              placeholder="Search by name, enrollment, branch..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="seas-input pl-9 py-2.5 text-xs"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.07] rounded-xl">
            {['All', 'Verified', 'Pending'].map(f => (
              <button key={f} onClick={() => setFilterStatus(f)}
                className={`text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all uppercase tracking-wider ${
                  filterStatus === f ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={fetchStudents} className="btn-icon">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="seas-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Enrollment</th>
                <th>Academic Track</th>
                <th>Biometrics</th>
                <th className="text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const status = getStatus(s);
                const StatusIcon = STATUS_CONFIG[status].icon;
                return (
                  <tr key={s.id} className="group hover:bg-indigo-500/[0.02]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 flex items-center justify-center text-sm font-black text-white flex-shrink-0 border border-white/[0.08]">
                          {s.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{s.name}</p>
                          <p className="text-[10px] text-slate-500">{s.email || '—'}</p>

                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <code className="text-[11px] font-mono text-slate-400">{s.enrollment_no}</code>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs font-bold text-slate-300">{s.class_name}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">Year {s.year} · Sem {s.semester}</p>
                      {s.college_name && <p className="text-[10px] text-slate-700">{s.college_name}</p>}
                    </td>

                    <td className="px-5 py-4">
                      <span className={`${STATUS_CONFIG[status].cls} flex w-fit items-center gap-1.5`}>
                        <StatusIcon size={10} /> {status}
                      </span>
                    </td>
                    <td className="px-5 py-4 pr-6">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="btn-icon w-8 h-8 hover:text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Users size={40} className="text-slate-800 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold">No student records found</p>
                    <p className="text-[10px] text-slate-600 mt-1">Register students using the "New Registration" button above</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminStudents;
