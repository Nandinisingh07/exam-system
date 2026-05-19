import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  me: () => api.get('/auth/me'),
};

export const logisticsApi = {
  // Classrooms
  getClassrooms: () => api.get('/logistics/classrooms'),
  addClassroom: (data) => api.post('/logistics/classrooms', data),
  
  // Exams
  getExams: () => api.get('/logistics/exams'),
  addExam: (data) => api.post('/logistics/exams', data),
  
  // Seat Allocations
  getAllocations: (examId) => api.get(`/logistics/allocations/${examId}`),
  generateAllocations: (examId) => api.post(`/logistics/allocations/generate/${examId}`),
  getMyDuty: () => api.get('/logistics/my-duty'),
};

export const monitoringApi = {
  logExit: (enrollment_no, exam_id) => api.post('/monitoring/washroom/exit', null, { params: { enrollment_no, exam_id } }),
  logEntry: (logId) => api.post(`/monitoring/washroom/entry/${logId}`),
  getWashroomLogs: (examId) => api.get('/monitoring/washroom', { params: { exam_id: examId } }),
  getBiometricLogs: () => api.get('/monitoring/biometric'),
};

export const adminApi = {
  getOverview: () => api.get('/admin/overview'),
  importStudents: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/import/students', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  registerStudent: (formData) => api.post('/students/register', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getStudents: () => api.get('/students'),
  deleteStudent: (id) => api.delete(`/students/${id}`),
};

export const attendanceApi = {
  getRecord: (studentId, examId) => api.get('/attendance/record', { params: { student_id: studentId, exam_id: examId } }),
  markAttendance: (data) => api.post('/attendance/mark', data),
};

export const studentApi = {
  getAll:     () => api.get('/students'),
  getProfile: () => api.get('/student/profile'),
  getSchedule:() => api.get('/student/schedule'),
  getSeat:    (examId) => api.get(`/student/seat/${examId}`),
};

export const timetableApi = {
  getToday: () => logisticsApi.getExams(),
};

export const verificationApi = {
  verifyFace:      (data)     => api.post('/verify/step-face', data),
  verifyAdmit:     (data)     => api.post('/verify/step-admit', data),
  verifyId:        (data)     => api.post('/verify/step-id', data),
  getReviewQueue:  ()         => api.get('/verify/review/queue'),
  approveReview:   (id)       => api.post(`/verify/review/${id}/approve`),
  rejectReview:    (id)       => api.post(`/verify/review/${id}/reject`),
  getFraudAlerts:  ()         => api.get('/verify/fraud-alerts'),
};

export default api;
