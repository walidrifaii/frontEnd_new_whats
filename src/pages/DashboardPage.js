import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getClients, getCampaigns, getLogStats } from '../services/api';
import useAuthStore from '../store/authStore';

const StatCard = ({ label, value, color, icon }) => (
  <div style={{
    background: '#fff', borderRadius: 10, padding: '20px 24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${color}`
  }}>
    <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>{label}</div>
  </div>
);

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState({ clients: [], campaigns: [], stats: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [c, cam, s] = await Promise.all([getClients(), getCampaigns(), getLogStats()]);
        setData({ clients: c.data.clients, campaigns: cam.data.campaigns, stats: s.data.stats });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div>Loading dashboard...</div>;

  const connected = data.clients.filter(c => c.status === 'connected').length;
  const running = data.campaigns.filter(c => c.status === 'running').length;

  const balance = user?.messageBalance ?? 0;

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', color: '#1a1a2e' }}>Welcome, {user?.name} 👋</h2>
      <p style={{ color: '#666', marginBottom: 28 }}>Here's your WhatsApp marketing overview</p>

      {balance <= 0 && (
        <div style={{
          background: '#ff3b30', color: '#fff', padding: '14px 20px', borderRadius: 10,
          marginBottom: 20, fontWeight: 600, fontSize: 15
        }}>
          ⚠️ Your message balance is 0. You cannot send messages. Please contact admin to charge your balance.
        </div>
      )}
      {balance > 0 && balance <= 20 && (
        <div style={{
          background: '#ff950022', color: '#ff9500', padding: '14px 20px', borderRadius: 10,
          marginBottom: 20, fontWeight: 600, fontSize: 14, border: '1px solid #ff9500'
        }}>
          ⚠️ Low balance warning: You have only {balance} messages remaining.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Message Balance" value={balance} color={balance > 50 ? '#34c759' : balance > 10 ? '#ff9500' : '#ff3b30'} icon="💰" />
        <StatCard label="WhatsApp Clients" value={data.clients.length} color="#25d366" icon="📱" />
        <StatCard label="Connected" value={connected} color="#128c7e" icon="🟢" />
        <StatCard label="Campaigns" value={data.campaigns.length} color="#5856d6" icon="📣" />
        <StatCard label="Running" value={running} color="#ff9500" icon="▶️" />
        <StatCard label="Messages Sent" value={data.stats?.sent || 0} color="#34c759" icon="✉️" />
        <StatCard label="Messages Received" value={data.stats?.received || 0} color="#007aff" icon="📨" />
        <StatCard label="Failed" value={data.stats?.failed || 0} color="#ff3b30" icon="❌" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#333' }}>WhatsApp Clients</h3>
          {data.clients.length === 0 ? (
            <div style={{ color: '#999', fontSize: 14 }}>
              No clients yet. <Link to="/clients" style={{ color: '#25d366' }}>Add one →</Link>
            </div>
          ) : data.clients.slice(0, 5).map(c => (
            <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#999' }}>{c.phone || 'Not connected'}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#333' }}>Recent Campaigns</h3>
          {data.campaigns.length === 0 ? (
            <div style={{ color: '#999', fontSize: 14 }}>
              No campaigns yet. <Link to="/campaigns" style={{ color: '#25d366' }}>Create one →</Link>
            </div>
          ) : data.campaigns.slice(0, 5).map(c => (
            <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#999' }}>
                  {c.sentCount}/{c.totalContacts} sent
                </div>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const statusColors = {
  connected: '#25d366', disconnected: '#999', qr_ready: '#ff9500',
  initializing: '#007aff', auth_failure: '#ff3b30',
  running: '#25d366', paused: '#ff9500', completed: '#007aff', failed: '#ff3b30', draft: '#999'
};

const StatusBadge = ({ status }) => (
  <span style={{
    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
    background: statusColors[status] + '22', color: statusColors[status]
  }}>
    {status}
  </span>
);
