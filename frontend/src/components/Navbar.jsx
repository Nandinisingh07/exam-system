import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, Scan, Users, Calendar, ClipboardCheck, LogOut } from 'lucide-react';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');

  if (!token) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { name: 'Verification Kiosk', icon: <Scan size={20} />, path: '/kiosk' },
    { name: 'Students', icon: <Users size={20} />, path: '/students' },
    { name: 'Timetable', icon: <Calendar size={20} />, path: '/timetable' },
    { name: 'Attendance', icon: <ClipboardCheck size={20} />, path: '/attendance' },
  ];

  return (
    <nav className="navbar">
      <div className="container flex items-center justify-between">
        <Link to="/" className="logo" style={{ textDecoration: 'none' }}>
          <Shield size={32} color="#6366f1" />
          <span>EXAMSECURE</span>
        </Link>
        
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`btn btn-ghost ${location.pathname === item.path ? 'active' : ''}`}
                style={{ 
                  display: 'flex', 
                  gap: '8px',
                  background: location.pathname === item.path ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  borderColor: location.pathname === item.path ? 'rgba(99, 102, 241, 0.3)' : 'transparent'
                }}
              >
                {item.icon}
                <span className="hide-mobile">{item.name}</span>
              </Link>
            ))}
          </div>
          
          <button onClick={handleLogout} className="btn btn-ghost" style={{ color: 'var(--error)' }}>
            <LogOut size={20} />
          </button>
        </div>
      </div>
      
      <style>{`
        .hide-mobile { display: block; }
        @media (max-width: 900px) {
          .hide-mobile { display: none; }
        }
      `}</style>
    </nav>
  );
};

export default Navbar;
