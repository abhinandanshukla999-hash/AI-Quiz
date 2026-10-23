import axios from 'axios';

// Default to Vite proxy (/api) if VITE_API_BASE_URL is not explicitly provided
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach JWT token to all requests automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle auth expirations globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token if expired or invalid
      const currentToken = localStorage.getItem('auth_token');
      if (currentToken) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        // Notify application
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

// Authentication Endpoints
export const authAPI = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  forgotPassword: async (data) => {
    const response = await api.post('/auth/forgot-password', data);
    return response.data;
  },
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  updateProfile: async (profileData) => {
    const response = await api.put('/auth/profile', profileData);
    return response.data;
  }
};

// Notes Ingestion Endpoints
export const notesAPI = {
  uploadNote: async (payload) => {
    // If payload is FormData (contains file)
    if (payload instanceof FormData) {
      const response = await api.post('/notes/upload', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    }
    // Raw text payload
    const response = await api.post('/notes/upload', payload);
    return response.data;
  },
  getNotes: async () => {
    const response = await api.get('/notes');
    return response.data;
  },
  getNoteById: async (noteId) => {
    const response = await api.get(`/notes/${noteId}`);
    return response.data;
  }
};

// Quiz & Practice Endpoints
export const quizzesAPI = {
  generateQuiz: async ({ note_id, difficulty, quiz_type = 'mcq', count }) => {
    const response = await api.post('/quizzes/generate', { note_id, difficulty, quiz_type, count });
    return response.data;
  },
  getQuizById: async (quizId) => {
    const response = await api.get(`/quizzes/${quizId}`);
    return response.data;
  },
  submitQuiz: async (quizId, { time_taken_seconds, answers }) => {
    const response = await api.post(`/quizzes/${quizId}/submit`, {
      time_taken_seconds,
      answers
    });
    return response.data;
  },
  getAttemptResults: async (quizId, attemptId) => {
    const response = await api.get(`/quizzes/${quizId}/attempts/${attemptId}`);
    return response.data;
  },
  getWeakAreas: async () => {
    const response = await api.get('/quizzes/weak-areas');
    return response.data;
  }
};

// Analytics & Dashboard Endpoints
export const analyticsAPI = {
  getDashboardAnalytics: async () => {
    const response = await api.get('/analytics/dashboard');
    return response.data;
  }
};

export default api;
