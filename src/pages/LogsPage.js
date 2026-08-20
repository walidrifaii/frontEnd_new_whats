import React, { useEffect, useState, useCallback } from 'react';
import { getLogs, getLogStats, getClients } from '../services/api';
import useAuthStore from '../store/authStore';

export default function LogsPage() {
  const { user } = useAuthStore();
  const lockedSource = user?.source || '';
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ clientId: '', direction: '', status: '', source: '' });

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 30, ...filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const [l, s] = await Promise.all([getLogs(params), getLogStats(params)]);
      setLogs(l.data.logs);
      setTotal(l.data.total);
      setStats(s.data.stats);
      setPage(p);
    } catch {}
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    getClients().then(({ data }) => setClients(data.clients));
  }, []);

  useEffect(() => {
    if (lockedSource) {
      setFilters((prev) => (prev.source === lockedSource ? prev : { ...prev, source: lockedSource }));
    }
  }, [lockedSource]);

  useEffect(() => { load(1); }, [load]);

  const statusColors = { sent: '#25d366', failed: '#ff3b30', received: '#007aff' };

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', color: '#1a1a2e' }}>📋 Message Logs</h2>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total', value: stats.total, color: '#5856d6' },
            { label: 'Sent', value: stats.sent, color: '#25d366' },
            { label: 'Failed', value: stats.failed, color: '#ff3b30' },
            { label: 'Received', value: stats.received, color: '#007aff' },
            { label: 'Outgoing', value: stats.outgoing, color: '#ff9500' }
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: '#fff', borderRadius: 8, padding: '14px 16px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)', borderLeft: `3px solid ${color}`
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.05)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select style={selStyle} value={filters.clientId} onChange={e => setFilters(p => ({ ...p, clientId: e.target.value }))}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select style={selStyle} value={filters.direction} onChange={e => setFilters(p => ({ ...p, direction: e.target.value }))}>
          <option value="">All Directions</option>
          <option value="outgoing">Outgoing</option>
          <option value="incoming">Incoming</option>
        </select>
        <select style={selStyle} value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
          <option value="">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="received">Received</option>
        </select>
        <select
          style={selStyle}
          value={filters.source}
          disabled={Boolean(lockedSource)}
          onChange={e => setFilters(p => ({ ...p, source: e.target.value }))}
        >
          {lockedSource ? (
            <option value={lockedSource}>{lockedSource}</option>
          ) : (
            <>
              <option value="">All Sources</option>
              {[...new Set([
                ...(user?.subscription?.enabledSources || [])
              ])]
                .filter((name) => name && name !== '_untagged')
                .map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
            </>
          )}
        </select>
      </div>

      {/* Logs table */}
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8f8f8', borderBottom: '1px solid #e8e8e8' }}>
                {['Time', 'Client', 'Phone', 'Source', 'Direction', 'Status', 'Message'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#555' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log._id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '10px 14px', color: '#999', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 14px' }}>{log.clientId?.name || '—'}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{log.phone}</td>
                  <td style={{ padding: '10px 14px' }}>{log.source || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 16 }}>{log.direction === 'incoming' ? '📨' : '📤'}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: (statusColors[log.status] || '#999') + '22',
                      color: statusColors[log.status] || '#999'
                    }}>{log.status}</span>
                  </td>
                  <td style={{ padding: '10px 14px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#444' }}>
                    {log.message}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#999' }}>No logs found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderTop: '1px solid #f0f0f0', fontSize: 13, color: '#666' }}>
          <span>{total} total logs</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {page > 1 && <button onClick={() => load(page - 1)} style={btnSmall}>← Prev</button>}
            <span style={{ lineHeight: '28px' }}>Page {page}</span>
            {logs.length === 30 && <button onClick={() => load(page + 1)} style={btnSmall}>Next →</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

const selStyle = { padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 };
const btnSmall = { background: '#f0f0f0', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: 13 };
