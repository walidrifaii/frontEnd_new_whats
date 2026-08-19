import React, { useCallback, useEffect, useState } from 'react';
import { getLogs, getLogStats } from '../services/api';
import useAuthStore from '../store/authStore';

const StatCard = ({ label, value, color, hint }) => (
  <div style={{
    background: '#fff',
    borderRadius: 10,
    padding: '20px 24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    borderLeft: `4px solid ${color}`
  }}>
    <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>{label}</div>
    {hint ? (
      <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>{hint}</div>
    ) : null}
  </div>
);

const statusColors = {
  sent: '#25d366',
  failed: '#ff3b30',
  received: '#007aff'
};

export default function StatsPage() {
  const { user, loadUser } = useAuthStore();
  const lockedSource = user?.source || '';
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [bySource, setBySource] = useState([]);
  const [sourceFilter, setSourceFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const activeSource = lockedSource || sourceFilter;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 30, direction: 'outgoing', status: 'sent' };
      if (activeSource) params.source = activeSource;
      const statsParams = activeSource ? { source: activeSource } : undefined;
      const [logRes, statsRes] = await Promise.all([
        getLogs(params),
        getLogStats(statsParams),
        loadUser()
      ]);
      setLogs(logRes.data.logs || []);
      setTotal(logRes.data.total || 0);
      setStats(statsRes.data.stats);
      setBySource(statsRes.data.bySource || []);
      setPage(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadUser, activeSource]);

  useEffect(() => {
    load(1);
  }, [load]);

  const balance = user?.messageBalance ?? 0;
  const sent = stats?.sent || 0;

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', color: '#1a1a2e' }}>
        {lockedSource ? `${lockedSource} message stats` : 'My message stats'}
      </h2>
      <p style={{ color: '#666', marginBottom: 16 }}>
        {lockedSource
          ? `This login only sees ${lockedSource} messages on the shared WhatsApp number.`
          : 'These numbers belong to this login. Filter by source to split ehkini and solv.'}
      </p>

      {!lockedSource ? (
        <div style={{ marginBottom: 24 }}>
          <label htmlFor="source-filter" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 }}>
            Source
          </label>
          <select
            id="source-filter"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, minWidth: 220 }}
          >
            <option value="">All sources</option>
            {bySource.filter((row) => row.source && row.source !== '_untagged').map((row) => (
              <option key={row.source} value={row.source}>
                {row.source} ({row.sent || 0} sent)
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {balance <= 0 ? (
        <div style={{
          background: '#ff3b30',
          color: '#fff',
          padding: '14px 20px',
          borderRadius: 10,
          marginBottom: 20,
          fontWeight: 600,
          fontSize: 15
        }}>
          Your remaining balance is 0. You cannot send more messages until an admin charges this account.
        </div>
      ) : null}

      {balance > 0 && balance <= 20 ? (
        <div style={{
          background: '#ff950022',
          color: '#ff9500',
          padding: '14px 20px',
          borderRadius: 10,
          marginBottom: 20,
          fontWeight: 600,
          fontSize: 14,
          border: '1px solid #ff9500'
        }}>
          Low balance: {balance} messages remaining on this account.
        </div>
      ) : null}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 28
      }}>
        <StatCard
          label="Messages remaining"
          value={balance}
          color={balance > 50 ? '#34c759' : balance > 10 ? '#ff9500' : '#ff3b30'}
          hint="How many this account can still send"
        />
        <StatCard
          label="Messages sent"
          value={sent}
          color="#34c759"
          hint="Successful sends from this account"
        />
        <StatCard
          label="Failed"
          value={stats?.failed || 0}
          color="#ff3b30"
          hint="Sends that did not go through"
        />
      </div>

      <div style={{
        background: '#fff',
        borderRadius: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <h3 style={{ margin: 0, color: '#333' }}>Sent messages</h3>
          <span style={{ fontSize: 13, color: '#666' }}>{total} sent</span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f8f8', borderBottom: '1px solid #e8e8e8' }}>
                  {['Time', 'WhatsApp client', 'Phone', 'Source', 'Status', 'Message'].map((heading) => (
                    <th
                      key={heading}
                      style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#555' }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '10px 14px', color: '#999', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{log.clientId?.name || '—'}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{log.phone}</td>
                    <td style={{ padding: '10px 14px' }}>{log.source || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        background: (statusColors[log.status] || '#999') + '22',
                        color: statusColors[log.status] || '#999'
                      }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{
                      padding: '10px 14px',
                      maxWidth: 360,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#444'
                    }}>
                      {log.message}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#999' }}>
                      No sent messages on this account yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderTop: '1px solid #f0f0f0',
          fontSize: 13,
          color: '#666',
          flexWrap: 'wrap',
          gap: 8
        }}>
          <span>Page {page}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {page > 1 ? (
              <button
                type="button"
                onClick={() => load(page - 1)}
                style={btnSmall}
              >
                Previous
              </button>
            ) : null}
            {logs.length === 30 ? (
              <button
                type="button"
                onClick={() => load(page + 1)}
                style={btnSmall}
              >
                Next
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const btnSmall = {
  background: '#f0f0f0',
  border: 'none',
  borderRadius: 4,
  padding: '8px 14px',
  cursor: 'pointer',
  fontSize: 13,
  minHeight: 36
};
