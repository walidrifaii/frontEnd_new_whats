import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function StatsLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const source = user?.source || 'account';

  const handleLogout = () => {
    logout();
    navigate('/stats-login');
  };

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'sans-serif', background: '#f4f6f9' }}>
      <header style={{
        background: '#052e16',
        color: '#fff',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap'
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Message Stats</div>
          <div style={{ fontSize: 12, color: '#86efac', marginTop: 2 }}>
            {user?.name || 'User'}{user?.source ? ` · ${source}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 13, color: '#bbf7d0' }}>
            Remaining: <strong>{user?.messageBalance ?? 0}</strong>
            {user?.subscription?.plan?.name ? ` · ${user.subscription.plan.name}` : ''}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: '1px solid #4ade80',
              color: '#bbf7d0',
              padding: '8px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              minHeight: 36
            }}
          >
            Logout
          </button>
        </div>
      </header>
      <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
