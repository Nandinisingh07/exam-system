import React, { useState, useEffect } from 'react';
import { Users, Calendar, ClipboardCheck, AlertCircle, ArrowUpRight, TrendingUp } from 'lucide-react';
import { timetableApi, studentApi } from '../services/api';

const StatCard = ({ title, value, icon, trend, color }) => (
  <div className="glass-card card animate-fade-in">
    <div className="flex justify-between items-start mb-4">
      <div style={{ background: `${color}15`, color: color, padding: '12px', borderRadius: '16px' }}>
        {icon}
      </div>
      {trend && (
        <div className="status-badge status-valid flex items-center gap-1">
          <TrendingUp size={12} /> {trend}
        </div>
      )}
    </div>
    <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '4px' }}>{title}</h3>
    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{value}</div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    examsToday: 0,
    attendanceToday: 0,
    pendingVerifications: 0
  });
  const [todayExams, setTodayExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [students, today] = await Promise.all([
          studentApi.getAll(),
          timetableApi.getToday()
        ]);
        
        setStats({
          totalStudents: students.data.length,
          examsToday: today.data.length,
          attendanceToday: '85%', // Mock for now
          pendingVerifications: 12
        });
        setTodayExams(today.data);
      } catch (err) {
        console.error("Error fetching dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="dashboard">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, Admin. Here's what's happening today.</p>
        </div>
        <div className="status-badge status-valid flex items-center gap-2" style={{ padding: '10px 20px' }}>
          <div style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 10px #22c55e' }}></div>
          System Online
        </div>
      </div>

      <div className="grid-cols-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: '40px' }}>
        <StatCard title="Total Registered Students" value={stats.totalStudents} icon={<Users size={24} />} color="#6366f1" trend="+12%" />
        <StatCard title="Exams Scheduled Today" value={stats.examsToday} icon={<Calendar size={24} />} color="#ec4899" />
        <StatCard title="Average Attendance" value={stats.attendanceToday} icon={<ClipboardCheck size={24} />} color="#8b5cf6" trend="+5%" />
        <StatCard title="Pending Review" value={stats.pendingVerifications} icon={<AlertCircle size={24} />} color="#f59e0b" />
      </div>

      <div className="grid-cols-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="glass-card card">
          <div className="flex justify-between items-center mb-6">
            <h3>Today's Exam Schedule</h3>
            <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }}>View All</button>
          </div>
          
          <div className="exam-list flex flex-col gap-4">
            {todayExams.length > 0 ? todayExams.map((exam) => (
              <div key={exam.id} className="flex items-center justify-between p-4" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
                <div className="flex items-center gap-4">
                  <div style={{ background: 'var(--primary)', color: 'white', padding: '10px', borderRadius: '12px' }}>
                    <Calendar size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{exam.subject}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Room {exam.room_no} • {exam.start_time} - {exam.end_time}</div>
                  </div>
                </div>
                <div className="status-badge status-valid">Active</div>
              </div>
            )) : (
              <div className="text-center py-8">
                <p>No exams scheduled for today.</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card card">
          <h3>Quick Actions</h3>
          <div className="flex flex-col gap-3 mt-6">
            <button className="btn btn-primary" style={{ width: '100%' }}>Launch Verification Kiosk</button>
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}>
              <Users size={18} /> Register New Student
            </button>
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}>
              <Calendar size={18} /> Upload Timetable
            </button>
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}>
              <TrendingUp size={18} /> Download Reports
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
