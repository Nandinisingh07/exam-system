import AttendanceLogs from './pages/invigilator/AttendanceLogs';
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './components/Layout';

// Admin pages
import AdminOverview from './pages/admin/Overview';
import AdminStudents from './pages/admin/Students';
import ExamDutyManagement from './pages/admin/ExamDutyManagement';
import Classrooms from './pages/admin/Classrooms';
import Monitoring from './pages/admin/Monitoring';
import Reports from './pages/admin/Reports';

// Invigilator pages
import InvigilatorDashboard from './pages/invigilator/Dashboard';
import InvigilatorKiosk from './pages/invigilator/Kiosk';
import InvigilatorWashroom from './pages/invigilator/WashroomLog';
import AdminInvigilators from './pages/admin/Invigilators';


const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
};

const SmartRedirect = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user?.role;
  if (role === 'invigilator') return <Navigate to="/invigilator/dashboard" replace />;
  return <AdminOverview />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><SmartRedirect /></PrivateRoute>} />
        
        {/* Redirects for bare root roles */}
        <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
        <Route path="/invigilator" element={<Navigate to="/invigilator/dashboard" replace />} />

        {/* Admin Routes */}
        <Route path="/admin/overview" element={<PrivateRoute><AdminOverview /></PrivateRoute>} />
        <Route path="/admin/students" element={<PrivateRoute><AdminStudents /></PrivateRoute>} />
        <Route path="/admin/exam-duty" element={<PrivateRoute><ExamDutyManagement /></PrivateRoute>} />
        {/* Legacy routes redirect to merged page */}
        <Route path="/admin/exams" element={<Navigate to="/admin/exam-duty" replace />} />
        <Route path="/admin/duties" element={<Navigate to="/admin/exam-duty" replace />} />
        <Route path="/admin/rooms" element={<PrivateRoute><Classrooms /></PrivateRoute>} />
        <Route path="/admin/monitoring" element={<PrivateRoute><Monitoring /></PrivateRoute>} />
        <Route path="/admin/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
        <Route path="/admin/invigilators" element={<PrivateRoute><AdminInvigilators /></PrivateRoute>} />

        {/* Invigilator Routes */}
        <Route path="/invigilator/dashboard" element={<PrivateRoute><InvigilatorDashboard /></PrivateRoute>} />
        <Route path="/invigilator/kiosk" element={<PrivateRoute><InvigilatorKiosk /></PrivateRoute>} />
        <Route path="/invigilator/attendance" element={<PrivateRoute><AttendanceLogs /></PrivateRoute>} />
        <Route path="/invigilator/washroom" element={<PrivateRoute><InvigilatorWashroom /></PrivateRoute>} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
