import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X as XIcon } from 'lucide-react';
import {
  LayoutDashboard, Users, Calendar, MapPin, Shield, Scan, Clock,
  FileBarChart, Settings, LogOut, ChevronRight, GraduationCap,
  ClipboardCheck, UserCog, QrCode, Activity, Zap
} from 'lucide-react';
import { adminApi } from '../services/api';

const ROLE_NAV = {
  admin: {
    label: 'Administrator', icon: UserCog,
    accentClass: 'active',
    chipColor: 'rgba(6,182,212,0.15)', chipText: '#22d3ee', chipBorder: 'rgba(6,182,212,0.3)',
    avatarGradient: 'linear-gradient(135deg,#0891b2,#06b6d4)',
    logoGlow: 'rgba(6,182,212,0.5)',
    sections: [
      { title:'Overview', items:[
        { name:'Dashboard',         icon:LayoutDashboard, path:'/admin/overview',    badge:null },
      ]},
      { title:'Academic', items:[
        { name:'Students',          icon:Users,           path:'/admin/students',    badge:null },
        { name:'Invigilators',      icon:Shield,          path:'/admin/invigilators',badge:null },
        { name:'Exams & Duty',      icon:Calendar,        path:'/admin/exam-duty',   badge:null },
        { name:'Classrooms',        icon:MapPin,          path:'/admin/rooms',       badge:null },
      ]},
      { title:'Operations', items:[
        { name:'Live Monitoring',   icon:Activity,        path:'/admin/monitoring',  badge:'LIVE', live:true },
        { name:'Reports',           icon:FileBarChart,    path:'/admin/reports',     badge:null },
      ]},
    ],
  },
  invigilator: {
    label: 'Invigilator', icon: Shield,
    accentClass: 'active-emerald',
    chipColor: 'rgba(16,185,129,0.15)', chipText: '#6ee7b7', chipBorder: 'rgba(16,185,129,0.3)',
    avatarGradient: 'linear-gradient(135deg,#059669,#10b981)',
    logoGlow: 'rgba(16,185,129,0.5)',
    sections: [
      { title:'My Duties', items:[
        { name:'Duty Overview',     icon:LayoutDashboard, path:'/invigilator/dashboard', badge:null },
        { name:'Verification Kiosk',icon:Scan,            path:'/invigilator/kiosk', badge:null },
        { name:'Attendance Logs',   icon:ClipboardCheck,  path:'/invigilator/attendance', badge:null },
        { name:'Washroom Tracking', icon:Clock,           path:'/invigilator/washroom', badge:null },
      ]},
    ],
  },
};

