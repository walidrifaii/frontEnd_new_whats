import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getLogs, getLogStats, getClientPlans, requestSubscription } from '../services/api';
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
  const { user, loadUser, statsSource, setStatsSource, statsSourceOptions, setStatsSourceOptions } = useAuthStore();
  const sub = user?.subscription || {};
  const lockedSource = user?.source || '';
  const isLocked = Boolean(lockedSource);
  const enabledSources = sub.enabledSources || [];
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [requestingId, setRequestingId] = useState('');

  const sourceOptions = [...new Set(
    (isLocked ? [lockedSource] : [...(enabledSources || []), ...(statsSourceOptions || [])])
      .map((item) => String(item || '').trim())
      .filter((item) => item && item !== '_untagged')
  )];
  const activeSource = isLocked
    ? lockedSource
    : (sourceOptions.includes(statsSource) ? statsSource : (sourceOptions[0] || ''));

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const overview = await getLogStats();
      const names = [...new Set(
        (isLocked
          ? [lockedSource]
          : [
              ...(enabledSources || []),
              ...(overview.data.enabledSources || [])
            ])
          .map((item) => String(item || '').trim())
          .filter((item) => item && item !== '_untagged')
      )];
      setStatsSourceOptions(names);
      const source = isLocked
        ? lockedSource
        : (names.includes(statsSource) ? statsSource : (names[0] || ''));
      const params = { page: p, limit: 30, direction: 'outgoing', status: 'sent' };
      if (source) params.source = source;
      const [logRes, statsRes] = await Promise.all([
        getLogs(params),
        source ? getLogStats({ source }) : Promise.resolve(overview),
        loadUser()
      ]);
      setLogs(logRes.data.logs || []);
      setTotal(logRes.data.total || 0);
      setStats(statsRes.data.stats);
      setPage(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadUser, lockedSource, isLocked, statsSource, setStatsSourceOptions]);

  useEffect(() => {
    load(1);
  }, [load]);

  useEffect(() => {
    getClientPlans()
      .then(({ data }) => setPlans(data.plans || []))
      .catch(() => {});
  }, []);

  const handleRequestPlan = async (planId) => {
    setRequestingId(planId);
    try {
      const { data } = await requestSubscription(planId);
      toast.success(data.message || 'Plan requested');
      await loadUser();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not request this plan');
    } finally {
      setRequestingId('');
    }
  };

  const balance = user?.messageBalance ?? 0;
  const sent = stats?.sent || 0;

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', color: '#1a1a2e' }}>
        {activeSource ? `${activeSource} message stats` : 'My message stats'}
      </h2>

      {sub.status === 'pending' && sub.requestedPlan ? (
        <div style={{
          background: '#fff7ed',
          border: '1px solid #fdba74',
          color: '#9a3412',
          padding: '14px 18px',
          borderRadius: 10,
          marginBottom: 20,
          fontSize: 14
        }}>
          Requested <strong>{sub.requestedPlan.name}</strong> ({sub.requestedPlan.messageQuota} messages, {sub.requestedPlan.sourceLimit} sources). Waiting for admin to confirm.
        </div>
      ) : null}

      {sub.status !== 'active' && sub.status !== 'pending' ? (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ margin: '0 0 8px', color: '#1a1a2e' }}>Choose a plan</h3>
          <p style={{ color: '#666', fontSize: 14, margin: '0 0 16px' }}>
            Pick Mini, Medium, or Max. An admin confirms it, then you get that message quota and source slots.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {plans.map((plan) => (
              <div key={plan._id} style={{
                background: '#fff',
                borderRadius: 12,
                padding: 18,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#1a1a2e' }}>{plan.name}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a', margin: '8px 0 4px' }}>{plan.messageQuota}</div>
                <div style={{ color: '#666', fontSize: 13 }}>messages</div>
                <div style={{ color: '#666', fontSize: 13, marginTop: 8 }}>{plan.sourceLimit} source{plan.sourceLimit === 1 ? '' : 's'}</div>
                <button
                  type="button"
                  onClick={() => handleRequestPlan(plan._id)}
                  disabled={Boolean(requestingId)}
                  style={{
                    marginTop: 14,
                    width: '100%',
                    minHeight: 44,
                    border: 'none',
                    borderRadius: 8,
                    background: '#16a34a',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {requestingId === plan._id ? 'Sending...' : `Request ${plan.name}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {sub.status === 'active' && sub.plan ? (
        <div style={{
          background: '#fff',
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          fontSize: 14,
          color: '#444'
        }}>
          Plan: <strong>{sub.plan.name}</strong> · {sub.plan.messageQuota} messages · {sub.plan.sourceLimit} sources
          {enabledSources.length ? ` · enabled: ${enabledSources.join(', ')}` : ''}
        </div>
      ) : null}

      {!isLocked && sourceOptions.length > 0 ? (
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="stats-source-filter" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 }}>
            Filter source
          </label>
          <select
            id="stats-source-filter"
            value={activeSource}
            onChange={(e) => setStatsSource(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #ddd',
              fontSize: 14,
              minWidth: 220,
              minHeight: 44
            }}
          >
            {sourceOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      ) : null}

      {isLocked && enabledSources.length > 0 && !enabledSources.includes(lockedSource) ? (
        <div style={{
          background: '#fff7ed',
          color: '#9a3412',
          padding: '14px 18px',
          borderRadius: 10,
          marginBottom: 20,
          fontSize: 14
        }}>
          Source <strong>{lockedSource}</strong> is not enabled on this plan. Ask an admin to turn it on.
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
          hint={sub.status === 'active' ? 'Shared plan quota remaining' : 'How many this account can still send'}
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
                      No sent messages for {activeSource || 'this source'} yet.
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
