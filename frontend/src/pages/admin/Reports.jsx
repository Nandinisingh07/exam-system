import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Search, Download, Filter, Users, CheckCircle, AlertTriangle, User, Calendar } from 'lucide-react';

const MOCK_INVIGILATORS = [
  { name: 'Shweta Agrawal', email: 'shweta@exam.com', room: '101', exam: 'CS-402', date: '2026-05-22', verified: 36, absent: 2, washroom: 1, total: 39 },
  { name: 'Anita Sharma', email: 'anita@exam.com', room: '201', exam: 'ME-301', date: '2026-05-22', verified: 28, absent: 3, washroom: 0, total: 31 },
  { name: 'Rajesh Kumar', email: 'rajesh@exam.com', room: '302', exam: 'EC-201', date: '2026-05-22', verified: 22, absent: 4, washroom: 2, total: 28 },
  { name: 'Priya Singh', email: 'priya@exam.com', room: '102', exam: 'CS-403', date: '2026-05-23', verified: 40, absent: 0, washroom: 0, total: 40 },
];

const MOCK_RECORDS = [
  { invigilator: 'Shweta Agrawal', seat: 'A-01', name: 'Arjun Sharma', enrollment: 'CS20230042', room: '101', exam: 'CS-402', time: '09:04', status: 'Verified', method: 'Face+ID+QR' },
  { invigilator: 'Shweta Agrawal', seat: 'A-02', name: 'Priya Patel', enrollment: 'CS20230058', room: '101', exam: 'CS-402', time: '09:07', status: 'Verified', method: 'Face+ID+QR' },
  { invigilator: 'Shweta Agrawal', seat: 'A-03', name: 'Divya Kumar', enrollment: 'CS20230019', room: '101', exam: 'CS-402', time: '—', status: 'Absent', method: '—' },
  { invigilator: 'Anita Sharma', seat: 'B-01', name: 'Kiran Rao', enrollment: 'IT20230032', room: '201', exam: 'ME-301', time: '09:11', status: 'Verified', method: 'Face+ID+QR' },
  { invigilator: 'Anita Sharma', seat: 'B-02', name: 'Rahul Verma', enrollment: 'ME20230112', room: '201', exam: 'ME-301', time: '09:03', status: 'Washroom', method: 'Face+ID+QR' },
  { invigilator: 'Rajesh Kumar', seat: 'C-01', name: 'Sneha Iyer', enrollment: 'CS20230089', room: '302', exam: 'EC-201', time: '09:09', status: 'Verified', method: 'Face+ID+QR' },
];

