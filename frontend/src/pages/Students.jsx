import React, { useState, useEffect } from 'react';
import { UserPlus, Search, MoreVertical, Filter, Mail, Phone, Hash } from 'lucide-react';
import { studentApi } from '../services/api';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    studentApi.getAll().then(res => {
      setStudents(res.data);
      setLoading(false);
    });
  }, []);

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.enrollment_no.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="students-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1>Student Registry</h1>
          <p>Manage and board students for examination.</p>
        </div>
        <button className="btn btn-primary">
          <UserPlus size={20} /> Register Student
        </button>
      </div>

      <div className="glass-card mb-8" style={{ padding: '8px' }}>
        <div className="flex items-center gap-4" style={{ padding: '0 16px' }}>
          <Search size={20} color="var(--text-muted)" />
          <input 
            type="text" 
            placeholder="Search by name or enrollment number..." 
            className="glass-input" 
            style={{ border: 'none', background: 'transparent', flex: 1, paddingLeft: 0 }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="btn btn-ghost" style={{ padding: '8px' }}><Filter size={18} /></button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
              <th style={{ textAlign: 'left', padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>STUDENT</th>
              <th style={{ textAlign: 'left', padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>ENROLLMENT</th>
              <th style={{ textAlign: 'left', padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>COURSE</th>
              <th style={{ textAlign: 'left', padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>STATUS</th>
              <th style={{ padding: '16px 24px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => (
              <tr key={student.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }}>
                <td style={{ padding: '16px 24px' }}>
                  <div className="flex items-center gap-3">
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                      {student.name[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{student.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{student.email || 'no-email@exam.com'}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '16px 24px', fontFamily: 'monospace' }}>{student.enrollment_no}</td>
                <td style={{ padding: '16px 24px' }}>Computer Science</td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="status-badge status-valid">Registered</span>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  <button className="btn btn-ghost" style={{ padding: '8px' }}><MoreVertical size={18} /></button>
                </td>
              </tr>
            ))}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No students found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Students;
