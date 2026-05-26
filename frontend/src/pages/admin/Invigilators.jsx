import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Edit2, Trash2, Key, Users, CheckCircle, Plus } from 'lucide-react';
import { authApi } from '../../services/api';

const Invigilators = () => {
  const [invigilators, setInvigilators] = useState([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newInvig, setNewInvig] = useState({ name: '', email: '', password: '' });

  const fetchInvigilators = async () => {
    try {
      const res = await authApi.listUsers();
      const invigs = res.data.filter(u => u.role === 'invigilator').map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        password: '••••••••',
        status: u.is_active !== false ? 'Active' : 'Inactive',
        created: 'Active Account'
      }));
      setInvigilators(invigs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInvigilators();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await authApi.register(newInvig.name, newInvig.email, newInvig.password, 'invigilator');
      setShowAdd(false);
      setNewInvig({ name: '', email: '', password: '' });
      fetchInvigilators();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to register invigilator.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this invigilator account?")) return;
    try {
      await authApi.deleteUser(id);
      fetchInvigilators();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete invigilator.');
    }
  };

  const filtered = invigilators.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users size={13} className="text-indigo-400" />
            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Staff Management</span>
          </div>
          <h1 className="page-title">Invigilator Directory</h1>
          <p className="page-subtitle">Manage invigilator accounts and login credentials</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm py-2.5 px-4">
          <UserPlus size={14} /> Add Invigilator
        </button>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <div>
            <h3 className="section-card-title">Registered Invigilators</h3>
            <p className="text-xs text-slate-500 mt-0.5">{invigilators.length} active accounts</p>
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} className="seas-input pl-8 py-2 text-xs w-56" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="seas-table">
            <thead>
              <tr>
                <th>Invigilator</th>
                <th>Login Email</th>
                <th>Password</th>
                <th>Status</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-xs font-bold text-indigo-400">
                        {i.name[0]}
                      </div>
                      <p className="text-sm font-semibold text-white">{i.name}</p>
                    </div>
                  </td>
                  <td>
                    <code className="text-xs text-slate-300 font-mono">{i.email}</code>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Key size={11} className="text-slate-500" />
                      <code className="text-xs text-slate-400 font-mono">{i.password}</code>
                    </div>
                  </td>
                  <td><span className="badge-success">{i.status}</span></td>
                  <td><span className="text-xs text-slate-400">{i.created}</span></td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleDelete(i.id)} className="btn-icon w-7 h-7 hover:text-rose-400">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500 text-xs">No invigilators found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <form onSubmit={handleAdd} className="relative w-full max-w-sm glass-card p-6 animate-fade-slide shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-5">Register New Invigilator</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Full Name *</label>
                <input type="text" className="seas-input" required placeholder="e.g. Rahul Verma"
                  value={newInvig.name} onChange={e => setNewInvig(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Login Email *</label>
                <input type="email" className="seas-input" required placeholder="teacher@exam.com"
                  value={newInvig.email} onChange={e => setNewInvig(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">Password *</label>
                <input type="text" className="seas-input font-mono" required placeholder="Create password"
                  value={newInvig.password} onChange={e => setNewInvig(p => ({ ...p, password: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-white/[0.06]">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1 justify-center"><UserPlus size={14} /> Register</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Invigilators;
