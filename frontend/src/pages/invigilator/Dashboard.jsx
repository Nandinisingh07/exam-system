import React, { useState, useEffect } from 'react';
import {
  Shield, MapPin, Clock, Calendar, Users,
  CheckCircle, AlertTriangle, Download, Activity,
  BookOpen, ChevronRight, Zap, Sparkles,
  UserCheck, WifiOff, ArrowRight, RefreshCw
} from 'lucide-react';
import { logisticsApi, attendanceApi } from '../../services/api';

const STATUS_CONFIG = {
  Verified: {
    badge: 'badge-success',
    icon: CheckCircle,
    iconColor: 'text-emerald-400',
    rowBg: '',
  },
  Absent: {
    badge: 'badge-danger',
    icon: WifiOff,
    iconColor: 'text-rose-400',
    rowBg: 'bg-rose-500/[0.02]',
  },
  Washroom: {
    badge: 'badge-warning',
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    rowBg: 'bg-amber-500/[0.02]',
  },
  Pending: {
    badge: 'badge-neutral',
    icon: Clock,
    iconColor: 'text-slate-400',
    rowBg: '',
  },
};

const InvigilatorDashboard = () => {
  const [duty, setDuty] = useState(null);
  const [bulkDuties, setBulkDuties] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDuty = async () => {
    try {
      setLoading(true);
      const [res, bulkRes] = await Promise.all([
        logisticsApi.getMyDuty().catch(() => ({ data: null })),
        logisticsApi.getDutyDocuments().catch(() => ({ data: [] }))
      ]);
      setDuty(res.data);
      setBulkDuties(Array.isArray(bulkRes.data) ? bulkRes.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuty();
    const id = setInterval(fetchDuty, 15000);
    return () => clearInterval(id);
  }, []);

  const openDutyFile = (b) => {
    if (b.dataUrl) {
      const w = window.open();
      if (w) {
        if (b.dataUrl.startsWith('data:image')) {
          w.document.write(`<title>${b.file}</title><body style="margin:0;display:flex;justify-content:center;align-items:center;background:#0f172a;"><img src="${b.dataUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body>`);
        } else {
          w.document.write(`<title>${b.file}</title><body style="margin:0;"><iframe src="${b.dataUrl}" style="width:100%;height:100vh;border:none;"></iframe></body>`);
        }
      }
    } else {
      window.open(URL.createObjectURL(new Blob([`Duty Sheet: ${b.file}\n\nThis is a securely generated placeholder.`], {type: 'text/plain'})), '_blank');
    }
  };

  if (loading && !duty && bulkDuties.length === 0) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-indigo-500" /></div>;
  
  // If no API duty but bulk duties exist, show bulk panel only
  if (!duty) {
    return (
      <div className="space-y-6 animate-fade-slide max-w-5xl mx-auto">
        <div className="page-header">
          <div><h1 className="page-title">My Duty Overview</h1><p className="page-subtitle">Your assigned exam duties</p></div>
          <button onClick={fetchDuty} className="btn-icon"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
        {bulkDuties.length > 0 ? (
          <div className="glass-card p-5 border border-indigo-500/20 bg-gradient-to-br from-indigo-500/6 to-violet-500/4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center"><span className="text-base">📄</span></div>
              <div><p className="text-sm font-semibold text-white">Duty Sheets from Admin</p><p className="text-xs text-slate-500">Published to all invigilators</p></div>
            </div>
            <div className="space-y-2">
              {bulkDuties.map((b, i) => (
                <div key={i} onClick={() => openDutyFile(b)} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] cursor-pointer transition-colors">
                  <div className="flex items-center gap-2"><span className="text-indigo-400">📎</span><p className="text-sm font-medium text-slate-200">{b.file}</p></div>
                  <span className="badge-success">Open</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500">No active duty assigned yet.</div>
        )}
      </div>
    );
  }

  const pct = duty.totalStudents > 0 ? Math.round((duty.verified / duty.totalStudents) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-slide max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="live-dot" style={{ width: 7, height: 7 }} />
            <span className="text-xs font-semibold text-emerald-400 ml-1">Duty Active</span>
            <span className="badge-info ml-1">Exam in Progress</span>
          </div>
          <h1 className="page-title">My Duty Overview</h1>
          <p className="page-subtitle">{duty.date}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDuty} className="btn-icon">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button id="download-attendance-btn" onClick={() => window.open(URL.createObjectURL(new Blob([`Attendance Sheet for ${duty.exam}\nDate: ${duty.date}\nRoom: ${duty.room}`], {type: 'text/plain'})), '_blank')} className="btn-secondary text-sm py-2.5 px-4">
            <Download size={14} /> Download Sheet
          </button>
        </div>
      </div>

      {/* ── Bulk uploaded duty documents (visible to all invigilators) ── */}
      {bulkDuties.length > 0 && (
        <div className="glass-card p-4 border border-indigo-500/20 bg-gradient-to-br from-indigo-500/6 to-violet-500/4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center"><span className="text-sm">📄</span></div>
            <div>
              <p className="text-sm font-semibold text-white">Duty Sheets from Admin</p>
              <p className="text-xs text-slate-500">Uploaded by admin — visible to all invigilators</p>
            </div>
          </div>
          <div className="space-y-2">
            {bulkDuties.map((b, i) => (
              <div key={i} onClick={() => openDutyFile(b)} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.1] cursor-pointer transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-indigo-400 font-mono">📎</span>
                  <p className="text-xs font-medium text-slate-200 hover:text-indigo-300 transition-colors">{b.file}</p>
                  <span className="text-[10px] text-slate-500">{new Date(b.uploadedAt).toLocaleDateString()}</span>
                </div>
                <span className="badge-success text-[10px]">Open PDF</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Duty info card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20
                      bg-gradient-to-br from-emerald-500/6 via-[#04060f] to-teal-500/4
                      shadow-xl shadow-emerald-500/8">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="p-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="col-span-2 md:col-span-1">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Exam Session</p>
              <div className="flex items-center gap-2.5">
                <div className="icon-box-emerald flex-shrink-0">
                  <BookOpen size={16} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{duty.exam}</p>
                  <p className="text-xs text-slate-500 font-mono">{duty.code}</p>
                </div>
              </div>
            </div>

            {[
              { icon: MapPin, label: 'Assigned Room', val: `Room ${duty.room}`, sub: duty.floor },
              { icon: Clock, label: 'Exam Timing', val: duty.time, sub: '3 Hours Duration' },
              { icon: Calendar, label: 'Date', val: duty.date, sub: 'Duty Day' },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">{item.label}</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
                    <item.icon size={15} className="text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{item.val}</p>
                    <p className="text-[11px] text-slate-500">{item.sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        {[
          { label: 'Total Students', val: duty.totalStudents, color: 'text-indigo-400', bg: 'from-indigo-500/12 to-violet-500/6', border: 'border-indigo-500/20', icon: Users },
          { label: 'Verified Present', val: duty.verified, color: 'text-emerald-400', bg: 'from-emerald-500/12 to-teal-500/6', border: 'border-emerald-500/20', icon: UserCheck },
          { label: 'Washroom Out', val: duty.washroom, color: 'text-amber-400', bg: 'from-amber-500/12 to-orange-500/6', border: 'border-amber-500/20', icon: AlertTriangle },
          { label: 'Marked Absent', val: duty.absent, color: 'text-rose-400', bg: 'from-rose-500/12 to-pink-500/6', border: 'border-rose-500/20', icon: WifiOff },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`glass-card p-5 bg-gradient-to-br ${s.bg} border ${s.border} hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{s.label}</p>
                <Icon size={14} className={s.color} />
              </div>
              <p className={`text-3xl font-bold ${s.color}`} style={{ fontFamily: 'Sora, Inter, sans-serif' }}>{s.val}</p>
            </div>
          );
        })}
      </div>

      {/* ── Verification progress ── */}
      <div className="glass-card p-5 bg-gradient-to-r from-emerald-500/6 to-teal-500/4 border-emerald-500/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity size={14} className="text-emerald-400" />
              Verification Progress
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {duty.verified} verified · {duty.absent} absent · {duty.totalStudents - duty.verified - duty.absent} remaining
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-emerald-400" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>{pct}%</p>
            <p className="text-[10px] text-slate-500">completion</p>
          </div>
        </div>
        <div className="h-3 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-1000 relative"
            style={{ width: `${pct}%` }}
          >
            <div className="absolute inset-0 animate-shimmer rounded-full" />
          </div>
        </div>
      </div>

      {/* ── Student attendance table ── */}
      <div className="section-card">
        <div className="section-card-header">
          <div>
            <h3 className="section-card-title">Student Attendance List</h3>
            <p className="text-xs text-slate-500 mt-0.5">Room {duty.room} · {duty.totalStudents} students assigned</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="seas-table">
            <thead>
              <tr>
                <th>Seat</th>
                <th>Student</th>
                <th>Enrollment No.</th>
                <th>Verified At</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {duty.students.map((s, idx) => {
                const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.Pending;
                const StatusIcon = cfg.icon;
                return (
                  <tr key={s.seat || s.enrollment || idx} className={`${cfg.rowBg} group`}>
                    <td>
                      <span className="text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1.5 rounded-lg">
                        {s.seat || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/10 flex items-center justify-center text-[11px] font-bold text-indigo-400 flex-shrink-0">
                          {(s.name || 'Unknown')[0]}
                        </div>
                        <p className="text-sm font-semibold text-white">{s.name || 'Unknown'}</p>
                      </div>
                    </td>
                    <td>
                      <code className="text-xs text-slate-400 font-mono">{s.enrollment}</code>
                    </td>
                    <td>
                      <span className="text-xs text-slate-500 font-mono">{s.time}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <StatusIcon size={12} className={cfg.iconColor} />
                        <span className={cfg.badge}>{s.status}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvigilatorDashboard;
