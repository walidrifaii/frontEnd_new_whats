import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import ServiceSwitchButtons from './ServiceSwitchButtons';

const uniqueSources = (...lists) => [...new Set(
  lists.flat().map((item) => String(item || '').trim()).filter((item) => item && item !== '_untagged')
)];

export default function StatsLayout() {
  const { user, logout, statsSource, setStatsSource, statsSourceOptions } = useAuthStore();
  const navigate = useNavigate();

  const lockedSource = user?.source || '';
  const isServiceAccount = Boolean(user?.isServiceAccount || user?.parentUserId);
  const isLocked = Boolean(lockedSource) && isServiceAccount;
  const isOwner = !isServiceAccount;
  const switchSources = uniqueSources(user?.subscription?.enabledSources);
  const canSwitch = Boolean(user?.subscription?.canSwitchSources);
  const activeSource = isLocked ? lockedSource : (statsSource || '');

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
          <div style={{ fontSize: 12, color: '#86efac', marginTop: 4 }}>
            {user?.name || 'Account'}
            {activeSource ? ` · ${activeSource}` : (canSwitch ? ' · all services' : '')}
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
      {canSwitch ? (
        <div style={{
          background: '#14532d',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap'
        }}>
          <strong style={{ color: '#bbf7d0', fontSize: 13 }}>Switch service</strong>
          <ServiceSwitchButtons
            value={statsSource}
            options={switchSources}
            onChange={setStatsSource}
          />
        </div>
      ) : null}
      <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
