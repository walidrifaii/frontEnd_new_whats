import axios from 'axios';

const normalizeApiBase = (url) => {
  const trimmed = (url || '').replace(/\/+$/, '');
  if (!trimmed) return '';
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
};

const getApiBase = () => {
  // 1) Explicit API URL (recommended for separate frontend/backend deployments).
  if (process.env.REACT_APP_API_URL) {
    return normalizeApiBase(process.env.REACT_APP_API_URL);
  }

  // 2) Default to known deployed backend when env var is not set.
  return 'http://163.245.221.162:5000/api';
};

const API_BASE = getApiBase();
const FALLBACK_API_BASE = 'http://163.245.221.162:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config || {};
    const data = err.response?.data;
    const isEdge404 =
      err.response?.status === 404 &&
      data?.error?.code === '404' &&
      /page could not be found/i.test(data?.error?.message || '');

    // Some deployments route API calls to the frontend host.
    // Retry once against known backend API host as a safety net.
    if (isEdge404 && !originalRequest.__retryWithFallbackBase) {
      originalRequest.__retryWithFallbackBase = true;
      originalRequest.baseURL = FALLBACK_API_BASE;
      return api.request(originalRequest);
    }

    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      const onAdminArea = window.location.pathname.startsWith('/admin');
      window.location.href = onAdminArea ? '/admin-login' : '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const adminLogin = (email, password) => api.post('/auth/admin-login', { email, password });
export const register = (name, email, password) => api.post('/auth/register', { name, email, password });
export const getMe = () => api.get('/auth/me');

// Clients
export const getClients = () => api.get('/clients');
export const createClient = (name) => api.post('/clients', { name });
export const connectClient = (id) => api.post(`/clients/${id}/connect`);
export const disconnectClient = (id) => api.post(`/clients/${id}/disconnect`);
export const deleteClient = (id) => api.delete(`/clients/${id}`);
export const getClient = (id) => api.get(`/clients/${id}`);
export const getClientQrShareLink = (id) => api.get(`/clients/${id}/qr-share-link`);

// Campaigns
export const getCampaigns = () => api.get('/campaigns');
export const createCampaign = (data) => api.post('/campaigns', data);
export const getCampaign = (id) => api.get(`/campaigns/${id}`);
export const startCampaign = (id) => api.post(`/campaigns/${id}/start`);
export const pauseCampaign = (id) => api.post(`/campaigns/${id}/pause`);
export const deleteCampaign = (id) => api.delete(`/campaigns/${id}`);

// Contacts
export const getContacts = (campaignId, params) => api.get(`/contacts/${campaignId}`, { params });
export const uploadContacts = (campaignId, file) => {
  const form = new FormData();
  form.append('contacts', file);
  return api.post(`/contacts/${campaignId}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
export const addContact = (campaignId, data) => api.post(`/contacts/${campaignId}/add`, data);

// Logs
export const getLogs = (params) => api.get('/logs', { params });
export const getLogStats = (params) => api.get('/logs/stats', { params });

// Messages
export const sendMessage = (clientId, phone, message) =>
  api.post('/messages/send', { clientId, phone, message });

// Admin
export const getAdminUsers = () => api.get('/admin/users');
export const getAdminUser = (id) => api.get(`/admin/users/${id}`);
export const updateUserBalance = (id, balance) => api.patch(`/admin/users/${id}/balance`, { balance });
export const addUserBalance = (id, amount) => api.post(`/admin/users/${id}/add-balance`, { amount });
export const toggleUserActive = (id) => api.patch(`/admin/users/${id}/toggle-active`);
export const getAdminStats = () => api.get('/admin/stats');

export default api;
