import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Eye, EyeOff, ArrowRight, Loader2, UserCog,
  ChevronRight, Sparkles, Lock, Mail, AlertCircle,
  ScanFace, ClipboardCheck, Fingerprint, Info
} from 'lucide-react';
import { authApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const ROLES = [
  { role: 'admin', label: 'Administrator', desc: 'Full system control & analytics', icon: UserCog, gradient: '135deg, #6366f1, #8b5cf6', border: 'rgba(99,102,241,0.25)', email: 'admin@exam.com', pw: 'admin123', tag: 'Full Access', color: '#6366f1' },
  { role: 'invigilator', label: 'Invigilator', desc: 'Exam hall verification & monitoring', icon: Shield, gradient: '135deg, #10b981, #059669', border: 'rgba(16,185,129,0.25)', email: 'teacher@exam.com', pw: 'teacher123', tag: 'Hall Access', color: '#10b981' },
];

export default function Login() {
  const { dark } = useTheme();
  const [email, setEmail] = useState('admin@exam.com');
  const [password, setPassword] = useState('admin123');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(1); // Default active Invigilator as in screenshot
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  const pick = (i) => { setSel(i); setEmail(ROLES[i].email); setPassword(ROLES[i].pw); setError(''); };

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await authApi.login({ email, password });
      const data = res.data;
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('name', data.name);
      localStorage.setItem('email', data.email);
      localStorage.setItem('user', JSON.stringify(data));

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

  return (
    <div style={{
      minHeight: '100vh',
      background: dark 
        ? '#080c14' 
        : '#d2e5f7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      position: 'relative',
      overflow: 'hidden'
    }} className="bg-dots">

      {/* Background radial blurs */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-5%',
        width: '50vw',
        height: '50vw',
        background: dark 
          ? 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 60%)'
          : 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(100px)',
        animation: 'aurora 15s ease-in-out infinite'
      }} />
      
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-5%',
        width: '45vw',
        height: '45vw',
        background: dark 
          ? 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 60%)'
          : 'radial-gradient(circle, rgba(6,182,212,0.04) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(100px)',
        animation: 'aurora 18s ease-in-out infinite',
        animationDelay: '3s'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '1020px',
        position: 'relative',
        zIndex: 10,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(30px)',
        transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '99px', background: dark ? 'rgba(99,102,241,0.08)' : '#eef2ff', border: '1px solid rgba(99,102,241,0.15)', marginBottom: '16px' }}>
            <span className="live-dot" style={{ width: '6px', height: '6px', background: '#10b981' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', letterSpacing: '0.08em', textTransform: 'uppercase' }}>SECURE EXAM PORTAL v2.0</span>
          </div>
          <div style={{ position: 'relative', display: 'block', marginBottom: '16px' }}>
            <div style={{
              position: 'absolute',
              inset: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '60px',
              background: `linear-gradient(${card.gradient})`,
              borderRadius: '24px',
              filter: 'blur(15px)',
              opacity: 0.3,
              transition: 'all 0.5s ease'
            }} />
            <div className="animate-float" style={{
              position: 'relative',
              width: '60px',
              height: '60px',
              borderRadius: '18px',
              background: `linear-gradient(${card.gradient})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              boxShadow: dark ? '0 8px 32px rgba(99,102,241,0.25)' : '0 8px 24px rgba(99,102,241,0.15)',
              transition: 'background 0.5s ease'
            }}>
              <Shield size={28} color="#fff" />
            </div>
          </div>
          <h1 style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: '34px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: dark ? '#ffffff' : '#1e2a6b',
            marginBottom: '6px',
            lineHeight: 1.15
          }}>
            Smart Examination <span className={dark ? "text-gradient" : ""} style={dark ? {
              background: `linear-gradient(135deg, ${card.color}, #0ea5e9)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            } : {
              color: '#3b82f6'
            }}>Automated</span> System
          </h1>
          <p style={{
            color: dark ? 'rgba(255,255,255,0.6)' : '#4f46e5',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0.01em'
          }}>
            Biometric Verification &bull; Real-time Monitoring &bull; University Grade
          </p>
        </div>

        {/* Two-Column Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 430px',
          gap: '32px',
          alignItems: 'start'
        }}>

          {/* Left Column: Role Selection & Capabilities */}
          <div>
            <p style={{
              fontSize: '11px',
              fontWeight: 800,
              color: dark ? '#818cf8' : '#4f46e5',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '14px'
            }}>
              Select Your Role
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              {ROLES.map((r, i) => {
                const RI = r.icon;
                const active = i === sel;
                return (
                  <button
                    key={r.role}
                    id={`role-${r.role}`}
                    onClick={() => pick(i)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '20px 16px',
                      borderRadius: '16px',
                      border: '1px solid',
                      borderTop: active ? `4px solid ${r.color}` : (dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(99,102,241,0.1)'),
                      borderColor: active
                        ? (dark ? 'rgba(99,102,241,0.4)' : '#6366f1')
                        : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.1)'),
                      background: active
                        ? (dark ? 'rgba(99,102,241,0.08)' : '#ffffff')
                        : (dark ? 'rgba(255,255,255,0.02)' : '#ffffff'),
                      cursor: 'pointer',
                      textAlign: 'center',
                      width: '100%',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: active
                        ? (dark ? '0 10px 30px rgba(99,102,241,0.15)' : '0 6px 24px rgba(99,102,241,0.06)')
                        : 'none',
                      transform: active ? 'translateY(-4px)' : 'translateY(0)'
                    }}
                    className={!active ? 'glass' : undefined}
                  >
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      flexShrink: 0,
                      background: active 
                        ? `linear-gradient(${r.gradient})` 
                        : (dark ? 'rgba(255,255,255,0.06)' : '#eef2ff'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: active ? `0 4px 12px ${r.border.replace('0.25', '0.35')}` : 'none',
                      transition: 'all 0.3s ease'
                    }}>
                      <RI size={20} color={active ? '#fff' : (dark ? '#a5b4fc' : '#4f46e5')} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <p style={{
                          fontSize: '14px',
                          fontWeight: 750,
                          color: dark ? '#ffffff' : '#1e2a6b',
                        }}>{r.label}</p>
                        {active && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '99px',
                            background: r.role === 'admin' ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)',
                            color: r.role === 'admin' ? '#6366f1' : '#059669'
                          }}>
                            {r.tag}
                          </span>
                        )}
                      </div>
                      <p style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: dark ? 'rgba(255,255,255,0.5)' : '#64748b',
                        marginTop: '3px',
                        lineHeight: '1.3'
                      }}>{r.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Platform Capabilities Label */}
            <p style={{
              fontSize: '11px',
              fontWeight: 800,
              color: dark ? '#818cf8' : '#4f46e5',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '14px'
            }}>
              Platform Capabilities
            </p>

            {/* Platform Capabilities Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
              {[
                { icon: ScanFace, t: 'Face Biometrics', d: 'ArcFace recognition engine', color: '#6366f1', bg: '#eef2ff', bgDark: 'rgba(99,102,241,0.08)' },
                { icon: ClipboardCheck, t: 'Smart Verification', d: 'OCR + ID card pipeline', color: '#0ea5e9', bg: '#e0f2fe', bgDark: 'rgba(14,165,233,0.08)' },
                { icon: Fingerprint, t: 'Secure Access', d: 'AES-256 JWT sessions', color: '#10b981', bg: '#ecfdf5', bgDark: 'rgba(16,185,129,0.08)' }
              ].map(item => {
                const ItemIcon = item.icon;
                return (
                  <div
                    key={item.t}
                    className="glass-card"
                    style={{
                      padding: '16px 10px',
                      textAlign: 'center',
                      borderRadius: '16px',
                      border: dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(99,102,241,0.08)',
                      background: dark ? 'rgba(255,255,255,0.01)' : '#ffffff',
                      boxShadow: 'none',
                      cursor: 'default',
                      transform: 'scale(1)',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.04)'}
                    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: dark ? item.bgDark : item.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 8px auto'
                    }}>
                      <ItemIcon size={18} color={item.color} />
                    </div>
                    <p style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: dark ? '#ffffff' : '#1e2a6b'
                    }}>{item.t}</p>
                    <p style={{
                      fontSize: '10px',
                      fontWeight: 500,
                      color: dark ? 'rgba(255,255,255,0.45)' : '#64748b',
                      marginTop: '3px',
                      lineHeight: '1.3'
                    }}>{item.d}</p>
                  </div>
                );
              })}
            </div>

            {/* Institutional Access Only Box */}
            <div
              className="glass-card"
              style={{
                padding: '16px 20px',
                borderRadius: '16px',
                border: dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(99,102,241,0.08)',
                background: dark ? 'rgba(255,255,255,0.01)' : '#ffffff',
                boxShadow: 'none',
                display: 'flex',
                alignItems: 'start',
                gap: '14px'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: dark ? 'rgba(99,102,241,0.08)' : '#eef2ff',
                border: dark ? 'none' : '1px solid rgba(99,102,241,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Info size={18} color="#6366f1" />
              </div>
              <div>
                <p style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: dark ? '#ffffff' : '#4f46e5'
                }}>
                  Institutional Access Only
                </p>
                <p style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: dark ? 'rgba(255,255,255,0.45)' : '#64748b',
                  marginTop: '4px',
                  lineHeight: '1.4'
                }}>
                  This portal is restricted to authorized university personnel. Contact your system administrator for account provisioning.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Form Card */}
          <div
            className="glass-card"
            style={{
              padding: '36px',
              borderRadius: '24px',
              position: 'relative',
              overflow: 'hidden',
              background: dark ? 'rgba(16,22,32,0.85)' : '#ffffff',
              border: dark ? '1px solid rgba(255,255,255,0.08)' : `1px solid ${card.color}25`,
              boxShadow: dark
                ? '0 20px 40px rgba(0, 0, 0, 0.3)'
                : `0 20px 45px ${card.color}12`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.5s ease'
            }}
          >
            {/* Top thematic accent line */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: `linear-gradient(${card.gradient})`,
              transition: 'background 0.5s ease'
            }} />

            {/* Glowing gradient bubble inside card */}
            <div style={{
              position: 'absolute',
              top: '-60px',
              right: '-60px',
              width: '180px',
              height: '180px',
              background: `linear-gradient(${card.gradient})`,
              borderRadius: '50%',
              filter: 'blur(50px)',
              opacity: dark ? 0.15 : 0.08,
              transition: 'all 0.5s ease'
            }} />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: `linear-gradient(${card.gradient})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 4px 12px ${card.border.replace('0.25', '0.35')}`,
                  transition: 'background 0.5s ease'
                }}>
                  <Icon size={18} color="#fff" />
                </div>
                <div>
                  <h2 style={{
                    fontFamily: 'Sora, sans-serif',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: dark ? '#ffffff' : '#1e2a6b',
                    letterSpacing: '-0.02em'
                  }}>
                    Sign in as {card.label}
                  </h2>
                  <p style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: dark ? 'rgba(255,255,255,0.5)' : '#64748b',
                    marginTop: '2px'
                  }}>
                    Access the SEAS platform
                  </p>
                </div>
              </div>

              {error && (
                <div style={{
                  marginBottom: '20px',
                  padding: '12px 16px',
                  background: 'rgba(244,63,94,0.08)',
                  border: '1px solid rgba(244,63,94,0.18)',
                  borderRadius: '12px',
                  color: '#f43f5e',
                  fontSize: '13px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: dark ? 'rgba(255,255,255,0.45)' : '#4f46e5',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: '8px'
                  }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(26,36,96,0.45)'
                    }} />
                    <input
                      id="login-email"
                      type="email"
                      className="seas-input"
                      style={{
                        paddingLeft: '44px',
                        background: dark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                        border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(26,36,96,0.18)',
                        transition: 'all 0.25s ease'
                      }}
                      onFocus={e => {
                        e.target.style.borderColor = card.color;
                        e.target.style.boxShadow = `0 0 0 3px ${card.color}25`;
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(26,36,96,0.18)';
                        e.target.style.boxShadow = 'none';
                      }}
                      placeholder="name@university.edu"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: dark ? 'rgba(255,255,255,0.45)' : '#4f46e5',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em'
                    }}>
                      Password
                    </label>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(26,36,96,0.45)'
                    }} />
                    <input
                      id="login-password"
                      type={showPw ? 'text' : 'password'}
                      className="seas-input"
                      style={{
                        paddingLeft: '44px',
                        paddingRight: '44px',
                        background: dark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                        border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(26,36,96,0.18)',
                        transition: 'all 0.25s ease'
                      }}
                      onFocus={e => {
                        e.target.style.borderColor = card.color;
                        e.target.style.boxShadow = `0 0 0 3px ${card.color}25`;
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(26,36,96,0.18)';
                        e.target.style.boxShadow = 'none';
                      }}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      style={{
                        position: 'absolute',
                        right: '16px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: dark ? 'rgba(255,255,255,0.35)' : '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        padding: 0
                      }}
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  id="login-submit"
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '14px',
                    marginTop: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: `linear-gradient(${card.gradient})`,
                    boxShadow: dark ? '0 8px 20px rgba(99,102,241,0.2)' : `0 8px 20px ${card.color}35`,
                    opacity: loading ? 0.8 : 1,
                    transform: 'scale(1)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseOver={e => {
                    if (!loading) {
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = dark ? '0 10px 25px rgba(99,102,241,0.3)' : `0 10px 25px ${card.color}50`;
                    }
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = dark ? '0 8px 20px rgba(99,102,241,0.2)' : `0 8px 20px ${card.color}35`;
                  }}
                  onMouseDown={e => {
                    if (!loading) e.currentTarget.style.transform = 'scale(0.98)';
                  }}
                  onMouseUp={e => {
                    if (!loading) e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                >
                  {loading ? (
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Sparkles size={15} />
                      <span>Access System</span>
                      <ArrowRight size={15} />
                    </div>
                  )}
                </button>
              </form>
            </div>

            {/* Bottom Status bar */}
            <div style={{
              marginTop: '32px',
              paddingTop: '20px',
              borderTop: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(26,36,96,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="live-dot" />
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: dark ? '#ffffff' : '#1e2a6b'
                }}>System Online</span>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: 500,
                color: dark ? 'rgba(255,255,255,0.45)' : '#64748b'
              }}>
                SEAS v2.0 &bull; Secured
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          marginTop: '44px',
          fontSize: '12px',
          fontWeight: 500,
          color: dark ? 'rgba(255,255,255,0.4)' : '#64748b'
        }}>
          &copy; 2026 Smart Examination Automated System &bull; All rights reserved
        </p>
      </div>
    </div>
  );
}
