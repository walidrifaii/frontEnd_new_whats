import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isAdmin = user?.isAdmin || user?.role === 'admin';

  const navItems = [
    { to: '/', label: '📊 Dashboard', end: true },
    { to: '/clients', label: '📱 WhatsApp Clients' },
    { to: '/campaigns', label: '📣 Campaigns' },
    { to: '/logs', label: '📋 Message Logs' }
  ];

  const adminItems = [
    { to: '/admin', label: '🛡️ Admin Dashboard', end: true },
    { to: '/admin/users', label: '👥 Manage Users' }
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 240 : 60, background: '#1a1a2e', color: '#eee',
        display: 'flex', flexDirection: 'column', transition: 'width 0.2s', overflow: 'hidden'
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #333', whiteSpace: 'nowrap' }}>
          <strong style={{ fontSize: 18, color: '#25d366' }}>
            {sidebarOpen ? '💬 WA SaaS' : '💬'}
          </strong>
        </div>
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {!isAdmin && navItems.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
              display: 'block', padding: '10px 16px', color: isActive ? '#25d366' : '#ccc',
              textDecoration: 'none', background: isActive ? '#0d0d1f' : 'transparent',
              borderLeft: isActive ? '3px solid #25d366' : '3px solid transparent',
              whiteSpace: 'nowrap', fontSize: 14
            })}>
              {label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div style={{ padding: '16px 16px 6px', fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>
                {sidebarOpen ? 'Admin' : '—'}
              </div>
              {adminItems.map(({ to, label, end }) => (
                <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
                  display: 'block', padding: '10px 16px', color: isActive ? '#ff9500' : '#ccc',
                  textDecoration: 'none', background: isActive ? '#0d0d1f' : 'transparent',
                  borderLeft: isActive ? '3px solid #ff9500' : '3px solid transparent',
                  whiteSpace: 'nowrap', fontSize: 14
                })}>
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        {sidebarOpen && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #333', fontSize: 13 }}>
            <div style={{ color: '#aaa', marginBottom: 4 }}>{user?.name}</div>
            {!isAdmin && (
              <div style={{
                color: user?.messageBalance > 10 ? '#25d366' : '#ff3b30',
                fontSize: 12, marginBottom: 8, fontWeight: 600
              }}>
                Balance: {user?.messageBalance ?? 0} messages
              </div>
            )}
            {isAdmin && (
              <div style={{ color: '#ff9500', fontSize: 11, marginBottom: 8 }}>Admin</div>
            )}
            <button onClick={handleLogout} style={{
              background: 'none', border: '1px solid #555', color: '#aaa',
              padding: '6px 12px', borderRadius: 4, cursor: 'pointer', width: '100%'
            }}>Logout</button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          padding: '12px 24px', background: '#fff', borderBottom: '1px solid #e0e0e0',
          display: 'flex', alignItems: 'center', gap: 16
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: 'none', border: 'none', fontSize: 20, cursor: 'pointer'
          }}>☰</button>
          <span style={{ fontWeight: 600, color: '#333' }}>WhatsApp Marketing SaaS</span>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#f4f6f9' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
