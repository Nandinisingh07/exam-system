import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Calendar, UserCheck, AlertTriangle, TrendingUp, TrendingDown,
  ArrowUpRight, CheckCircle, Clock, Download, RefreshCw, Eye, MapPin,
  FileBarChart, Zap, Activity, ShieldCheck, ShieldAlert, Droplets,
  PieChart as PieChartIcon
} from 'lucide-react';
import { adminApi } from '../../services/api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

/* â”€â”€ Animated counter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function useCountUp(target, duration = 1800) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; started.current = true;
    const num = parseInt(String(target).replace(/\D/g, '')) || 0;
    let start = null;
    const step = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(ease * num));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

const ACCENT = {
  violet: { box: 'icon-box-violet', bar: '#7c3aed', border: 'rgba(124,58,237,0.2)', css: 'stat-accent-violet' },
  cyan: { box: 'icon-box-cyan', bar: '#06b6d4', border: 'rgba(6,182,212,0.2)', css: 'stat-accent-cyan' },
  emerald: { box: 'icon-box-emerald', bar: '#10b981', border: 'rgba(16,185,129,0.2)', css: 'stat-accent-emerald' },
  rose: { box: 'icon-box-rose', bar: '#f43f5e', border: 'rgba(244,63,94,0.2)', css: 'stat-accent-rose' },
};

function StatCard({ title, raw, display, sub, icon: Icon, accent, trend, tv }) {
  const a = ACCENT[accent] || ACCENT.violet;
  const counted = useCountUp(raw);
  const formatted = display.includes(',') ? counted.toLocaleString() : String(counted);
  return (
    <div className={`glass-card p-5 border border-slate-200 hover:shadow-xl transition-all duration-300 group relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.02] rounded-full -translate-y-8 translate-x-8" />
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-xl bg-white/[0.03] border border-slate-200`}>
          <Icon size={18} className="text-white/70" />
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          {trend === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {tv}
        </div>
      </div>
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{title}</p>
      <p className="text-3xl font-black text-slate-800" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>{formatted}</p>
      <p className="text-[10px] text-slate-500 mt-2">{sub}</p>
    </div>
  );
}

const CustomTip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 border-white/[0.1] shadow-2xl">
        <p className="text-[10px] font-bold text-slate-500 mb-1">{payload[0].payload.time || payload[0].payload.day}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
            <p className="text-xs font-bold text-white">{p.value} {p.name}</p>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Overview() {
  const [timeRange, setTimeRange] = useState('today');
  const [spin, setSpin] = useState(false);
  const [data, setData] = useState({
    stats: [],
    attendance: [],
    verify_data: [],
    rooms: [],
    feed: [],
    pie: []
  });

  const fetchData = async () => {
    try {
      setSpin(true);
      const res = await adminApi.getOverview();
      const d = res.data || {};
      const stats = d.stats || { students: 0, verified: 0, exams: 0, alerts: 0 };
      const vRate = stats.students > 0 ? Math.round((stats.verified / stats.students) * 100) : 0;
      
      setData({
        stats: [
          { key:'students', title:'Total Students', raw:stats.students, display:(stats.students ?? 0).toLocaleString(), sub:'Registered in system', icon:Users, accent:'violet', trend:'up', tv:'+12%' },
          { key:'exams', title:'Active Exams', raw:stats.exams, display:(stats.exams ?? 0).toString(), sub:'Ongoing right now', icon:Calendar, accent:'cyan', trend:'up', tv:'+2' },
          { key:'verified', title:'Verified Today', raw:stats.verified, display:(stats.verified ?? 0).toString(), sub:`${vRate}% verification rate`, icon:UserCheck, accent:'emerald', trend:'up', tv:`${vRate}%`},
          { key:'alerts', title:'Active Alerts', raw:stats.alerts, display:(stats.alerts ?? 0).toString(), sub:'Require attention', icon:AlertTriangle, accent:'rose', trend:stats.alerts>0?'up':'down', tv:stats.alerts>0?`+${stats.alerts}`:'0' },
        ],
        attendance: d.attendance || [],
        verify_data: d.verify_data || [],
        rooms: d.rooms || [],
        feed: d.feed || [],
        pie: d.pie || []
      });
    } catch (e) {
      console.error('Error fetching admin overview', e);
    } finally {
      setSpin(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-6 animate-fade-slide">
      {/* â”€â”€ Hero header â”€â”€ */}
      <div className="relative rounded-2xl overflow-hidden p-7 bg-white/80 border border-indigo-100 backdrop-blur-sm">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-indigo-400" />
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Admin Command Center</span>
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>
              System <span className="text-gradient">Overview</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span className="live-dot" /> Live Monitoring Active Â· {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="btn-icon">
              <RefreshCw size={14} className={spin ? 'animate-spin' : ''} />
            </button>
            <button className="btn-primary">
              <Download size={14} /> Export Global Report
            </button>
          </div>
        </div>
      </div>

      {/* â”€â”€ Stat cards â”€â”€ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {data.stats.map(s => <StatCard key={s.key} {...s} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-8 space-y-6">
          <div className="section-card p-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity size={14} className="text-indigo-400" />
                  Verification Trends
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">Real-time student check-in volume</p>
              </div>
              <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
                <button className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-indigo-500/10">LATEST</button>
                <button className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-500">24H</button>
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.verify_data}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10}} />
                  <Tooltip content={<CustomTip />} />
                  <Area type="monotone" dataKey="v" name="Verified" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="section-card p-5">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                      <FileBarChart size={14} className="text-emerald-400" />
                      Weekly Attendance
                   </h3>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.attendance}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 9}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 9}} />
                      <Tooltip content={<CustomTip />} />
                      <Bar dataKey="present" name="Present" fill="#10b981" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             </div>

             <div className="section-card p-5">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                      <PieChartIcon size={14} className="text-cyan-400" />
                      Status Distribution
                   </h3>
                </div>
                <div className="h-48 flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.pie} innerRadius={40} outerRadius={65} paddingAngle={5} dataKey="value" strokeWidth={0}>
                        {data.pie.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
             </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="section-card flex flex-col h-full">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
               <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                 <ShieldAlert size={14} className="text-amber-400" />
                 Live Activity
               </h3>
               <span className="live-dot" />
            </div>
            <div className="flex-1 p-5 space-y-5 overflow-y-auto max-h-[600px]">
              {data.feed.length > 0 ? data.feed.map((a, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-lg bg-white/[0.03] border border-slate-200 flex items-center justify-center flex-shrink-0`}>
                      {a.s === 'success' ? <CheckCircle size={13} className="text-emerald-400" /> : a.s === 'warning' ? <AlertTriangle size={13} className="text-amber-400" /> : <Info size={13} className="text-indigo-400" />}
                    </div>
                    {i < data.feed.length - 1 && <div className="w-[1px] flex-1 bg-white/[0.05] my-2" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">{a.msg}</p>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[10px] text-slate-600 font-mono flex items-center gap-1"><MapPin size={9} /> {a.room}</span>
                       <span className="text-[10px] text-slate-600 flex items-center gap-1"><Clock size={9} /> {a.time}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-10">
                   <p className="text-xs text-slate-500">No activity yet</p>
                </div>
              )}
            </div>
            <button className="p-4 text-[10px] font-black text-slate-500 hover:text-indigo-400 transition-colors border-t border-slate-200 uppercase tracking-widest">
              View Detailed System Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ size, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}


