import axios from 'axios';

const API_BASE_URL = 'https://decaf-brim-steadfast.ngrok-free.dev';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email, password) => {
    if (typeof email === 'object' && email !== null) {
      return api.post('/api/auth/login', email);
    }
    return api.post('/api/auth/login', { email, password });
  },
  me:        () => api.get('/api/auth/me'),
  register:  (name, email, password, role) =>
    api.post('/api/auth/register', { name, email, password, role }),
  listUsers: () => api.get('/api/auth/users'),
  deleteUser: (id) => api.delete(`/api/auth/users/${id}`),
};

export const logisticsApi = {
  getClassrooms:       () => api.get('/api/logistics/classrooms'),
  addClassroom:        (data) => api.post('/api/logistics/classrooms', data),
  getExams:            () => api.get('/api/logistics/exams'),
  addExam:             (data) => api.post('/api/logistics/exams', data),
  getAllocations:       (examId) => api.get(`/api/logistics/allocations/${examId}`),
  generateAllocations: (examId) => api.post(`/api/logistics/allocations/generate/${examId}`),
  getMyDuty:           () => api.get('/api/logistics/my-duty'),
  getMyDutiesAll:      () => api.get('/api/logistics/my-duties-all'),
  getDuties:           () => api.get('/api/logistics/duties'),
  assignDuty:          (teacher_id, classroom_id, exam_id) => 
    api.post(`/api/logistics/duties?teacher_id=${teacher_id}&classroom_id=${classroom_id}&exam_id=${exam_id}`),
  getDutyDocuments:    () => api.get('/api/logistics/duty-documents'),
  addDutyDocument:     (data) => api.post('/api/logistics/duty-documents', data),
  deleteDutyDocument:  (id) => api.delete(`/api/logistics/duty-documents/${id}`),
  deleteDuty:          (id) => api.delete(`/api/logistics/duties/${id}`),
};

export const monitoringApi = {
  logExit:         (enrollment_no, exam_id) => api.post('/api/monitoring/washroom/exit', null, { params: { enrollment_no, exam_id } }),
  logEntry:        (logId) => api.post(`/api/monitoring/washroom/entry/${logId}`),
  getWashroomLogs: (examId) => api.get('/api/monitoring/washroom', { params: { exam_id: examId } }),
  getBiometricLogs:() => api.get('/api/monitoring/biometric'),
};

export const adminApi = {
  getOverview:    () => api.get('/api/admin/overview'),
  importStudents: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/admin/import/students', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  registerStudent: (formData) => api.post('/api/students/register', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getStudents:   () => api.get('/api/students'),
  deleteStudent: (id) => api.delete(`/api/students/${id}`),
};

export const attendanceApi = {
  getRecord:      (studentId, examId) => api.get('/api/attendance/record', { params: { student_id: studentId, exam_id: examId } }),
  markAttendance: (data) => api.post('/api/attendance/mark', data),
  getByExam:      (examId) => api.get(`/api/attendance/exam/${examId}`),
  getAll:         () => api.get('/api/attendance'),
  getMy:          () => api.get('/api/attendance/my'),
  getLogs:        (examId) => api.get(`/api/attendance/exam/${examId}`),
  exportUrl:      (examId, fmt) => `${API_BASE_URL}/api/attendance/export/${examId}?fmt=${fmt}`,
  exportAll:      (fmt) => `${API_BASE_URL}/api/attendance/export-all?fmt=${fmt}`,
  exportWithAuth: (examId, fmt) => api.get(`/api/attendance/export/${examId}?fmt=${fmt}`, { responseType: 'blob' }),
  exportAllWithAuth: (fmt) => api.get(`/api/attendance/export-all?fmt=${fmt}`, { responseType: 'blob' }),
  exportInvigilatorWithAuth: (invigilatorId, fmt) => api.get(`/api/attendance/export-invigilator/${invigilatorId}?fmt=${fmt}`, { responseType: 'blob' }),
};

export const studentApi = {
  getAll:      () => api.get('/api/students'),
  getProfile:  () => api.get('/api/student/profile'),
  getSchedule: () => api.get('/api/student/schedule'),
  getSeat:     (examId) => api.get(`/api/student/seat/${examId}`),
};

export const timetableApi = {
  getToday:   () => api.get('/api/logistics/exams'),
  all:        () => api.get('/api/logistics/exams'),
  myDuties:      () => api.get('/api/logistics/my-duty'),
  myDutiesAll:   () => api.get('/api/logistics/my-duties-all'),
};

export const verificationApi = {
  verify:          (payload) => api.post('/api/verify/student', payload),
  verifyFace:      (data) => api.post('/api/verify/step-face', data),
  verifyAdmit:     (data) => api.post('/api/verify/step-admit', data),
  verifyId:        (data) => api.post('/api/verify/step-id', data),
  getReviewQueue:  ()     => api.get('/api/verify/review/queue'),
  approveReview:   (id)   => api.post(`/api/verify/review/${id}/approve`),
  rejectReview:    (id)   => api.post(`/api/verify/review/${id}/reject`),
  getFraudAlerts:  ()     => api.get('/api/verify/fraud-alerts'),
};

export default api;





