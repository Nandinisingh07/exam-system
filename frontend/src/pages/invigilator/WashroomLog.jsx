import React, { useState, useEffect } from 'react';
import {
  Clock, LogOut, LogIn, AlertTriangle, History,
  ShieldAlert, Plus, Search, UserCheck, Droplets,
  Timer, X, CheckCircle, RefreshCw
} from 'lucide-react';
import { monitoringApi, logisticsApi } from '../../services/api';

const formatDuration = (ms) => {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const WashroomLog = () => {
  const [logs, setLogs] = useState([]);
  const [now, setNow] = useState(new Date());
  const [manualId, setManualId] = useState('');
  const [showSuccess, setShowSuccess] = useState(null);
  const [examId, setExamId] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchExams = async () => {
    try {
      const res = await logisticsApi.getExams();
      setExams(res.data);
      if (res.data.length > 0) setExamId(res.data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    if (!examId) return;
    try {
      setLoading(true);
      const res = await monitoringApi.getWashroomLogs(examId);
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    fetchLogs();
    const id = setInterval(fetchLogs, 10000);
    return () => clearInterval(id);
  }, [examId]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const active = logs.filter(l => !l.entry_time);
  const history = logs.filter(l => l.entry_time);

  const isAlert = (exitTimeStr) => {
    const exit = new Date(exitTimeStr);
    return (now - exit) > 1000 * 60 * 10;
  };

  const elapsed = (exitTimeStr) => {
    const exit = new Date(exitTimeStr);
    return formatDuration(now - exit);
  };

  const handleReturn = async (logId, name) => {
    try {
      await monitoringApi.logEntry(logId);
      setShowSuccess(name);
      setTimeout(() => setShowSuccess(null), 3000);
      fetchLogs();
    } catch (err) {
      console.error(err);
      alert('Failed to log entry');
    }
  };

  const handleManualOut = async () => {
    if (!manualId.trim() || !examId) return;
    try {
      await monitoringApi.logExit(manualId.trim(), examId);
      setManualId('');
      fetchLogs();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to log exit');
    }
  };

  return (
    <div className="space-y-6 animate-fade-slide">
      {showSuccess && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-emerald-600 rounded-2xl shadow-2xl shadow-emerald-500/20 animate-fade-slide">
          <CheckCircle size={18} className="text-white flex-shrink-0" />
          <p className="text-sm font-semibold text-white">{showSuccess} marked as returned</p>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Washroom Monitoring</h1>
          <p className="page-subtitle">Live student movement tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            className="seas-input py-1.5 text-xs w-48"
            value={examId || ''}
            onChange={e => setExamId(parseInt(e.target.value))}
          >
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.subject_code} - {e.subject_name}</option>
            ))}
          </select>
          <button onClick={fetchLogs} className="btn-icon">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Currently Outside', val: active.length, color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Droplets },
          { label: 'Alerts Active', val: active.filter(l => isAlert(l.exit_time)).length, color: 'text-rose-400', bg: 'bg-rose-500/10', icon: AlertTriangle },
          { label: 'Returned Today', val: history.length, color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: UserCheck },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-sm font-semibold text-white">Currently Outside</h3>
          </div>

          {active.length === 0 ? (
            <div className="glass-card p-16 text-center border-dashed">
              <Droplets size={36} className="text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">All students are present in the hall</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {active.map(log => {
                const alert = isAlert(log.exit_time);
                const exitDate = new Date(log.exit_time);
                return (
                  <div
                    key={log.id}
                    className={`glass-card p-5 border-l-2 transition-all ${alert ? 'border-rose-500 bg-rose-500/[0.04]' : 'border-amber-500'} ${alert ? 'animate-pulse-slow' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${alert ? 'bg-rose-500/15' : 'bg-amber-500/10'}`}>
                          <Timer size={18} className={alert ? 'text-rose-400' : 'text-amber-400'} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{log.student_name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{log.enrollment}</p>
                        </div>
                      </div>
                      {alert && (
                        <div className="flex items-center gap-1 text-rose-400 text-[10px] font-bold px-2 py-1 bg-rose-500/10 rounded-lg border border-rose-500/20">
                          <AlertTriangle size={10} /> ALERT
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 py-3 border-y border-white/[0.05] mb-4">
                      <div>
                        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Exit Time</p>
                        <p className="text-xs font-semibold text-slate-300">{exitDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Elapsed</p>
                        <p className={`text-lg font-bold font-mono ${alert ? 'text-rose-400' : 'text-white'}`}>{elapsed(log.exit_time)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 flex-1">Room {log.room} · Seat {log.seat}</span>
                      <button
                        onClick={() => handleReturn(log.id, log.student_name)}
                        className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                      >
                        <LogIn size={12} /> Mark Returned
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="section-card mt-2">
            <div className="section-card-header">
              <div className="flex items-center gap-2">
                <History size={15} className="text-slate-500" />
                <h3 className="section-card-title">Movement History</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="seas-table">
                <thead><tr><th>Student</th><th>Exit</th><th>Return</th><th>Room</th></tr></thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td>
                        <p className="text-sm font-semibold text-white">{h.student_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{h.enrollment}</p>
                      </td>
                      <td className="text-xs text-slate-400 font-mono">{new Date(h.exit_time).toLocaleTimeString()}</td>
                      <td className="text-xs text-slate-400 font-mono">{new Date(h.entry_time).toLocaleTimeString()}</td>
                      <td className="text-xs text-slate-400">Room {h.room}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-5">
          <div className="section-card">
            <div className="section-card-header">
              <h3 className="section-card-title">Log Exit</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-400">Enter student enrollment number when they leave the hall.</p>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Enrollment Number</label>
                <input
                  type="text"
                  value={manualId}
                  onChange={e => setManualId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualOut()}
                  className="seas-input font-mono"
                  placeholder="CS20230XXX"
                />
              </div>
              <button
                onClick={handleManualOut}
                className="btn-primary w-full justify-center"
              >
                <LogOut size={15} /> Log Washroom Exit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WashroomLog;
