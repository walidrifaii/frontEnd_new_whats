import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { login } from '../services/api';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await login(form.email, form.password);
      setAuth(data.token, data.user);
      if (data.user?.isServiceAccount || data.user?.parentUserId) {
        navigate('/stats', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0d0d1f 0%, #1a1a3e 100%)'
    }}>
      <div style={{
        background: '#fff', padding: 40, borderRadius: 12, width: 380,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>💬</div>
          <h2 style={{ margin: '8px 0 4px', color: '#1a1a2e' }}>WA Marketing SaaS</h2>
          <p style={{ color: '#666', margin: 0, fontSize: 14 }}>Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input type="email" required style={inputStyle}
              value={form.email} placeholder="you@example.com"
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Password</label>
            <input type="password" required style={inputStyle}
              value={form.password} placeholder="••••••••"
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#666' }}>
          Don't have an account? <Link to="/register" style={{ color: '#25d366' }}>Register</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: '#888' }}>
          Admin account? <Link to="/admin-login" style={{ color: '#ff9500' }}>Admin Login</Link>
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
  width: '100%', padding: '12px', background: '#25d366', color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer'
};
