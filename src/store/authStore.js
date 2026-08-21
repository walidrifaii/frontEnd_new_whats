import { create } from 'zustand';
import { getMe } from '../services/api';

const ACTIVE_SERVICE_KEY = 'activeService';

const readStoredSource = () => {
  try {
    return localStorage.getItem(ACTIVE_SERVICE_KEY) || sessionStorage.getItem('statsSource') || '';
  } catch (_) {
    return '';
  }
};

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: true,
  statsSource: readStoredSource(),
  statsSourceOptions: [],

  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    set({ token, user, loading: false });
  },

  setStatsSource: (source) => {
    const value = String(source || '');
    try {
      if (value) localStorage.setItem(ACTIVE_SERVICE_KEY, value);
      else localStorage.removeItem(ACTIVE_SERVICE_KEY);
      sessionStorage.removeItem('statsSource');
    } catch (_) { /* ignore */ }
    set({ statsSource: value });
  },

  setStatsSourceOptions: (list) => {
    const names = [...new Set((Array.isArray(list) ? list : [])
      .map((item) => String(item || '').trim())
      .filter((item) => item && item !== '_untagged'))];
    set({ statsSourceOptions: names });
  },

  logout: () => {
    localStorage.removeItem('token');
    try {
      localStorage.removeItem(ACTIVE_SERVICE_KEY);
      sessionStorage.removeItem('statsSource');
    } catch (_) { /* ignore */ }
    set({ token: null, user: null, statsSource: '', statsSourceOptions: [], loading: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const { data } = await getMe();
      set({ user: data.user, loading: false });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        localStorage.removeItem('token');
        try {
          sessionStorage.removeItem('statsSource');
          localStorage.removeItem('activeService');
        } catch (_) { /* ignore */ }
        set({ token: null, user: null, statsSource: '', statsSourceOptions: [], loading: false });
        return;
      }
      set({ loading: false });
    }
  }
}));

export default useAuthStore;
