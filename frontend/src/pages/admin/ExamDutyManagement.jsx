import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Plus, Search, Clock, MapPin, Shield, Users,
  Upload, FileText, Image, Download, Trash2, RefreshCw,
  UserPlus, X, CheckCircle, AlertCircle, BookOpen, Zap,
  File, Edit2, Eye, ToggleLeft, ToggleRight
} from 'lucide-react';
import { logisticsApi, authApi } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

const UploadPanel = ({ onUpload }) => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef();

  const accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp';

  const handleFile = (f) => {
    if (!f) return;
    setFile(f); setDone(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = () => {
    if (!file) return;
    setUploading(true);
    
    const saveDuty = async (dataUrl) => {
      try {
        await logisticsApi.addDutyDocument({ filename: file.name, data_url: dataUrl });
        setUploading(false); setDone(true);
        if (onUpload) onUpload();
      } catch (err) {
        console.error(err);
        alert("Failed to upload duty sheet to backend.");
        setUploading(false);
      }
    };

    if (file.type.startsWith('image/')) {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const scale = Math.min(MAX_WIDTH / img.width, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // heavily compress
        saveDuty(dataUrl);
      };
      img.src = URL.createObjectURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = async (e) => saveDuty(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const icon = file
    ? file.name.match(/\.(png|jpg|jpeg|webp)$/i) ? Image
    : file.name.match(/\.pdf$/i) ? FileText
    : file.name.match(/\.(xls|xlsx)$/i) ? File
    : FileText
    : Upload;
  const FileIcon = icon;

  return (
    <div className="space-y-4">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'rgba(99,102,241,0.7)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: '16px', padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
          background: dragging ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.2s ease'
        }}>
        <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <FileIcon size={22} style={{ color: '#818cf8' }} />
        </div>
        {file ? (
          <>
            <p style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{file.name}</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '4px' }}>{(file.size / 1024).toFixed(1)} KB — Click to change</p>
          </>
        ) : (
          <>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Drop duty document here</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>Supports PDF, Image, DOC, Excel</p>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
              {['PDF', 'Image', 'DOC', 'Excel'].map(t => (
                <span key={t} style={{ fontSize: '10px', padding: '3px 9px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>{t}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {done && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle size={16} style={{ color: '#34d399', flexShrink: 0 }} />
          <div>
            <p style={{ color: '#34d399', fontWeight: 600, fontSize: '13px' }}>Duty sheet published!</p>
            <p style={{ color: 'rgba(52,211,153,0.7)', fontSize: '11px', marginTop: '2px' }}>Visible on ALL invigilator dashboards</p>
          </div>
        </div>
      )}

      <button onClick={handleUpload} disabled={!file || uploading || done} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: (!file || done) ? 0.5 : 1 }}>
        {uploading ? <><RefreshCw size={14} className="animate-spin" /> Publishing to all dashboards…</> : done ? <><CheckCircle size={14} /> Published!</> : <><Upload size={14} /> Upload & Publish to All Invigilators</>}
      </button>
    </div>
  );
};

const ManualPanel = ({ onAssign, teachersList = [], examsList = [], roomsList = [] }) => {
  const [teacherId, setTeacherId] = useState('');
  const [examId, setExamId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teacherId || !roomId || !examId) return;
    try {
      await logisticsApi.assignDuty(teacherId, roomId, examId);
      setDone(true);
      if (onAssign) onAssign();
      setTimeout(() => { setDone(false); setTeacherId(''); setExamId(''); setRoomId(''); }, 3000);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to assign duty.");
    }
  };

  const selectedExam = examsList.find(e => String(e.id) === String(examId));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Invigilator Name *</label>
        <select
          className="seas-input"
          value={teacherId}
          onChange={e => setTeacherId(e.target.value)}
          required
        >
          <option value="">Select invigilator...</option>
          {teachersList.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Exam / Subject *</label>
        <select
          className="seas-input"
          value={examId}
          onChange={e => setExamId(e.target.value)}
          required
        >
          <option value="">Select exam...</option>
          {examsList.map(e => <option key={e.id} value={e.id}>{e.subject_code} - {e.subject_name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Room *</label>
          <select
            className="seas-input"
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
            required
          >
            <option value="">Select room...</option>
            {roomsList.map(r => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
          </select>
        </div>
      </div>

      {selectedExam && (
        <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
          Scheduled on: <strong className="text-white">{selectedExam.date}</strong>
        </div>
      )}

      {done && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={14} style={{ color: '#34d399' }} />
          <p style={{ color: '#34d399', fontSize: '12px', fontWeight: 600 }}>Duty assigned successfully!</p>
        </div>
      )}

      <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
        <UserPlus size={14} /> Assign Duty
      </button>
    </form>
  );
};

const ExamDutyManagement = () => {
  const { dark } = useTheme();
  const [tab, setTab] = useState('duties');
  const [method, setMethod] = useState('upload');
  const [duties, setDuties] = useState([]);
  const [exams, setExams] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [invigilators, setInvigilators] = useState([]);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddExam, setShowAddExam] = useState(false);
  const [newExam, setNewExam] = useState({ subject_name: '', subject_code: '', date: '', time: '09:00', branch: 'All' });

  const refreshAll = async () => {
    setLoading(true);
    try {
      const [dRes, eRes, cRes, iRes, docRes] = await Promise.all([
        logisticsApi.getDuties(),
        logisticsApi.getExams(),
        logisticsApi.getClassrooms(),
        authApi.listUsers(),
        logisticsApi.getDutyDocuments()
      ]);
      
      setDuties(Array.isArray(dRes.data) ? dRes.data : []);
      setExams(Array.isArray(eRes.data) ? eRes.data : []);
      setClassrooms(Array.isArray(cRes.data) ? cRes.data : []);
      setInvigilators(Array.isArray(iRes.data) ? iRes.data.filter(u => u.role === 'invigilator') : []);
      setUploadedDocs(Array.isArray(docRes.data) ? docRes.data : []);
    } catch (err) {
      console.error("Error loading duty management data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAddExam = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await logisticsApi.addExam(newExam);
      await refreshAll();
      setShowAddExam(false);
      setNewExam({ subject_name: '', subject_code: '', date: '', time: '09:00', branch: 'All' });
    }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleUploadDone = () => {
    refreshAll();
  };

  const handleAssignDone = () => {
    refreshAll();
  };

  const handleDeleteDuty = async (d) => {
    if (!window.confirm(`Are you sure you want to delete this ${d.type === 'upload' ? 'duty sheet document' : 'duty assignment'}?`)) return;
    try {
      if (d.type === 'upload') {
        await logisticsApi.deleteDutyDocument(d.id);
      } else {
        await logisticsApi.deleteDuty(d.id);
      }
      refreshAll();
    } catch (err) {
      console.error(err);
      alert("Failed to delete.");
    }
  };

  const combinedDuties = [
    ...duties.map(d => ({
      id: d.id,
      teacher: d.teacher,
      exam: d.exam,
      room: d.room,
      date: d.date,
      time: d.time,
      type: 'manual',
      status: 'Confirmed'
    })),
    ...uploadedDocs.map(doc => ({
      id: doc.id,
      teacher: 'All Invigilators',
      exam: doc.filename,
      room: 'All Rooms',
      date: doc.uploadedAt ? doc.uploadedAt.slice(0, 10) : '—',
      time: '—',
      type: 'upload',
      status: doc.status || 'Published'
    }))
  ];

  const filtered = combinedDuties.filter(d =>
    (d.teacher || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.exam || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.room || '').includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={13} className="text-indigo-400" />
            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Exam Management</span>
          </div>
          <h1 className="page-title">Exams, Schedule & Duty Registry</h1>
          <p className="page-subtitle">Manage exam sessions, assign invigilator duties via upload or manual entry</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddExam(true)} className="btn-secondary text-sm py-2.5 px-4">
            <Plus size={14} /> Add Exam
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-1.5 w-fit">
        {[{ k: 'duties', label: 'Duty Assignment', icon: Shield }, { k: 'exams', label: 'Exam Schedule', icon: Calendar }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.k ? 'bg-gradient-to-r from-indigo-500/15 to-violet-500/10 text-white border border-indigo-500/25' : 'text-slate-500 hover:text-slate-300'}`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'duties' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left panel - assignment method */}
          <div className="lg:col-span-2 space-y-4">
            <div className="section-card">
              <div className="section-card-header">
                <h3 className="section-card-title">Assign Duty</h3>
                <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1">
                  {[{ k: 'upload', label: 'Upload', icon: Upload }, { k: 'manual', label: 'Manual', icon: UserPlus }].map(m => (
                    <button key={m.k} id={`method-${m.k}`} onClick={() => setMethod(m.k)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${method === m.k ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
                      <m.icon size={11} /> {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-5">
                {method === 'upload' ? (
                  <>
                    <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <AlertCircle size={13} style={{ color: '#818cf8', flexShrink: 0, marginTop: '1px' }} />
                      <p style={{ fontSize: '11px', color: dark ? 'rgba(255,255,255,0.5)' : '#374151', lineHeight: 1.5 }}>
                        Uploaded documents (PDF, Image, DOC, Excel) will be <strong className='duty-info-highlight'>visible to ALL registered invigilators</strong> on their dashboards.
                      </p>
                    </div>
                    <UploadPanel onUpload={handleUploadDone} />
                  </>
                ) : (
                  <>
                    <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <CheckCircle size={13} style={{ color: '#34d399', flexShrink: 0, marginTop: '1px' }} />
                      <p style={{ fontSize: '11px', color: dark ? 'rgba(255,255,255,0.5)' : '#374151', lineHeight: 1.5 }}>
                        Manual assignments are <strong style={{ color: dark ? '#6ee7b7' : '#059669' }}>only visible to the selected invigilator</strong> on their personal dashboard.
                      </p>
                    </div>
                    <ManualPanel onAssign={handleAssignDone} teachersList={invigilators} examsList={exams} roomsList={classrooms} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right panel - duty list */}
          <div className="lg:col-span-3 section-card">
            <div className="section-card-header">
              <div>
                <h3 className="section-card-title">Duty Registry</h3>
                <p className="text-xs text-slate-500 mt-0.5">{filtered.length} assignments total</p>
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '32px' }} className="seas-input py-2 text-xs w-48" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="seas-table">
                <thead><tr><th>Invigilator</th><th>Exam</th><th>Room / Date</th><th>Type</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {filtered.map(d => (
                    <tr key={d.id + '-' + d.type}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-xs font-bold text-indigo-400">{(d.teacher || 'A')[0]}</div>
                          <p className="text-sm font-semibold text-white">{d.teacher}</p>
                        </div>
                      </td>
                      <td><p className="text-xs text-slate-300">{d.exam}</p><p className="text-[10px] text-slate-500 mt-0.5 font-mono">{d.time}</p></td>
                      <td><p className="text-xs text-slate-300">{d.room.startsWith('Room') ? d.room : `Room ${d.room}`}</p><p className="text-[10px] text-slate-500">{d.date}</p></td>
                      <td>
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, background: d.type === 'upload' ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.12)', color: d.type === 'upload' ? '#818cf8' : '#34d399', border: `1px solid ${d.type === 'upload' ? 'rgba(99,102,241,0.25)' : 'rgba(16,185,129,0.25)'}` }}>
                          {d.type === 'upload' ? '📄 Upload' : '✏️ Manual'}
                        </span>
                      </td>
                      <td><span className={d.status === 'Confirmed' || d.status === 'Published' ? 'badge-success' : 'badge-warning'}>{d.status}</span></td>
                      <td className="text-right">
                        <button
                          onClick={() => handleDeleteDuty(d)}
                          className="btn-icon w-7 h-7 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/[0.08]"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-slate-500 text-xs">No duties found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'exams' && (
        <div className="section-card">
          <div className="flex flex-wrap items-center gap-3 p-5 border-b border-white/[0.06]">
            <h3 className="section-card-title flex-1">Exam Schedule</h3>
            <button onClick={() => setShowAddExam(true)} className="btn-primary text-sm py-2 px-4"><Plus size={13} /> Schedule Exam</button>
          </div>
          <div className="overflow-x-auto">
            <table className="seas-table">
              <thead><tr><th>Subject</th><th>Code</th><th>Branch</th><th>Date</th><th>Time</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {exams.map(e => (
                  <tr key={e.id}>
                    <td><div className="flex items-center gap-2"><BookOpen size={13} className="text-indigo-400" /><p className="text-sm font-semibold text-white">{e.subject_name}</p></div></td>
                    <td><code className="text-xs text-slate-400 font-mono">{e.subject_code}</code></td>
                    <td><span className="text-xs text-slate-400">{e.branch || 'All'}</span></td>
                    <td><span className="text-xs text-slate-300">{e.date}</span></td>
                    <td><span className="text-xs text-slate-300">{e.time}</span></td>
                    <td><span className={e.status === 'Ongoing' ? 'badge-success' : e.status === 'Completed' ? 'badge-neutral' : 'badge-info'}>{e.status || 'Upcoming'}</span></td>
                    <td><div className="flex items-center justify-end gap-1"><button className="btn-icon w-7 h-7 hover:text-rose-400"><Trash2 size={11} /></button></div></td>
                  </tr>
                ))}
                {exams.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-slate-500 text-xs">No exams scheduled yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAddExam(false)} />
          <form onSubmit={handleAddExam} className="relative w-full max-w-md glass-card p-7 animate-fade-slide shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Schedule New Exam</h2>
              <button type="button" onClick={() => setShowAddExam(false)} className="btn-icon"><X size={15} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs text-slate-400 mb-1.5">Subject Name *</label><input type="text" className="seas-input" required value={newExam.subject_name} onChange={e => setNewExam(p => ({ ...p, subject_name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-400 mb-1.5">Code *</label><input type="text" className="seas-input" required value={newExam.subject_code} onChange={e => setNewExam(p => ({ ...p, subject_code: e.target.value }))} /></div>
                <div><label className="block text-xs text-slate-400 mb-1.5">Branch</label><select className="seas-input" value={newExam.branch} onChange={e => setNewExam(p => ({ ...p, branch: e.target.value }))}><option>All</option><option>BE-CS</option><option>BE-IT</option><option>BE-ME</option><option>BE-EC</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-slate-400 mb-1.5">Date *</label><input type="date" className="seas-input" required value={newExam.date} onChange={e => setNewExam(p => ({ ...p, date: e.target.value }))} /></div>
                <div><label className="block text-xs text-slate-400 mb-1.5">Time *</label><input type="time" className="seas-input" required value={newExam.time} onChange={e => setNewExam(p => ({ ...p, time: e.target.value }))} /></div>
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-white/[0.06]">
              <button type="button" onClick={() => setShowAddExam(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? <RefreshCw size={14} className="animate-spin" /> : <><Calendar size={14} /> Schedule</>}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ExamDutyManagement;
