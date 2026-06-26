import React, { useState, useEffect, useRef } from "react";
import { ClipboardCheck, Download, Search, CheckCircle, RefreshCw, ChevronDown } from "lucide-react";
import { attendanceApi } from "../../services/api";
import { useTheme } from "../../context/ThemeContext";

const FMT_OPTS = [
  { label: "Export CSV",   fmt: "csv",   mime: "text/csv",                ext: "csv"  },
  { label: "Export Excel", fmt: "excel", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" },
  { label: "Export PDF",   fmt: "pdf",   mime: "application/pdf",         ext: "pdf"  },
];

const AttendanceLogs = () => {
  const { dark } = useTheme();
  const [records, setRecords]     = useState([]);
  const [search,  setSearch]      = useState("");
  const [loading, setLoading]     = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showFmt, setShowFmt]     = useState(false);
  const dropRef = useRef(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getMy();
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    const id = setInterval(fetchRecords, 20000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowFmt(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleExport = async (fmt, ext, mime) => {
    setShowFmt(false);
    setExporting(true);
    try {
      const res = await attendanceApi.exportAllWithAuth(fmt);
      const url  = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `my_attendance.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Export failed. Make sure reportlab & openpyxl are installed.");
    } finally {
      setExporting(false);
    }
  };

  const filtered = records.filter(r =>
    (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.enrollment || "").toLowerCase().includes(search.toLowerCase())
  );

  const present = filtered.filter(r => r.status === "Present" || r.status === "Verified").length;

  return (
    <div className="space-y-6 animate-fade-slide max-w-5xl mx-auto">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheck size={13} className="text-indigo-400" />
            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">My Records</span>
          </div>
          <h1 className="page-title">Attendance Logs</h1>
          <p className="page-subtitle">Students verified by you during exam duty</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRecords} className="btn-icon">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setShowFmt(v => !v)}
              disabled={exporting}
              className="btn-secondary text-sm py-2.5 px-4 flex items-center gap-2"
            >
              <Download size={14} />
              {exporting ? "Exporting..." : "Export"}
              <ChevronDown size={12} className={`transition-transform ${showFmt ? "rotate-180" : ""}`} />
            </button>
            {showFmt && (
              <div className={`absolute right-0 top-full mt-1 z-50 w-40 rounded-xl border ${dark ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'} shadow-xl overflow-hidden`}>
                {FMT_OPTS.map(opt => (
                  <button
                    key={opt.fmt}
                    onClick={() => handleExport(opt.fmt, opt.ext, opt.mime)}
                    className={`w-full text-left px-4 py-2.5 text-xs ${dark ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-indigo-600'} hover:bg-indigo-500/15 transition-colors`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Verified", val: present,        color: "text-emerald-400", border: "border-emerald-500/20", bg: "from-emerald-500/10 to-teal-500/5" },
          { label: "Total Records",  val: records.length, color: "text-indigo-400",  border: "border-indigo-500/20",  bg: "from-indigo-500/10 to-violet-500/5" },
          { label: "Showing",        val: filtered.length,color: dark ? "text-slate-300" : "text-slate-700", border: dark ? "border-white/10" : "border-slate-200", bg: dark ? "from-white/5 to-white/3" : "from-slate-500/5 to-slate-500/3" },
        ].map(s => (
          <div key={s.label} className={`glass-card p-4 bg-gradient-to-br ${s.bg} border ${s.border}`}>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} className="text-slate-500" />
        <input
          type="text"
          placeholder="Search by name or enrollment..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: '38px' }}
          className="seas-input py-2.5 text-xs w-full"
        />
      </div>

      <div className="section-card overflow-x-auto">
        <table className="seas-table">
          <thead>
            <tr>
              <th>Seat</th><th>Student</th><th>Enrollment</th><th>Room</th><th>Exam</th><th>Time</th><th>Verification</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const displayStatus = r.status === "Present" ? "Verified" : r.status;
              return (
                <tr key={i}>
                  <td><span className={`text-xs font-bold ${dark ? 'text-indigo-300' : 'text-indigo-600'} bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-lg`}>{r.seat || "—"}</span></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/10 flex items-center justify-center text-[11px] font-bold text-indigo-400 flex-shrink-0">
                        {(r.name || "?")[0]}
                      </div>
                      <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{r.name}</p>
                    </div>
                  </td>
                  <td><code className="text-xs text-slate-400 font-mono">{r.enrollment}</code></td>
                  <td><span className="text-xs text-slate-400">Room {r.room}</span></td>
                  <td><span className="text-xs font-mono text-indigo-400">{r.code || r.exam}</span></td>
                  <td><span className="text-xs font-mono text-slate-400">{r.time} {r.date}</span></td>
                  <td><span className="text-[10px] text-emerald-400 font-semibold">{r.method}</span></td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle size={11} className="text-emerald-400" />
                      <span className="badge-success">{displayStatus}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                {records.length === 0 ? "No attendance records yet — verify students to see them here." : "No records match your search."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceLogs;
