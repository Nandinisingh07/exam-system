import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell, Search, X, CheckCircle, AlertTriangle, Info, User, Settings, LogOut, ChevronDown, Clock } from 'lucide-react';

const NOTIFICATIONS = [
  { id:1, type:'success', title:'Verification Complete', msg:'Student Alex Pierce verified successfully', time:'2m ago', read:false },
  { id:2, type:'warning', title:'Washroom Alert', msg:'Student in Room 302 exceeded 10 min limit', time:'15m ago', read:false },
  { id:3, type:'info', title:'New Exam Added', msg:'CS-402 Computer Networks added to schedule', time:'1h ago', read:true },
  { id:4, type:'success', title:'Report Generated', msg:'Attendance report for April 27 is ready', time:'3h ago', read:true },
];

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return <span style={{ fontSize:'12px', fontFamily:'monospace', color:'rgba(255,255,255,0.3)' }}>
    {t.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
  </span>;
}

export default function Layout({ children }) {
  const [user, setUser] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) {
      navigate('/login');
    } else {
      setUser(JSON.parse(u));
    }
  }, [navigate]);

  useEffect(() => {
    const h = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const unread = notifications.filter(n => !n.read).length;
  const markRead = () => setNotifications(p => p.map(n => ({ ...n, read:true })));
  const handleLogout = () => { localStorage.clear(); navigate('/login'); };
  if (!user) return null;

  const avatarGrad = user.role==='admin' ? 'linear-gradient(135deg,#7c3aed,#6366f1)'
    : user.role==='invigilator' ? 'linear-gradient(135deg,#059669,#10b981)'
    : 'linear-gradient(135deg,#d97706,#f59e0b)';

  const notifTypeStyle = {
    success: { bg:'rgba(16,185,129,0.12)', border:'rgba(16,185,129,0.25)', icon:<CheckCircle size={12} color="#34d399" /> },
    warning: { bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.25)', icon:<AlertTriangle size={12} color="#fbbf24" /> },
    info:    { bg:'rgba(124,58,237,0.12)', border:'rgba(124,58,237,0.25)', icon:<Info size={12} color="#a78bfa" /> },
  };

  return (
    <div style={{ display:'flex', background:'#0a0a0f', minHeight:'100vh' }}>
      <Sidebar role={user.role} user={user} />

      <div style={{ flex:1, marginLeft: window.innerWidth >= 768 ? '280px' : '0', display:'flex', flexDirection:'column', minHeight:'100vh' }}>
        {/* Navbar */}
        <header style={{ height:'64px', borderBottom:'1px solid rgba(255,255,255,0.06)',
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'0 24px', position:'sticky', top:0, zIndex:40,
                          background:'rgba(10,10,20,0.85)', backdropFilter:'blur(20px)',
                          boxShadow:'0 1px 0 rgba(255,255,255,0.04)' }}>
          {/* Left */}
          <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
            <div style={{ position:'relative', width:'280px' }}>
              <Search size={14} style={{ position:'absolute', left:'13px', top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.3)' }} />
              <input type="text" placeholder="Search students, exams, rooms..."
                value={search} onChange={e=>setSearch(e.target.value)}
                style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                          borderRadius:'10px', padding:'8px 12px 8px 36px', fontSize:'13px',
                          color:'rgba(255,255,255,0.7)', outline:'none', transition:'all 0.2s ease',
                          fontFamily:'inherit' }}
                onFocus={e=>{ e.target.style.borderColor='rgba(124,58,237,0.5)'; e.target.style.background='rgba(124,58,237,0.06)'; }}
                onBlur={e=>{ e.target.style.borderColor='rgba(255,255,255,0.08)'; e.target.style.background='rgba(255,255,255,0.04)'; }} />
              {search && <button onClick={()=>setSearch('')} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'rgba(255,255,255,0.35)', cursor:'pointer', display:'flex', alignItems:'center' }}><X size={13} /></button>}
            </div>
            <LiveClock />
          </div>

          {/* Right */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            {/* System live */}
            <div style={{ display:'flex', alignItems:'center', gap:'7px', padding:'6px 12px', borderRadius:'8px',
                           background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', marginRight:'4px' }}>
              <span className="live-dot" style={{ width:'6px', height:'6px' }} />
              <span style={{ fontSize:'12px', fontWeight:600, color:'#34d399', marginLeft:'2px' }}>System Live</span>
            </div>

            {/* Notifications */}
            <div ref={notifRef} style={{ position:'relative' }}>
              <button id="notif-btn" className="btn-icon" style={{ position:'relative' }}
                onClick={()=>{ setShowNotif(!showNotif); setShowProfile(false); }}>
                <Bell size={15} />
                {unread > 0 && (
                  <span style={{ position:'absolute', top:'-3px', right:'-3px', width:'17px', height:'17px',
                                   background:'linear-gradient(135deg,#7c3aed,#a855f7)',
                                   borderRadius:'50%', fontSize:'9px', fontWeight:700, color:'#fff',
                                   display:'flex', alignItems:'center', justifyContent:'center',
                                   boxShadow:'0 0 10px rgba(124,58,237,0.5)', animation:'popIn 0.3s ease-out' }}>
                    {unread}
                  </span>
                )}
              </button>

              {showNotif && (
                <div className="animate-scale-in" style={{ position:'absolute', right:0, top:'calc(100% + 8px)',
                                width:'320px', background:'rgba(12,12,24,0.97)', backdropFilter:'blur(20px)',
                                border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px',
                                boxShadow:'0 20px 60px rgba(0,0,0,0.7)', overflow:'hidden', zIndex:100 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ fontSize:'13px', fontWeight:600, color:'#fff' }}>Notifications</span>
                      {unread>0 && <span className="badge-info">{unread} new</span>}
                    </div>
                    <button onClick={markRead} style={{ fontSize:'11px', color:'#a78bfa', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}>Mark all read</button>
                  </div>
                  <div style={{ maxHeight:'300px', overflowY:'auto' }}>
                    {notifications.map(n => {
                      const ns = notifTypeStyle[n.type] || notifTypeStyle.info;
                      return (
                        <div key={n.id} style={{ display:'flex', gap:'12px', padding:'12px 16px',
                                                   background: n.read?'transparent':'rgba(124,58,237,0.04)',
                                                   borderBottom:'1px solid rgba(255,255,255,0.04)',
                                                   transition:'background 0.15s ease', cursor:'pointer' }}
                             onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                             onMouseOut={e=>e.currentTarget.style.background=n.read?'transparent':'rgba(124,58,237,0.04)'}>
                          <div style={{ width:'28px', height:'28px', flexShrink:0, borderRadius:'8px',
                                         background:ns.bg, border:`1px solid ${ns.border}`,
                                         display:'flex', alignItems:'center', justifyContent:'center', marginTop:'2px' }}>
                            {ns.icon}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                              <p style={{ fontSize:'12px', fontWeight:600, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{n.title}</p>
                              {!n.read && <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#7c3aed', flexShrink:0 }} />}
                            </div>
                            <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', marginTop:'2px', lineHeight:1.4 }}>{n.msg}</p>
                            <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.25)', marginTop:'3px', display:'flex', alignItems:'center', gap:'4px' }}>
                              <Clock size={9} />{n.time}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ padding:'10px 16px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                    <button style={{ width:'100%', fontSize:'12px', color:'rgba(255,255,255,0.35)', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}>
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ width:'1px', height:'20px', background:'rgba(255,255,255,0.08)', margin:'0 4px' }} />

            {/* Profile */}
            <div ref={profileRef} style={{ position:'relative' }}>
              <button id="profile-btn" onClick={()=>{ setShowProfile(!showProfile); setShowNotif(false); }}
                style={{ display:'flex', alignItems:'center', gap:'9px', padding:'6px 10px',
                          borderRadius:'12px', background:'transparent', border:'1px solid transparent',
                          cursor:'pointer', transition:'all 0.2s ease' }}
                onMouseOver={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.09)'; }}
                onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='transparent'; }}>
                {/* Avatar with gradient ring */}
                <div style={{ position:'relative', flexShrink:0 }}>
                  <div style={{ position:'absolute', inset:'-2px', borderRadius:'12px', background:avatarGrad, opacity:0.6 }} />
                  <div style={{ position:'relative', width:'32px', height:'32px', borderRadius:'10px',
                                  background:avatarGrad, display:'flex', alignItems:'center', justifyContent:'center',
                                  fontSize:'12px', fontWeight:700, color:'#fff' }}>
                    {user.name?.[0] || 'U'}
                  </div>
                </div>
                <div style={{ textAlign:'left' }}>
                  <p style={{ fontSize:'12px', fontWeight:600, color:'#fff', lineHeight:1 }}>{user.name}</p>
                  <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.35)', textTransform:'capitalize', marginTop:'2px' }}>{user.role}</p>
                </div>
                <ChevronDown size={11} color="rgba(255,255,255,0.3)" style={{ transform: showProfile?'rotate(180deg)':'none', transition:'transform 0.2s ease' }} />
              </button>

              {showProfile && (
                <div className="animate-scale-in" style={{ position:'absolute', right:0, top:'calc(100% + 8px)',
                                width:'220px', background:'rgba(12,12,24,0.97)', backdropFilter:'blur(20px)',
                                border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px',
                                boxShadow:'0 20px 60px rgba(0,0,0,0.7)', overflow:'hidden', zIndex:100 }}>
                  <div style={{ padding:'16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                      <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:avatarGrad,
                                     display:'flex', alignItems:'center', justifyContent:'center',
                                     fontSize:'14px', fontWeight:700, color:'#fff' }}>
                        {user.name?.[0] || 'U'}
                      </div>
                      <div>
                        <p style={{ fontSize:'13px', fontWeight:600, color:'#fff' }}>{user.name}</p>
                        <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.35)', textTransform:'capitalize' }}>{user.role}</p>
                      </div>
                    </div>
                    <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.25)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</p>
                  </div>
                  <div style={{ padding:'6px' }}>
                    {[{ icon:User, label:'View Profile' }, { icon:Settings, label:'Settings' }].map(item => (
                      <button key={item.label} style={{ display:'flex', alignItems:'center', gap:'9px', width:'100%',
                              padding:'9px 12px', borderRadius:'9px', border:'none', cursor:'pointer', textAlign:'left',
                              background:'transparent', color:'rgba(255,255,255,0.5)', fontSize:'13px', fontWeight:500,
                              transition:'all 0.15s ease' }}
                        onMouseOver={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='#fff'; }}
                        onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.5)'; }}>
                        <item.icon size={14} />{item.label}
                      </button>
                    ))}
                    <div style={{ margin:'4px 0', borderTop:'1px solid rgba(255,255,255,0.06)' }} />
                    <button onClick={handleLogout} style={{ display:'flex', alignItems:'center', gap:'9px', width:'100%',
                            padding:'9px 12px', borderRadius:'9px', border:'none', cursor:'pointer', textAlign:'left',
                            background:'transparent', color:'rgba(244,63,94,0.7)', fontSize:'13px', fontWeight:500,
                            transition:'all 0.15s ease' }}
                      onMouseOver={e=>{ e.currentTarget.style.background='rgba(244,63,94,0.08)'; e.currentTarget.style.color='#fb7185'; }}
                      onMouseOut={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(244,63,94,0.7)'; }}>
                      <LogOut size={14} />Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main style={{ flex:1, padding: typeof window !== 'undefined' && window.innerWidth < 768 ? '16px' : '32px', paddingTop: typeof window !== 'undefined' && window.innerWidth < 768 ? '64px' : '32px', animationFillMode:'both' }} className="animate-fade-slide">
          {children}
        </main>
      </div>
    </div>
  );
}


