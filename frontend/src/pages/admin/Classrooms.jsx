import React, { useState, useEffect } from 'react';
import {
  MapPin, Plus, Users, CheckCircle, AlertCircle,
  Edit2, Trash2, Eye, X, Grid, LayoutList,
  Zap, Building2, Wifi, WifiOff, Coffee, Monitor, RefreshCw
} from 'lucide-react';
import { logisticsApi } from '../../services/api';

const STATUS_CONFIG = {
  Active:      { badge: 'badge-success', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/10', dot: 'bg-emerald-400', bg: 'from-emerald-500/8 to-teal-500/4' },
  Alert:       { badge: 'badge-warning',  border: 'border-amber-500/30',  glow: 'shadow-amber-500/10',  dot: 'bg-amber-400',  bg: 'from-amber-500/8 to-orange-500/4' },
  Available:   { badge: 'badge-info',     border: 'border-indigo-500/20', glow: 'shadow-indigo-500/8',  dot: 'bg-indigo-400', bg: 'from-indigo-500/5 to-violet-500/3' },
  Maintenance: { badge: 'badge-neutral',  border: 'border-slate-500/20',  glow: 'shadow-slate-500/5',   dot: 'bg-slate-500',  bg: 'from-slate-500/8 to-slate-600/4' },
};

const TYPE_ICON = {
  'Standard': Building2,
  'Large Hall': Users,
  'Computer Lab': Monitor,
  'Auditorium': Wifi,
};

const AddRoomModal = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    room_number: '',
    capacity: 40,
    floor: 0,
    room_type: 'Standard',
    status: 'Available'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await logisticsApi.addClassroom(formData);
      onAdd();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to add room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative w-full max-w-md glass-card p-7 animate-scale-in shadow-2xl shadow-black/70 border border-white/[0.1]">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-violet-500 rounded-t-2xl" />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>Add Classroom</h2>
            <p className="text-xs text-slate-500 mt-0.5">Register a new examination room</p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Room Number *</label>
            <input 
              type="text" 
              className="seas-input" 
              placeholder="e.g. 201" 
              required
              value={formData.room_number}
              onChange={e => setFormData({...formData, room_number: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Floor</label>
            <select 
              className="seas-input"
              value={formData.floor}
              onChange={e => setFormData({...formData, floor: parseInt(e.target.value)})}
            >
              <option value={0}>Ground (0)</option>
              <option value={1}>1st Floor</option>
              <option value={2}>2nd Floor</option>
              <option value={3}>3rd Floor</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Capacity *</label>
              <input 
                type="number" 
                className="seas-input" 
                placeholder="40" 
                required
                value={formData.capacity}
                onChange={e => setFormData({...formData, capacity: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Room Type</label>
              <select 
                className="seas-input"
                value={formData.room_type}
                onChange={e => setFormData({...formData, room_type: e.target.value})}
              >
                <option>Standard</option>
                <option>Large Hall</option>
                <option>Computer Lab</option>
                <option>Auditorium</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6 pt-5 border-t border-white/[0.06]">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <><Plus size={15} /> Add Room</>}
          </button>
        </div>
      </form>
    </div>
  );
};

const Classrooms = () => {
  const [viewMode, setViewMode] = useState('grid');
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await logisticsApi.getClassrooms();
      setRooms(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const filtered = filter === 'all' ? rooms : rooms.filter(r => r.status.toLowerCase() === filter);

  const stats = [
    { label: 'Total Rooms', val: rooms.length, color: 'text-indigo-400', bg: 'from-indigo-500/12 to-violet-500/6', border: 'border-indigo-500/20', icon: Building2 },
    { label: 'Active', val: rooms.filter(r => r.status === 'Active').length, color: 'text-emerald-400', bg: 'from-emerald-500/12 to-teal-500/6', border: 'border-emerald-500/20', icon: CheckCircle },
    { label: 'Alerts', val: rooms.filter(r => r.status === 'Alert').length, color: 'text-amber-400', bg: 'from-amber-500/12 to-orange-500/6', border: 'border-amber-500/20', icon: AlertCircle },
    { label: 'Total Seats', val: rooms.reduce((a, r) => a + r.capacity, 0), color: 'text-violet-400', bg: 'from-violet-500/12 to-purple-500/6', border: 'border-violet-500/20', icon: Users },
  ];

  return (
    <div className="space-y-6 animate-fade-slide">
      {showModal && <AddRoomModal onClose={() => setShowModal(false)} onAdd={fetchRooms} />}

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={12} className="text-indigo-400" />
            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Room Management</span>
          </div>
          <h1 className="page-title">Classroom Management</h1>
          <p className="page-subtitle">Manage rooms, seat allocation & real-time occupancy</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter pills */}
          <div className="hidden md:flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
            {['all', 'active', 'alert', 'available'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                  filter === f ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button onClick={fetchRooms} className="btn-icon">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <LayoutList size={14} />
            </button>
          </div>

          <button id="add-room-btn" onClick={() => setShowModal(true)} className="btn-primary text-sm py-2.5 px-4">
            <Plus size={14} /> Add Room
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`glass-card p-4 bg-gradient-to-br ${s.bg} border ${s.border} hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{s.label}</p>
                <Icon size={14} className={s.color} />
              </div>
              <p className={`text-2xl font-bold ${s.color}`} style={{ fontFamily: 'Sora, Inter, sans-serif' }}>{s.val}</p>
            </div>
          );
        })}
      </div>

      {/* ── Grid view ── */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger">
          {filtered.map(room => {
            const pct = room.capacity > 0 ? Math.round(((room.occupied || 0) / room.capacity) * 100) : 0;
            const cfg = STATUS_CONFIG[room.status] || STATUS_CONFIG.Available;
            const TypeIcon = TYPE_ICON[room.room_type] || Building2;
            return (
              <div
                key={room.id}
                className={`glass-card p-5 border ${cfg.border} bg-gradient-to-br ${cfg.bg}
                             hover:shadow-xl ${cfg.glow} transition-all duration-300
                             hover:-translate-y-1 group cursor-pointer relative overflow-hidden`}
              >
                {/* Top glow bar */}
                <div className={`absolute top-0 left-0 right-0 h-[2px] ${
                  room.status === 'Active' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
                  room.status === 'Alert' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                  room.status === 'Available' ? 'bg-gradient-to-r from-indigo-500 to-violet-500' :
                  'bg-slate-700'
                }`} />

                {/* Live dot for active rooms */}
                {room.status === 'Active' && (
                  <div className="absolute top-3.5 right-3.5">
                    <span className="live-dot" style={{ width: 7, height: 7 }} />
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <TypeIcon size={12} className="text-slate-500" />
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{room.room_type}</p>
                    </div>
                    <h3 className="text-2xl font-bold text-white" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>
                      Rm {room.room_number}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {room.floor === 0 ? 'Ground' : `${room.floor}${room.floor === 1 ? 'st' : room.floor === 2 ? 'nd' : 'rd'}`} Floor
                    </p>
                  </div>
                  <span className={cfg.badge}>{room.status}</span>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-400">{(room.occupied || 0)}/{room.capacity} seats</span>
                    <span className="text-xs font-bold text-white">{pct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${pct >= 100 ? 'bg-gradient-to-r from-rose-500 to-pink-500' : pct >= 90 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {room.exam && room.exam !== '—' && (
                  <div className="bg-white/[0.03] border border-white/[0.06] px-3 py-2 rounded-lg mb-3">
                    <p className="text-xs">
                      <span className="font-mono text-indigo-400 font-semibold">{room.exam}</span>
                      <span className="text-slate-600 mx-1">·</span>
                      <span className="text-slate-400 text-[11px]">{room.invigilator}</span>
                    </p>
                  </div>
                )}

                {room.status === 'Available' && (
                  <div className="flex items-center gap-1.5 py-2 mb-1">
                    <CheckCircle size={12} className="text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-medium">Ready for assignment</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 justify-end pt-3 border-t border-white/[0.05]">
                  <button className="btn-icon w-7 h-7 hover:text-indigo-400 hover:border-indigo-500/30" data-tooltip="View">
                    <Eye size={12} />
                  </button>
                  <button className="btn-icon w-7 h-7 hover:text-emerald-400 hover:border-emerald-500/30" data-tooltip="Edit">
                    <Edit2 size={12} />
                  </button>
                  <button className="btn-icon w-7 h-7 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/[0.08]" data-tooltip="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── List view ── */
        <div className="section-card overflow-x-auto">
          <table className="seas-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Type / Floor</th>
                <th>Invigilator</th>
                <th>Occupancy</th>
                <th>Current Exam</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const pct = r.capacity > 0 ? Math.round(((r.occupied || 0) / r.capacity) * 100) : 0;
                const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.Available;
                return (
                  <tr key={r.id} className="group">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${cfg.border} ${
                          r.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' :
                          r.status === 'Alert' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-white/[0.05] text-slate-400'
                        }`}>
                          {r.room_number.length > 3 ? r.room_number.slice(0, 2) : r.room_number}
                        </div>
                        <p className="font-semibold text-white">Room {r.room_number}</p>
                      </div>
                    </td>
                    <td>
                      <p className="text-xs text-slate-400">{r.room_type}</p>
                      <p className="text-[10px] text-slate-600">Floor {r.floor}</p>
                    </td>
                    <td className="text-xs text-slate-400">{r.invigilator || '—'}</td>
                    <td>
                      <div className="w-32">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">{(r.occupied || 0)}/{r.capacity}</span>
                          <span className="font-semibold text-white">{pct}%</span>
                        </div>
                        <div className="progress-bar">
                          <div className={`progress-fill ${pct >= 100 ? 'bg-rose-500' : pct >= 90 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      {r.exam && r.exam !== '—'
                        ? <span className="font-mono text-xs text-indigo-400 font-semibold">{r.exam}</span>
                        : <span className="text-slate-700 text-xs">—</span>
                      }
                    </td>
                    <td>
                      <span className={cfg.badge}>{r.status}</span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button className="btn-icon w-7 h-7 hover:text-indigo-400"><Eye size={12} /></button>
                        <button className="btn-icon w-7 h-7 hover:text-emerald-400"><Edit2 size={12} /></button>
                        <button className="btn-icon w-7 h-7 hover:text-rose-400 hover:bg-rose-500/[0.08]"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Classrooms;
