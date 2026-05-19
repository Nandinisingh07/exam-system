import React, { useState, useEffect } from 'react';
import { Calendar, Upload, FileText, Download, CheckCircle, Clock, MapPin } from 'lucide-react';
import { timetableApi } from '../services/api';

const Timetable = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    timetableApi.getAll().then(res => {
      setExams(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="timetable-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1>Exam Timetable</h1>
          <p>Schedule and coordinate upcoming examinations.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-ghost"><Download size={20} /> Export</button>
          <button className="btn btn-primary"><Upload size={20} /> Upload Schedule</button>
        </div>
      </div>

      <div className="grid-cols-3">
        {exams.map((exam) => (
          <div key={exam.id} className="glass-card card animate-fade-in">
            <div className="flex justify-between items-start mb-4">
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '10px', borderRadius: '12px' }}>
                <FileText size={24} />
              </div>
              <div className="status-badge status-pending">Scheduled</div>
            </div>
            <h3 className="mb-2">{exam.subject}</h3>
            <div className="flex flex-col gap-3 mt-4">
              <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                <Clock size={16} color="var(--primary)" /> {exam.date} | {exam.start_time} - {exam.end_time}
              </div>
              <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                <MapPin size={16} color="var(--primary)" /> Examination Hall - Room {exam.room_no}
              </div>
            </div>
            <div className="mt-8 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button className="btn btn-ghost" style={{ width: '100%', fontSize: '0.85rem' }}>View Candidate List</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timetable;
