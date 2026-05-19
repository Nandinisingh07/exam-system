import React, { useState, useEffect } from 'react';
import {
  Activity, CheckCircle, AlertTriangle, Clock,
  MapPin, Eye, RefreshCw, Shield, Zap,
  TrendingUp, Users, X
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const LIVE_EVENTS = [
  { id: 1, student: 'Arjun Sharma', enrollment: 'CS20230042', room: '101', type: 'Verified', time: '10:42:15', status: 'success' },
  { id: 2, student: 'Priya Patel', enrollment: 'CS20230058', room: '302', type: 'Washroom Exit', time: '10:40:02', status: 'warning' },
  { id: 3, student: 'Kiran Rao', enrollment: 'IT20230032', room: '201', type: 'Verified', time: '10:38:55', status: 'success' },
  { id: 4, student: 'Divya Kumar', enrollment: 'EC20230019', room: '101', type: 'Face Mismatch', time: '10:35:30', status: 'danger' },
  { id: 5, student: 'Rahul Verma', enrollment: 'ME20230112', room: '302', type: 'Washroom Return', time: '10:33:10', status: 'success' },
  { id: 6, student: 'Sneha Iyer', enrollment: 'CS20230089', room: '102', type: 'Verified', time: '10:31:00', status: 'success' },
  { id: 7, student: 'Amit Singh', enrollment: 'CS20230076', room: '303', type: 'Manual Override', time: '10:28:45', status: 'warning' },
  { id: 8, student: 'Meera Nair', enrollment: 'CS20230054', room: '101', type: 'Verified', time: '10:25:20', status: 'success' },
];

const RATE_DATA = [
  { t: '9AM', rate: 0 },
  { t: '9:30', rate: 85 },
  { t: '10AM', rate: 142 },
  { t: '10:30', rate: 98 },
  { t: '11AM', rate: 67 },
  { t: '11:30', rate: 45 },
  { t: '12PM', rate: 12 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) return (
    <div className="glass px-3 py-2 rounded-xl shadow-xl text-xs">
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className="text-indigo-400 font-semibold">{payload[0].value} verifications</p>
    </div>
  );
  return null;
};

const ROOM_LIVE = [
  { room: '101', status: 'Active', verified: 36, total: 38, alert: false },
  { room: '102', status: 'Active', verified: 40, total: 40, alert: false },
  { room: '201', status: 'Active', verified: 28, total: 32, alert: false },
  { room: '302', status: 'Alert', verified: 22, total: 28, alert: true },
  { room: '303', status: 'Active', verified: 30, total: 30, alert: false },
];

const Monitoring = () => {
  const [events, setEvents] = useState(LIVE_EVENTS);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
      setLastRefresh(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const totalVerified = ROOM_LIVE.reduce((a, r) => a + r.verified, 0);
  const totalStudents = ROOM_LIVE.reduce((a, r) => a + r.total, 0);

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="page-header">
        <div>
          <h1 className="page-title">Live Monitoring</h1>
          <p className="page-subtitle">Real-time entry, verification & movement tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20">
            <div className={`w-2 h-2 rounded-full bg-emerald-400 ${pulse ? 'scale-150' : ''} transition-transform`} />
            <span className="text-xs font-medium text-emerald-400">Live Feed</span>
          </div>
          <button className="btn-icon"><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Verified Today', val: totalVerified, sub: `of ${totalStudents}`, color: 'text-indigo-400', icon: CheckCircle },
          { label: 'Active Rooms', val: ROOM_LIVE.filter(r=>r.status==='Active').length, sub: 'All systems nominal', color: 'text-emerald-400', icon: Activity },
          { label: 'Washroom Out', val: 2, sub: 'Currently outside', color: 'text-amber-400', icon: Clock },
          { label: 'Alerts', val: 1, sub: 'Needs attention', color: 'text-rose-400', icon: AlertTriangle },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0">
              <s.icon size={16} className={s.color} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-[10px] text-slate-600">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Room heatmap */}
        <div className="section-card lg:col-span-1">
          <div className="section-card-header">
            <h3 className="section-card-title">Room Status</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400">Live</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {ROOM_LIVE.map(r => {
              const pct = Math.round((r.verified / r.total) * 100);
              return (
                <div key={r.room} className={`p-4 rounded-xl border transition-all ${r.alert ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Room {r.room}</span>
                      {r.alert && <AlertTriangle size={12} className="text-amber-400" />}
                    </div>
                    <span className="text-xs font-semibold text-white">{pct}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>{r.verified} verified</span><span>{r.total - r.verified} pending</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${r.alert ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Verification rate chart */}
        <div className="section-card lg:col-span-2">
          <div className="section-card-header">
            <div>
              <h3 className="section-card-title">Verification Rate</h3>
              <p className="text-xs text-slate-500 mt-0.5">Students verified per 30-minute interval</p>
            </div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={RATE_DATA}>
                <defs>
                  <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="#ffffff08" vertical={false} />
                <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} fill="url(#rateGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Live event list */}
          <div className="border-t border-white/[0.06]">
            <div className="px-5 py-3 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Events</h4>
              <span className="text-[10px] text-slate-600">Last: {lastRefresh.toLocaleTimeString()}</span>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {events.slice(0, 6).map(ev => (
                <div key={ev.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] border-t border-white/[0.04]">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    ev.status === 'success' ? 'bg-emerald-400' :
                    ev.status === 'warning' ? 'bg-amber-400' : 'bg-rose-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{ev.student} <span className="text-slate-500 font-mono">({ev.enrollment})</span></p>
                    <p className="text-[10px] text-slate-500">{ev.type} · Room {ev.room}</p>
                  </div>
                  <span className="text-[10px] text-slate-600 flex-shrink-0 font-mono">{ev.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
