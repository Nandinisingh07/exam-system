import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Search, Download, Filter, Users, CheckCircle, AlertTriangle, User, Calendar, RefreshCw, ChevronDown } from 'lucide-react';
import { attendanceApi } from '../../services/api';

const Reports = () => {
  const [selInvig, setSelInvig] = useState('All');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('records');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showFmt, setShowFmt] = useState(false);
  const dropRef = React.useRef(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getAll();
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching attendance records:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const invigilators = ['All', ...Array.from(new Set(records.map(r => r.invigilator)))];

  const filteredRecords = records.filter(r =>
    (selInvig === 'All' || r.invigilator === selInvig) &&
    ((r.name || '').toLowerCase().includes(search.toLowerCase()) || (r.enrollment || '').toLowerCase().includes(search.toLowerCase()))
  );

  // Group records by invigilator to generate summary statistics
  const summaryGroup = {};
  records.forEach(r => {
    const key = r.invigilator;
    if (!summaryGroup[key]) {
      summaryGroup[key] = {
        name: r.invigilator,
        email: `${r.invigilator.toLowerCase().replace(/\s+/g, '')}@exam.com`,
        room: r.room,
        exam: r.exam,
        date: 'Today',
        verified: 0,
        absent: 0,
        washroom: 0,
        total: 0
      };
    }

    summaryGroup[key].total += 1;
    if (r.status === 'Verified' || r.status === 'Present') {
      summaryGroup[key].verified += 1;
    } else if (r.status === 'Absent') {
      summaryGroup[key].absent += 1;
    } else if (r.status === 'Washroom') {
      summaryGroup[key].washroom += 1;
    }
  });

  const invigSummaryList = Object.values(summaryGroup);

  const filteredInvig = invigSummaryList.filter(i =>
    selInvig === 'All' || i.name === selInvig
  );

  const totalVerified = filteredRecords.filter(r => r.status === 'Verified' || r.status === 'Present').length;
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
        <div className="flex items-center gap-2">
          <button onClick={fetchRecords} className="btn-icon">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="relative" ref={dropRef}>
            <button onClick={() => setShowFmt(v => !v)} disabled={exporting || records.length === 0} className="btn-secondary text-sm py-2.5 px-4 flex items-center gap-2">
              <Download size={14} />{exporting ? "Exporting…" : "Export All"}<ChevronDown size={12} className={`transition-transform ${showFmt ? "rotate-180" : ""}`} />
            </button>
            {showFmt && (
              <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-white/10 bg-slate-900 shadow-xl overflow-hidden">
                {[{label:"Export CSV",fmt:"csv",ext:"csv",mime:"text/csv"},{label:"Export Excel",fmt:"excel",ext:"xlsx",mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},{label:"Export PDF",fmt:"pdf",ext:"pdf",mime:"application/pdf"}].map(opt => (
                  <button key={opt.fmt} onClick={async () => { setShowFmt(false); setExporting(true); try { const res = await attendanceApi.exportAllWithAuth(opt.fmt); const url = window.URL.createObjectURL(new Blob([res.data],{type:opt.mime})); const a = document.createElement("a"); a.href=url; a.setAttribute("download",`all_attendance.${opt.ext}`); document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url); } catch(e){alert("Export failed. Install reportlab & openpyxl on backend.");} finally{setExporting(false);} }} className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-indigo-500/15 hover:text-white transition-colors">{opt.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
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
              {filteredRecords.map((r, i) => {
                const displayStatus = r.status === 'Present' ? 'Verified' : r.status;
                return (
                  <tr key={i}>
                    <td><span className="text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-lg">{r.seat}</span></td>
                    <td><p className="text-sm font-semibold text-white">{r.name}</p></td>
                    <td><code className="text-xs text-slate-400 font-mono">{r.enrollment}</code></td>
                    <td><p className="text-xs text-slate-300">{r.invigilator}</p></td>
                    <td><p className="text-xs font-mono text-indigo-400">{r.exam}</p><p className="text-[10px] text-slate-500">Room {r.room}</p></td>
                    <td><span className="text-xs font-mono text-slate-400">{r.time}</span></td>
                    <td><span className="text-[10px] text-emerald-400 font-semibold">{r.method}</span></td>
                    <td><span className={displayStatus === 'Verified' ? 'badge-success' : displayStatus === 'Absent' ? 'badge-danger' : 'badge-warning'}>{displayStatus}</span></td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-slate-500 text-xs">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="space-y-3">
          {filteredInvig.map((inv, i) => {
            const pct = inv.total > 0 ? Math.round((inv.verified / inv.total) * 100) : 0;
            return (
              <div key={i} className="section-card p-5">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 flex items-center justify-center text-sm font-bold text-indigo-400 flex-shrink-0">{inv.name ? inv.name[0] : 'I'}</div>
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
                  <button onClick={async () => { try { const res = await attendanceApi.exportInvigilatorWithAuth(inv.id, "pdf"); const url = window.URL.createObjectURL(new Blob([res.data], {type:"application/pdf"})); const a = document.createElement("a"); a.href=url; a.setAttribute("download", `attendance_${inv.name}.pdf`); document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url); } catch(e){ alert("Export failed: " + e.message); }}} className="btn-secondary text-xs py-2 px-3 flex items-center gap-1"><Download size={12} /> Export PDF</button>
                </div>
              </div>
            );
          })}
          {filteredInvig.length === 0 && (
            <div className="text-center py-20 text-slate-500 text-xs">No invigilator duty records found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