const Reports = () => {
  const [selInvig, setSelInvig] = useState('All');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('records');

  const invigilators = ['All', ...MOCK_INVIGILATORS.map(i => i.name)];

  const filteredRecords = MOCK_RECORDS.filter(r =>
    (selInvig === 'All' || r.invigilator === selInvig) &&
    (r.name.toLowerCase().includes(search.toLowerCase()) || r.enrollment.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredInvig = MOCK_INVIGILATORS.filter(i =>
    selInvig === 'All' || i.name === selInvig
  );

  const totalVerified = filteredRecords.filter(r => r.status === 'Verified').length;
  const totalAbsent = filteredRecords.filter(r => r.status === 'Absent').length;
  const totalWashroom = filteredRecords.filter(r => r.status === 'Washroom').length;

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheck size={13} className="text-indigo-400" />
            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Attendance Management</span>
          </div>
          <h1 className="page-title">Attendance Records</h1>
          <p className="page-subtitle">3-way verified (Face + ID + QR) attendance from all invigilator dashboards</p>
        </div>
        <button className="btn-secondary text-sm py-2.5 px-4"><Download size={14} /> Export All</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Verified', val: totalVerified, color: 'text-emerald-400', bg: 'from-emerald-500/10 to-teal-500/5', border: 'border-emerald-500/20', icon: CheckCircle },
          { label: 'Marked Absent', val: totalAbsent, color: 'text-rose-400', bg: 'from-rose-500/10 to-pink-500/5', border: 'border-rose-500/20', icon: AlertTriangle },
          { label: 'In Washroom', val: totalWashroom, color: 'text-amber-400', bg: 'from-amber-500/10 to-orange-500/5', border: 'border-amber-500/20', icon: Users },
          { label: 'Total Records', val: filteredRecords.length, color: 'text-indigo-400', bg: 'from-indigo-500/10 to-violet-500/5', border: 'border-indigo-500/20', icon: ClipboardCheck },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`glass-card p-4 bg-gradient-to-br ${s.bg} border ${s.border}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{s.label}</p>
                <Icon size={14} className={s.color} />
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Search student name or enrollment…" value={search} onChange={e => setSearch(e.target.value)} className="seas-input pl-9 py-2.5 text-xs" />
        </div>
        <div className="flex items-center gap-2">
          <User size={13} className="text-slate-500" />
          <select className="seas-input text-xs py-2.5 pr-8" value={selInvig} onChange={e => setSelInvig(e.target.value)}>
            {invigilators.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1 w-fit">
        {[{ k: 'records', label: 'Attendance Records' }, { k: 'summary', label: 'Invigilator Summary' }].map(t => (
          <button key={t.k} onClick={() => setActiveTab(t.k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.k ? 'bg-indigo-500/15 text-white border border-indigo-500/25' : 'text-slate-500 hover:text-slate-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'records' && (
        <div className="section-card overflow-x-auto">
          <table className="seas-table">
            <thead><tr><th>Seat</th><th>Student</th><th>Enrollment</th><th>Invigilator</th><th>Exam / Room</th><th>Time</th><th>Verification</th><th>Status</th></tr></thead>
            <tbody>
              {filteredRecords.map((r, i) => (
                <tr key={i}>
                  <td><span className="text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-lg">{r.seat}</span></td>
                  <td><p className="text-sm font-semibold text-white">{r.name}</p></td>
                  <td><code className="text-xs text-slate-400 font-mono">{r.enrollment}</code></td>
                  <td><p className="text-xs text-slate-300">{r.invigilator}</p></td>
                  <td><p className="text-xs font-mono text-indigo-400">{r.exam}</p><p className="text-[10px] text-slate-500">Room {r.room}</p></td>
                  <td><span className="text-xs font-mono text-slate-400">{r.time}</span></td>
                  <td><span className="text-[10px] text-emerald-400 font-semibold">{r.method}</span></td>
                  <td><span className={r.status === 'Verified' ? 'badge-success' : r.status === 'Absent' ? 'badge-danger' : 'badge-warning'}>{r.status}</span></td>
                </tr>
              ))}
              {filteredRecords.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-slate-500 text-xs">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="space-y-3">
          {filteredInvig.map((inv, i) => {
            const pct = Math.round((inv.verified / inv.total) * 100);
            return (
              <div key={i} className="section-card p-5">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 flex items-center justify-center text-sm font-bold text-indigo-400 flex-shrink-0">{inv.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{inv.name}</p>
                    <p className="text-xs text-slate-500">{inv.exam} · Room {inv.room} · {inv.date}</p>
                  </div>
                  <div className="flex items-center gap-6 text-center">
                    {[{ l: 'Verified', v: inv.verified, c: 'text-emerald-400' }, { l: 'Absent', v: inv.absent, c: 'text-rose-400' }, { l: 'Washroom', v: inv.washroom, c: 'text-amber-400' }].map(s => (
                      <div key={s.l}>
                        <p className={`text-lg font-bold ${s.c}`}>{s.v}</p>
                        <p className="text-[10px] text-slate-500">{s.l}</p>
                      </div>
                    ))}
                  </div>
                  <div className="w-32 text-right">
                    <p className="text-sm font-bold text-white mb-1">{pct}%</p>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <button className="btn-secondary text-xs py-2 px-3"><Download size={12} /> Export</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Reports;
