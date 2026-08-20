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
  return 'https://amctag-whats.38f0fz.easypanel.host/api';
};

const API_BASE = getApiBase();
const FALLBACK_API_BASE = 'https://amctag-whats.38f0fz.easypanel.host/api';

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
      const path = window.location.pathname;
      if (path.startsWith('/admin')) {
        window.location.href = '/admin-login';
      } else if (path.startsWith('/stats')) {
        window.location.href = '/stats-login';
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const statsLogin = (email, password) => api.post('/auth/stats-login', { email, password });
export const getServiceAccounts = () => api.get('/auth/service-accounts');
export const createOwnerServiceAccount = (data) => api.post('/auth/service-accounts', data);
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
export const createServiceAccount = (parentId, data) =>
  api.post(`/admin/users/${parentId}/service-accounts`, data);
export const getAdminPlans = () => api.get('/admin/plans');
export const updateAdminPlan = (id, data) => api.patch(`/admin/plans/${id}`, data);
export const assignUserPlan = (id, data) => api.patch(`/admin/users/${id}/plan`, data);
export const updateUserSources = (id, sources, remove = []) =>
  api.patch(`/admin/users/${id}/sources`, { sources, remove });
export const addAdminUserSource = (id, source) => api.post(`/admin/users/${id}/sources`, { source });
export const setUserSourceLock = (id, source) => api.patch(`/admin/users/${id}/source-lock`, { source });
export const getAdminUserClients = (userId) => api.get(`/admin/users/${userId}/clients`);
export const createAdminUserClient = (userId, name, source) =>
  api.post(`/admin/users/${userId}/clients`, { name, source });
export const getAdminPhoneNumbers = () => api.get('/admin/phone-numbers');
export const createAdminPhoneNumber = (data) => api.post('/admin/phone-numbers', data);
export const connectAdminClient = (id) => api.post(`/admin/clients/${id}/connect`);
export const getAdminClientQrShareLink = (id) => api.get(`/admin/clients/${id}/qr-share-link`);
export const getAdminUserCredentials = (userId) => api.get(`/admin/users/${userId}/credentials`);
export const regenerateAdminUserToken = (userId) => api.post(`/admin/users/${userId}/credentials/regenerate`);
export const getClientPlans = () => api.get('/auth/plans');
export const getSubscription = () => api.get('/auth/subscription');
export const requestSubscription = (planId) => api.post('/auth/subscription/request', { planId });

export default api;
