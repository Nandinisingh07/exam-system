import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Eye, EyeOff, ArrowRight, Loader2, UserCog,
  ChevronRight, Sparkles, Lock, Mail, AlertCircle
} from 'lucide-react';
import { authApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const ROLES = [
  { role: 'admin', label: 'Administrator', desc: 'Full system control & analytics', icon: UserCog, gradient: '135deg, #7c3aed, #6366f1', border: 'rgba(124,58,237,0.35)', email: 'admin@exam.com', pw: 'admin123', tag: 'Full Access' },
  { role: 'invigilator', label: 'Invigilator', desc: 'Exam hall verification & monitoring', icon: Shield, gradient: '135deg, #059669, #10b981', border: 'rgba(16,185,129,0.35)', email: 'teacher@exam.com', pw: 'teacher123', tag: 'Hall Access' },
];

export default function Login() {
  const { dark } = useTheme();
  const [email, setEmail] = useState('admin@exam.com');
  const [password, setPassword] = useState('admin123');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(0);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  const pick = (i) => { setSel(i); setEmail(ROLES[i].email); setPassword(ROLES[i].pw); setError(''); };

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await authApi.login({ email, password });
      const data = res.data;
      // Store ALL keys individually so ProtectedRoute can find them
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('name', data.name);
      localStorage.setItem('email', data.email);
      localStorage.setItem('user', JSON.stringify(data));

      // Redirect based on role
      if (data.role === 'admin') {
        navigate('/admin');
      } else if (data.role === 'invigilator') {
        navigate('/invigilator');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };
  const card = ROLES[sel];
  const Icon = card.icon;

  const labelStyle = {
    display: 'block', fontSize: '11px', fontWeight: 700, color: '#ffffff',
    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '7px'
  };

  return (
    <div style={{ minHeight: '100vh', background: dark ? '#0a0a0f' : '#2233a8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}
      className="bg-grid">

      <div style={{ position: 'absolute', top: '-120px', left: '-80px', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(80px)', animation: 'aurora 10s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '-120px', right: '-80px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(80px)', animation: 'aurora 12s ease-in-out infinite', animationDelay: '4s' }} />

      <div style={{ width: '100%', maxWidth: '920px', position: 'relative', zIndex: 10, opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: 'all 0.6s cubic-bezier(0.22,1,0.36,1)' }}>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
            <div style={{ position: 'absolute', inset: '-8px', background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', borderRadius: '28px', filter: 'blur(20px)', opacity: 0.5 }} />
            <div className="animate-float" style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '20px', background: 'linear-gradient(135deg,#7c3aed,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(124,58,237,0.5)' }}>
              <Shield size={30} color="#fff" />
            </div>
          </div>
          <h1 style={{ fontFamily: 'Sora,sans-serif', fontSize: '34px', fontWeight: 900, letterSpacing: '-0.03em', color: dark ? '#fff' : '#ffffff', marginBottom: '6px' }}>
            Smart Examination <span className="text-gradient">Automated</span> System
          </h1>
          <p style={{ color: '#ffffff', fontSize: '13px' }}>Biometric Verification · Real-time Monitoring · University Grade</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '24px', alignItems: 'start' }}>

          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '14px', fontWeight: 800 }}>Select Your Role</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {ROLES.map((r, i) => {
                const RI = r.icon; const active = i === sel;
                return (
                  <button key={r.role} id={`role-${r.role}`} onClick={() => pick(i)}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '14px', border: `1px solid ${active ? (dark ? r.border : 'rgba(255,255,255,0.8)') : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.35)')}`, background: active ? (dark ? `linear-gradient(135deg,${r.border.replace('0.35', '0.15')},transparent)` : 'rgba(255,255,255,0.30)') : (dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.12)'), cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.25s', boxShadow: active ? `0 0 25px ${r.border.replace('0.35', '0.15')}` : 'none', transform: active ? 'translateX(3px)' : 'translateX(0)' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0, background: `linear-gradient(${r.gradient})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 15px ${r.border.replace('0.35', '0.4')}`, transform: active ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.25s' }}>
                      <RI size={20} color="#fff" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>{r.label}</p>
                        {active && <span className="badge-info" style={{ fontSize: '9px' }}>{r.tag}</span>}
                      </div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>{r.desc}</p>
                    </div>
                    <ChevronRight size={15} color={active ? '#a78bfa' : (dark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.9)')} />
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginTop: '18px' }}>
              {[{ icon: '🔐', v: 'AES-256', l: 'Encrypted' }, { icon: '👁️', v: '99.8%', l: 'Face Accuracy' }, { icon: '⚡', v: '< 2s', l: 'Verification' }].map(t => (
                <div key={t.l} className="glass-card" style={{ padding: '12px', textAlign: 'center', cursor: 'default' }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>{t.icon}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: dark ? '#fff' : '#111827' }}>{t.v}</div>
                  <div style={{ fontSize: '10px', color: '#ffffff', marginTop: '1px' }}>{t.l}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '14px', padding: '12px 16px', background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.15)', border: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.3)', borderRadius: '12px' }}>
              <p style={{ fontSize: '10px', color: '#ffffff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Demo Credentials</p>
              {ROLES.map(r => (
                <div key={r.role} style={{ display: 'flex', gap: '8px', fontSize: '11px', marginBottom: '5px' }}>
                  <span style={{ color: '#ffffff', minWidth: '90px' }}>{r.label}:</span>
                  <code style={{ color: '#ffffff' }}>{r.email} / {r.pw}</code>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px', fontSize: '11px', marginBottom: '5px', marginTop: '8px' }}>
                <span style={{ color: '#ffffff', minWidth: '90px' }}>Custom Invig:</span>
                <span style={{ color: '#ffffff' }}>Check Admin Panel -&gt; Invigilators</span>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '32px', position: 'relative', overflow: 'hidden', background: dark ? undefined : '#ffffff', boxShadow: `0 0 40px ${card.border.replace('0.35', '0.12')}` }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(${card.gradient})`, borderRadius: '16px 16px 0 0' }} />
            <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', background: `linear-gradient(${card.gradient})`, borderRadius: '50%', filter: 'blur(60px)', opacity: 0.12 }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', position: 'relative' }}>
              <div className="icon-box" style={{ background: `linear-gradient(${card.gradient})`, border: 'none', boxShadow: `0 4px 15px ${card.border.replace('0.35', '0.4')}` }}>
                <Icon size={18} color="#fff" />
              </div>
              <div>
                <h2 style={{ fontFamily: 'Sora,sans-serif', fontSize: '18px', fontWeight: 700, color: dark ? '#fff' : '#111827', letterSpacing: '-0.02em' }}>
                  Sign in as {card.label}
                </h2>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>
                  Access the SEAS platform
                </p>
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '10px', color: '#fb7185', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#ffffff' }} />
                  <input id="login-email" type="email" className="seas-input" style={{ paddingLeft: '40px' }}
                    placeholder="name@university.edu" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="off" />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
                  <button type="button" style={{ fontSize: '12px', color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Forgot?</button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#ffffff' }} />
                  <input id="login-password" type={showPw ? 'text' : 'password'} className="seas-input"
                    style={{ paddingLeft: '40px', paddingRight: '44px' }}
                    placeholder="••••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="off" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: dark ? 'rgba(255,255,255,0.35)' : '#6366f1', cursor: 'pointer', display: 'flex' }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button id="login-submit" type="submit" disabled={loading} className="btn-primary"
                style={{ width: '100%', padding: '14px', marginTop: '4px', fontSize: '14px', background: `linear-gradient(${card.gradient})`, boxShadow: `0 6px 25px ${card.border.replace('0.35', '0.4')}`, opacity: loading ? 0.7 : 1 }}>
                {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Sparkles size={15} /> Access System <ArrowRight size={15} /></>}
              </button>
            </form>

            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="live-dot" /><span style={{ fontSize: '12px', color: '#ffffff', marginLeft: '4px' }}>System Online</span>
              </div>
              <span style={{ fontSize: '11px', color: '#ffffff' }}>SEAS v2.0 · Secured</span>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '36px', fontSize: '12px', color: '#ffffff' }}>
          © 2026 Smart Examination Automated System · All rights reserved
        </p>
      </div>
    </div>
  );
}
