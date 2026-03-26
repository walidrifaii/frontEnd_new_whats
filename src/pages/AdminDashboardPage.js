import React, { useEffect, useState } from 'react';
import { getAdminStats } from '../services/api';

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

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(({ data }) => setStats(data.stats))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading admin dashboard...</div>;

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', color: '#1a1a2e' }}>Admin Dashboard</h2>
      <p style={{ color: '#666', marginBottom: 28 }}>Platform-wide overview</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard label="Total Users" value={stats?.totalUsers || 0} color="#5856d6" icon="👥" />
        <StatCard label="Active Users" value={stats?.activeUsers || 0} color="#25d366" icon="✅" />
        <StatCard label="WhatsApp Clients" value={stats?.totalClients || 0} color="#007aff" icon="📱" />
        <StatCard label="Connected Now" value={stats?.connectedClients || 0} color="#128c7e" icon="🟢" />
        <StatCard label="Messages Sent" value={stats?.sentMessages || 0} color="#34c759" icon="✉️" />
        <StatCard label="Messages Received" value={stats?.receivedMessages || 0} color="#007aff" icon="📨" />
        <StatCard label="Failed Messages" value={stats?.failedMessages || 0} color="#ff3b30" icon="❌" />
        <StatCard label="Total Messages" value={stats?.totalMessages || 0} color="#ff9500" icon="📊" />
      </div>
    </div>
  );
}
