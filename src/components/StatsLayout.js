import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function StatsLayout() {
  const { user, logout, statsSource, setStatsSource } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const lockedSource = user?.source || '';
  const isLocked = Boolean(lockedSource);
  const isOwner = !isLocked && !(user?.isServiceAccount || user?.parentUserId);
  const enabledSources = user?.subscription?.enabledSources || [];
  const enabledKey = enabledSources.join(',');
  const canSwitch = !isLocked && enabledSources.length >= 2;

  const activeSource = isLocked
    ? lockedSource
    : (enabledSources.includes(statsSource) ? statsSource : (enabledSources[0] || ''));

  useEffect(() => {
    if (isLocked) return;
    if (!enabledKey) return;
    const list = enabledKey.split(',').filter(Boolean);
    if (!list.includes(statsSource)) {
      setStatsSource(list[0]);
    }
  }, [isLocked, enabledKey, statsSource, setStatsSource]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/stats-login');
  };

  const handleSelectSource = (name) => {
    setStatsSource(name);
    setMenuOpen(false);
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
          <div ref={menuRef} style={{ position: 'relative', marginTop: 2 }}>
            {canSwitch ? (
              <>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={menuOpen}
                  aria-label="Switch source"
                  onClick={() => setMenuOpen((open) => !open)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#86efac',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '8px 0',
                    minHeight: 44,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {user?.name || 'Account'}
                  {activeSource ? ` · ${activeSource}` : ''}
                  <span aria-hidden="true" style={{ fontSize: 10 }}>{menuOpen ? '▲' : '▼'}</span>
                </button>
                {menuOpen ? (
                  <div
                    role="listbox"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      minWidth: 180,
                      background: '#fff',
                      color: '#1a1a2e',
                      borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                      zIndex: 20,
                      overflow: 'hidden'
                    }}
                  >
                    {enabledSources.map((name) => (
                      <button
                        key={name}
                        type="button"
                        role="option"
                        aria-selected={activeSource === name}
                        onClick={() => handleSelectSource(name)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          minHeight: 44,
                          padding: '10px 14px',
                          border: 'none',
                          background: activeSource === name ? '#dcfce7' : '#fff',
                          color: '#14532d',
                          fontWeight: activeSource === name ? 700 : 500,
                          cursor: 'pointer',
                          fontSize: 14
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#86efac' }}>
                {user?.name || 'User'}{activeSource ? ` · ${activeSource}` : ''}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#bbf7d0' }}>
            Remaining: <strong>{user?.messageBalance ?? 0}</strong>
            {user?.subscription?.plan?.name ? ` · ${user.subscription.plan.name}` : ''}
          </div>
          {isOwner ? (
            <Link
              to="/"
              style={{
                color: '#bbf7d0',
                fontSize: 13,
                textDecoration: 'none',
                border: '1px solid #4ade80',
                padding: '8px 12px',
                borderRadius: 6,
                minHeight: 36,
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              WhatsApp dashboard
            </Link>
          ) : null}
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
