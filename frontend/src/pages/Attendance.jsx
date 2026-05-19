import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Download, Search, CheckCircle, XCircle } from 'lucide-react';
import { attendanceApi, timetableApi } from '../services/api';

const Attendance = () => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    timetableApi.getAll().then(res => {
      setExams(res.data);
      if (res.data.length > 0) handleExamSelect(res.data[0]);
    });
  }, []);

  const handleExamSelect = async (exam) => {
    setSelectedExam(exam);
    setLoading(true);
    try {
      const res = await attendanceApi.getLogs(exam.id);
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedExam) return;
    try {
      const res = await attendanceApi.export(selectedExam.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${selectedExam.subject}_${selectedExam.date}.csv`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      alert("Export failed");
    }
  };

  return (
    <div className="attendance-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1>Attendance Logs</h1>
          <p>Real-time verification records and exports.</p>
        </div>
        <button className="btn btn-primary" onClick={handleExport} disabled={!selectedExam}>
          <Download size={20} /> Export CSV
        </button>
      </div>

      <div className="grid-cols-2" style={{ gridTemplateColumns: '1fr 3fr' }}>
        <div className="flex flex-col gap-3">
          <h3 className="mb-2">Select Exam</h3>
          {exams.map(exam => (
            <div 
              key={exam.id} 
              className={`glass-card p-4 cursor-pointer transition-all ${selectedExam?.id === exam.id ? 'active-exam' : ''}`}
              onClick={() => handleExamSelect(exam)}
              style={{
                borderColor: selectedExam?.id === exam.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                background: selectedExam?.id === exam.id ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.03)'
              }}
            >
              <div style={{ fontWeight: 600 }}>{exam.subject}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{exam.date} • Room {exam.room_no}</div>
            </div>
          ))}
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-6 border-bottom" style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <h3>{selectedExam ? `Attendance for ${selectedExam.subject}` : 'Select an exam'}</h3>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ textAlign: 'left', padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>STUDENT</th>
                <th style={{ textAlign: 'left', padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>TIME</th>
                <th style={{ textAlign: 'left', padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>FACE MATCH</th>
                <th style={{ textAlign: 'left', padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>VERIFIED</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 600 }}>{log.student_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.enrollment_no}</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <div className="flex items-center gap-2">
                       <CheckCircle size={14} color="var(--success)" />
                       <span>{log.face_confidence}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span className="status-badge status-valid">Verified</span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan="4" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No attendance records for this exam yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
