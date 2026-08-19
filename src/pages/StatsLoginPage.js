import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { statsLogin } from '../services/api';
import useAuthStore from '../store/authStore';

export default function StatsLoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await statsLogin(form.email, form.password);
      setAuth(data.token, data.user);
      navigate('/stats', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #052e16 0%, #0f172a 100%)',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        background: '#fff',
        padding: 40,
        borderRadius: 12,
        width: 400,
        maxWidth: '92vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56,
            height: 56,
            margin: '0 auto 12px',
            borderRadius: 14,
            background: '#dcfce7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 800,
            color: '#16a34a'
          }}>
            MS
          </div>
          <h2 style={{ margin: '8px 0 4px', color: '#1a1a2e' }}>Message Stats</h2>
          <p style={{ color: '#666', margin: 0, fontSize: 14 }}>
            Sign in with your ehkini or solv account
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="stats-email" style={labelStyle}>Email</label>
            <input
              id="stats-email"
              type="email"
              required
              autoComplete="username"
              style={inputStyle}
              value={form.email}
              placeholder="ehkini@example.com"
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="stats-password" style={labelStyle}>Password</label>
            <input
              id="stats-password"
              type="password"
              required
              autoComplete="current-password"
              style={inputStyle}
              value={form.password}
              placeholder="••••••••"
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Signing in...' : 'Open stats dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#444' };
const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid #ddd',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none'
};
const btnStyle = {
  width: '100%',
  padding: '12px',
  background: '#16a34a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer'
};