export default function Sidebar({ role, user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const cfg = ROLE_NAV[role] || ROLE_NAV.admin;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    if (role === 'admin') {
      const fetchStats = async () => {
        try {
          const res = await adminApi.getOverview();
          setStats(res.data.stats);
        } catch (err) {
          console.error(err);
        }
      };
      fetchStats();
      const interval = setInterval(fetchStats, 10000); // Refresh every 10s
      return () => clearInterval(interval);
    }
  }, [role]);

  const studentCount = stats?.students?.toLocaleString() || '...';
  const examCount = stats?.exams?.toString() || '...';

  const handleLogout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login');
  };

  return (
    <div style={{ width:'280px', height:'100vh', position:'fixed', left:0, top:0, zIndex:50,
                   background:'var(--bg-sidebar)', borderRight:'1px solid var(--border)',
                   display:'flex', flexDirection:'column', backdropFilter:'blur(20px)' }}>

      {/* Logo */}
      <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ position:'relative', flexShrink:0 }}>
            <div style={{ position:'absolute', inset:'-4px', background:cfg.avatarGradient,
                           borderRadius:'14px', filter:'blur(10px)', opacity:0.5 }} />
            <div style={{ position:'relative', width:'38px', height:'38px', borderRadius:'12px',
                           background:cfg.avatarGradient,
                           display:'flex', alignItems:'center', justifyContent:'center',
                           boxShadow:`0 4px 15px ${cfg.logoGlow}` }}>
              <Shield size={18} color="#fff" />
            </div>
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontFamily:'Sora,sans-serif', fontSize:'15px', fontWeight:800,
                               color:'#fff', letterSpacing:'-0.01em' }}>SEAS</span>
              <span style={{ fontSize:'9px', fontWeight:700, padding:'2px 6px', borderRadius:'6px',
                               background:cfg.chipColor, color:cfg.chipText,
                               border:`1px solid ${cfg.chipBorder}`, letterSpacing:'0.06em' }}>v2.0</span>
            </div>
            <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)', marginTop:'1px' }}>Exam Automation System</p>
          </div>
        </div>
      </div>

      {/* User profile */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 12px',
                       borderRadius:'12px', background:'rgba(255,255,255,0.03)',
                       border:'1px solid rgba(255,255,255,0.06)', cursor:'pointer',
                       transition:'all 0.2s ease' }}
             onMouseOver={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; }}
             onMouseOut={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'; }}>
          <div style={{ position:'relative', flexShrink:0 }}>
            <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:cfg.avatarGradient,
                           display:'flex', alignItems:'center', justifyContent:'center',
                           fontSize:'13px', fontWeight:700, color:'#fff',
                           boxShadow:`0 3px 10px ${cfg.logoGlow.replace('0.5','0.4')}` }}>
              {user?.name?.[0] || 'U'}
            </div>
            <div style={{ position:'absolute', bottom:'-2px', right:'-2px', width:'10px', height:'10px',
                           borderRadius:'50%', background:'#10b981',
                           border:'2px solid #08081a', zIndex:1 }}>
              <div style={{ position:'absolute', inset:'-2px', borderRadius:'50%', background:'#10b981',
                             opacity:0.5, animation:'livePing 1.5s ease-out infinite' }} />
            </div>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:'13px', fontWeight:600, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {user?.name || 'User'}
            </p>
            <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)', textTransform:'capitalize', marginTop:'1px' }}>{role} account</p>
          </div>
          <ChevronRight size={13} color="rgba(255,255,255,0.25)" />
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex:1, overflowY:'auto', padding:'16px 12px' }}>
        {cfg.sections.map((section, si) => (
          <div key={section.title} style={{ marginBottom:'24px' }}>
            <p style={{ fontSize:'10px', fontWeight:700, color:'rgba(255,255,255,0.25)',
                          textTransform:'uppercase', letterSpacing:'0.16em',
                          padding:'0 10px', marginBottom:'6px' }}>{section.title}</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
              {section.items.map((item, idx) => {
                const Icon = item.icon;
                let b = item.badge;
                if (role === 'admin' && item.name === 'Students') b = studentCount;
                if (role === 'admin' && item.name === 'Exams & Duty') b = examCount;

                return (
                  <NavLink
                    key={`${item.path}-${item.name}`} to={item.path}
                    style={{ animationDelay:`${si*100 + idx*50}ms` }}
                    className={({ isActive }) => `sidebar-link${isActive ? ' '+cfg.accentClass : ''}`}>
                    <Icon size={15} style={{ flexShrink:0 }} />
                    <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</span>
                    {item.live && (
                      <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        <span className="live-dot" style={{ width:'6px', height:'6px' }} />
                        <span style={{ fontSize:'9px', fontWeight:700, color:'#34d399', letterSpacing:'0.05em' }}>LIVE</span>
                      </span>
                    )}
                    {b && !item.live && (
                      <span style={{ fontSize:'10px', fontWeight:600, padding:'1px 7px', borderRadius:'6px',
                                      background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.35)' }}>
                        {b}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Quick stats for admin */}
      {role === 'admin' && (
        <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
            {[
              { l:'Students', v:studentCount, c:'#22d3ee' },
              { l:'Exams', v:examCount, c:'#22d3ee' },
              { l:'Alerts', v:stats?.alerts || '0', c:'#fb7185' },
            ].map(s=>(
              <div key={s.l} style={{ textAlign:'center' }}>
                <p style={{ fontSize:'14px', fontWeight:700, color:s.c }}>{s.v}</p>
                <p style={{ fontSize:'9px', color:'rgba(255,255,255,0.3)', marginTop:'1px' }}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div style={{ padding:'10px 12px 20px', display:'flex', flexDirection:'column', gap:'2px' }}>
        <button className="sidebar-link" style={{ width:'100%', border:'none', cursor:'pointer' }}>
          <Settings size={15} /><span>Settings</span>
        </button>
        <button id="sidebar-logout" onClick={handleLogout}
          className="sidebar-link"
          style={{ width:'100%', border:'none', cursor:'pointer', color:'rgba(244,63,94,0.7)' }}
          onMouseOver={e=>{ e.currentTarget.style.background='rgba(244,63,94,0.08)'; e.currentTarget.style.color='#fb7185'; }}
          onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(244,63,94,0.7)'; }}>
          <LogOut size={15} /><span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}



