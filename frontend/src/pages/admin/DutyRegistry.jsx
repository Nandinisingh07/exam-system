import React, { useState, useEffect } from 'react';
import {
  Shield, UserPlus, MapPin, Calendar, Clock,
  CheckCircle, AlertCircle, Search, Download,
  Edit2, Trash2, Eye, X, Plus, User, ChevronRight, RefreshCw
} from 'lucide-react';
import { logisticsApi, authApi } from '../../services/api';

const STATUS_STYLE = {
  Confirmed: 'badge-success',
  Pending: 'badge-warning',
  Completed: 'badge-neutral',
};

const AssignDutyModal = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    teacher_id: '',
    classroom_id: '',
    exam_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState({ teachers: [], rooms: [], exams: [] });

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [usersRes, roomsRes, examsRes] = await Promise.all([
          authApi.listUsers(),
          logisticsApi.getClassrooms(),
          logisticsApi.getExams()
        ]);
        const teachers = (usersRes.data || [])
          .filter(u => u.role === 'invigilator')
          .map(u => ({ id: u.id, name: `${u.name} (${u.email})` }));
        const rooms = (roomsRes.data || []).map(r => ({ id: r.id, name: `Room ${r.room_number}` }));
        const exams = (examsRes.data || []).map(e => ({ id: e.id, name: `${e.subject_name} (${e.subject_code})` }));
        setOptions({ teachers, rooms, exams });
      } catch (err) {
        console.error("Failed to load options", err);
      }
    };
    loadOptions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.teacher_id || !formData.classroom_id || !formData.exam_id) return;
    setLoading(true);
    try {
      await logisticsApi.assignDuty(formData.teacher_id, formData.classroom_id, formData.exam_id);
      onAdd();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to assign duty');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative w-full max-w-lg glass-card p-7 animate-fade-slide shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Assign Invigilator Duty</h2>
          <button type="button" onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Select Invigilator *</label>
            <select className="seas-input" value={formData.teacher_id} onChange={e => setFormData({...formData, teacher_id: e.target.value})}>
              <option value="">Select Teacher...</option>
              {options.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Assign Exam *</label>
            <select className="seas-input" value={formData.exam_id} onChange={e => setFormData({...formData, exam_id: e.target.value})}>
              <option value="">Select Exam session...</option>
              {options.exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Assign Room *</label>
            <select className="seas-input" value={formData.classroom_id} onChange={e => setFormData({...formData, classroom_id: e.target.value})}>
              <option value="">Select Room...</option>
              {options.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6 pt-5 border-t border-white/[0.06]">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <><Shield size={15} /> Confirm Assignment</>}
          </button>
        </div>
      </form>
    </div>
  );
};

const DutyRegistry = () => {
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const fetchDuties = async () => {
    try {
      setLoading(true);
      const res = await logisticsApi.getDuties();
      setDuties(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuties();
  }, []);

  const filtered = duties.filter(d =>
    (filter === 'All' || d.status === filter) &&
    (d.name.toLowerCase().includes(search.toLowerCase()) || d.room.includes(search))
  );

  return (
    <div className="space-y-6 animate-fade-slide">
      {showModal && <AssignDutyModal onClose={() => setShowModal(false)} onAdd={fetchDuties} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">Duty Registry</h1>
          <p className="page-subtitle">Assign and manage invigilator duties for exam sessions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDuties} className="btn-icon">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="btn-secondary text-sm py-2.5 px-4"><Download size={14} /> Export</button>
          <button id="assign-duty-btn" onClick={() => setShowModal(true)} className="btn-primary text-sm py-2.5 px-4">
            <UserPlus size={14} /> Assign Duty
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Assignments', val: duties.length, color: 'text-indigo-400' },
          { label: 'Confirmed', val: duties.filter(d=>d.status==='Confirmed').length, color: 'text-emerald-400' },
          { label: 'Pending Confirmation', val: duties.filter(d=>d.status==='Pending').length, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="section-card">
        <div className="flex flex-wrap items-center gap-3 p-5 border-b border-white/[0.06]">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" placeholder="Search by name or room..." value={search} onChange={e=>setSearch(e.target.value)} className="seas-input pl-9 py-2.5 text-xs" />
          </div>
          <div className="flex items-center gap-1">
            {['All', 'Confirmed', 'Pending', 'Completed'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-2 rounded-lg font-medium transition-all ${filter===f ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25' : 'text-slate-500 hover:text-slate-300'}`}>{f}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="seas-table">
            <thead><tr><th>Invigilator</th><th>Exam</th><th>Room & Date</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-sm font-bold text-indigo-400 flex-shrink-0">{d.name[0]}</div>
                      <div>
                        <p className="text-sm font-semibold text-white">{d.name}</p>
                        <p className="text-xs text-slate-500">{d.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="text-xs font-medium text-slate-200">{d.exam}</p>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500"><Clock size={10} /> {d.time}</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1 text-xs text-slate-300 font-medium"><MapPin size={11} className="text-slate-500" /> Room {d.room}</div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500"><Calendar size={10} /> {d.date}</div>
                  </td>
                  <td><span className={STATUS_STYLE[d.status] || 'badge-success'}>{d.status}</span></td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button className="btn-icon w-7 h-7"><Eye size={12} /></button>
                      <button className="btn-icon w-7 h-7"><Edit2 size={12} /></button>
                      <button className="btn-icon w-7 h-7 hover:text-rose-400 hover:bg-rose-500/10"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                 <tr><td colSpan={5} className="py-12 text-center text-slate-500 text-xs">No duty assignments found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DutyRegistry;
