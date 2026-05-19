import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, Search, Clock, MapPin,
  BookOpen, Users, ChevronRight, Edit2,
  Trash2, Eye, Download, Filter, CheckCircle,
  AlertCircle, Play, Pause, MoreHorizontal, X, RefreshCw, Zap
} from 'lucide-react';
import { logisticsApi } from '../../services/api';

const STATUS_STYLE = {
  Upcoming: 'badge-info',
  Ongoing: 'badge-success',
  Completed: 'badge-neutral',
};

const AddExamModal = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    subject_name: '',
    subject_code: '',
    date: '',
    time: '09:00',
    branch: 'All'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await logisticsApi.addExam(formData);
      onAdd();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to schedule exam');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative w-full max-w-xl glass-card p-7 animate-fade-slide shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Schedule New Exam</h2>
            <p className="text-xs text-slate-400 mt-0.5">Add exam session to the system</p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Subject Name *</label>
              <input 
                type="text" className="seas-input" placeholder="e.g. Computer Networks" required
                value={formData.subject_name} onChange={e => setFormData({...formData, subject_name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Subject Code *</label>
              <input 
                type="text" className="seas-input" placeholder="e.g. CS-402" required
                value={formData.subject_code} onChange={e => setFormData({...formData, subject_code: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Branch</label>
              <select className="seas-input" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})}>
                <option>BE-CS</option><option>BE-IT</option><option>BE-ME</option><option>BE-EC</option><option>All</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Exam Date *</label>
              <input 
                type="date" className="seas-input" required
                value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Start Time *</label>
              <input 
                type="time" className="seas-input" required
                value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6 pt-5 border-t border-white/[0.06]">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <><Calendar size={15} /> Schedule Exam</>}
          </button>
        </div>
      </form>
    </div>
  );
};

const ExamSchedule = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await logisticsApi.getExams();
      setExams(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch Exams Error:", err);
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleGenerateSeats = async (id) => {
    if (window.confirm('Generate seat allocations for this exam?')) {
      try {
        await logisticsApi.generateAllocations(id);
        fetchExams();
        alert('Seats generated successfully');
      } catch (err) {
        console.error(err);
        alert('Failed to generate seats');
      }
    }
  };

  const filtered = (exams || []).filter(e =>
    (filter === 'All' || e.status === filter) &&
    (
      (e.subject_name?.toLowerCase() || "").includes(search.toLowerCase()) || 
      (e.subject_code?.toLowerCase() || "").includes(search.toLowerCase())
    )
  );

  return (
    <div className="space-y-6 animate-fade-slide">
      {showModal && <AddExamModal onClose={() => setShowModal(false)} onAdd={fetchExams} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">Exam Schedule</h1>
          <p className="page-subtitle">Manage and monitor all examination sessions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchExams} className="btn-icon">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="btn-secondary text-sm py-2.5 px-4"><Download size={14} /> Export</button>
          <button id="add-exam-btn" onClick={() => setShowModal(true)} className="btn-primary text-sm py-2.5 px-4">
            <Plus size={14} /> Schedule Exam
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        {[
          { label: 'Total Exams', val: exams.length, icon: Calendar, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { label: 'Ongoing Now', val: exams.filter(e=>e.status==='Ongoing').length, icon: Play, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Upcoming', val: exams.filter(e=>e.status==='Upcoming').length, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Total Students', val: exams.reduce((a,e) => a+(e.students || 0), 0), icon: Users, color: 'text-slate-400', bg: 'bg-slate-500/10' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3 animate-fade-slide">
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={16} className={s.color} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{s.label}</p>
              <p className="text-lg font-bold text-white">{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="section-card">
        <div className="flex flex-wrap items-center gap-3 p-5 border-b border-white/[0.06]">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" placeholder="Search exams..." value={search} onChange={e => setSearch(e.target.value)} className="seas-input pl-9 py-2.5 text-xs" />
          </div>
          <div className="flex items-center gap-1">
            {['All', 'Ongoing', 'Upcoming', 'Completed'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-2 rounded-lg font-medium transition-all ${filter === f ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25' : 'text-slate-500 hover:text-slate-300'}`}>{f}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="seas-table">
            <thead><tr>
              <th>Subject</th><th>Date & Time</th><th>Rooms</th><th>Students</th><th>Status</th><th className="text-right">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={15} className="text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{e.subject_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">{e.subject_code} · {e.branch || 'General'}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="text-xs font-medium text-slate-200 flex items-center gap-1"><Calendar size={11} className="text-slate-500" /> {e.date}</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Clock size={11} /> {e.time}</p>
                  </td>
                  <td>
                    <span className="text-[10px] bg-white/[0.05] border border-white/[0.08] text-slate-400 px-2 py-0.5 rounded-md font-mono">{e.rooms || 0} Rooms</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      <Users size={13} className="text-slate-500" /> {e.students || 0}
                    </div>
                  </td>
                  <td><span className={STATUS_STYLE[e.status] || 'badge-neutral'}>{e.status || 'Scheduled'}</span></td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => handleGenerateSeats(e.id)} 
                        className="btn-icon w-7 h-7 hover:text-indigo-400" 
                        title="Generate Seat Allocations"
                      >
                        <Zap size={12} />
                      </button>
                      <button className="btn-icon w-7 h-7 hover:text-rose-400 hover:bg-rose-500/10"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                    No examination sessions found matching your criteria.
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

export default ExamSchedule;
