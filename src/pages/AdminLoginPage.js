import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { adminLogin } from '../services/api';
import useAuthStore from '../store/authStore';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await adminLogin(form.email, form.password);
      setAuth(data.token, data.user);
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1b0d0d 0%, #3e1a1a 100%)'
    }}>
      <div style={{
        background: '#fff', padding: 40, borderRadius: 12, width: 380,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>🛡️</div>
          <h2 style={{ margin: '8px 0 4px', color: '#1a1a2e' }}>Admin Panel Login</h2>
          <p style={{ color: '#666', margin: 0, fontSize: 14 }}>Sign in as administrator</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Admin Email</label>
            <input
              type="email"
              required
              style={inputStyle}
              value={form.email}
              placeholder="admin@example.com"
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              required
              style={inputStyle}
              value={form.password}
              placeholder="••••••••"
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Signing in...' : 'Admin Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#666' }}>
          User account? <Link to="/login" style={{ color: '#25d366' }}>Go to User Login</Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#444' };
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd',
  fontSize: 14, boxSizing: 'border-box', outline: 'none'
};
const btnStyle = {
  width: '100%', padding: '12px', background: '#ff9500', color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer'
};

