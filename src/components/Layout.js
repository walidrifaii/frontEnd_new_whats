import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { getLogStats } from '../services/api';

const IconPhone = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M6.6 2.8h2.2c.5 0 .9.3 1 .8l.7 2.6c.1.5 0 1-.4 1.3L8.6 9.1a12.1 12.1 0 0 0 6.3 6.3l1.6-1.5c.3-.4.8-.5 1.3-.4l2.6.7c.5.1.8.5.8 1v2.2c0 .6-.5 1.1-1.1 1.1C11.7 18.5 5.5 12.3 5.5 4c0-.6.5-1.2 1.1-1.2z" />
  </svg>
);

const IconClients = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="9.5" cy="7" r="3.2" />
    <path d="M20 21v-2a3.8 3.8 0 0 0-3-3.7" />
    <path d="M16 3.6a3.2 3.2 0 0 1 0 6.2" />
  </svg>
);

const IconPlans = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <path d="M7 9h10M7 12.5h6" />
  </svg>
);

const IconHome = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
  </svg>
);

const linkStyle = (isActive, accent) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minHeight: 44,
  padding: '10px 16px',
  color: isActive ? accent : '#ccc',
  textDecoration: 'none',
  background: isActive ? '#0d0d1f' : 'transparent',
  borderLeft: isActive ? `3px solid ${accent}` : '3px solid transparent',
  whiteSpace: 'nowrap',
  fontSize: 14,
  fontWeight: isActive ? 600 : 500
});

export default function Layout() {
  const { user, logout, statsSource, setStatsSource, statsSourceOptions, setStatsSourceOptions } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isAdmin = user?.isAdmin || user?.role === 'admin';
  const isServiceAccount = Boolean(user?.isServiceAccount || user?.parentUserId);
  const lockedSource = user?.source || '';
  const canSwitchService = !isAdmin && !lockedSource;

  useEffect(() => {
    if (!canSwitchService) return;
    let cancelled = false;
    getLogStats()
      .then(({ data }) => {
        if (cancelled) return;
        const names = [
          'shop',
          'crm',
          ...(data.knownSources || []),
          ...(data.enabledSources || []),
          ...(data.bySource || []).map((row) => row.source)
        ];
        setStatsSourceOptions(names);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [canSwitchService, setStatsSourceOptions]);

  const navItems = isServiceAccount
    ? [
        { to: '/stats', label: 'My Stats', end: true }
      ]
    : [
        { to: '/', label: 'Dashboard', end: true },
        { to: '/clients', label: 'WhatsApp Clients' },
        { to: '/campaigns', label: 'Campaigns' },
        { to: '/logs', label: 'Message Logs' },
        { to: '/stats', label: 'Message Stats' }
      ];

  const adminItems = [
    { to: '/admin', label: 'Overview', end: true, icon: <IconHome /> },
    { to: '/admin/numbers', label: 'Phone numbers', icon: <IconPhone /> },
    { to: '/admin/users', label: 'Clients', icon: <IconClients /> },
    { to: '/admin/plans', label: 'Plans', icon: <IconPlans /> }
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 240 : 72, background: '#1a1a2e', color: '#eee',
        display: 'flex', flexDirection: 'column', transition: 'width 0.2s', overflow: 'hidden'
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #333', whiteSpace: 'nowrap' }}>
          <strong style={{ fontSize: 18, color: '#25d366' }}>
            {sidebarOpen ? '💬 WA SaaS' : '💬'}
          </strong>
        </div>
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {!isAdmin && navItems.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => linkStyle(isActive, '#25d366')}>
              {sidebarOpen ? label : label.charAt(0)}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div style={{ padding: '16px 16px 6px', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
                {sidebarOpen ? 'Menu' : ''}
              </div>
              {adminItems.map(({ to, label, end, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  aria-label={label}
                  title={label}
                  style={({ isActive }) => linkStyle(isActive, '#ff9500')}
                >
                  <span style={{ display: 'inline-flex', width: 20, flexShrink: 0 }}>{icon}</span>
                  {sidebarOpen ? label : null}
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
            {!isAdmin && user?.source && (
              <div style={{ color: '#25d366', fontSize: 11, marginBottom: 8 }}>
                Service: {user.source}
              </div>
            )}
            {canSwitchService ? (
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="sidebar-service" style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Service
                </label>
                <select
                  id="sidebar-service"
                  aria-label="Switch service"
                  value={statsSource}
                  onChange={(e) => setStatsSource(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 44,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background: '#0d0d1f',
                    color: '#eee',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  <option value="">All services</option>
                  {statsSourceOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {isAdmin && (
              <div style={{ color: '#ff9500', fontSize: 11, marginBottom: 8 }}>Admin</div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: 'none',
                border: '1px solid #555',
                color: '#aaa',
                padding: '10px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                width: '100%',
                minHeight: 44
              }}
            >
              Logout
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          padding: '12px 24px', background: '#fff', borderBottom: '1px solid #e0e0e0',
          display: 'flex', alignItems: 'center', gap: 16
        }}>
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              minWidth: 44,
              minHeight: 44
            }}
          >
            ☰
          </button>
          <span style={{ fontWeight: 600, color: '#333', flex: 1 }}>WhatsApp Marketing SaaS</span>
          {canSwitchService ? (
            <label htmlFor="header-service" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
              Service
              <select
                id="header-service"
                aria-label="Switch service"
                value={statsSource}
                onChange={(e) => setStatsSource(e.target.value)}
                style={{
                  minHeight: 44,
                  minWidth: 160,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #d0d5dd',
                  background: '#fff',
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                <option value="">All services</option>
                {statsSourceOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#f4f6f9' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
