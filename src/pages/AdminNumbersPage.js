import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getAdminNumbers, createAdminNumber } from '../services/api';

const statusMeta = (status) => {
  if (status === 'connected') return { label: 'Connected', color: '#15803d', bg: '#dcfce7' };
  if (status === 'qr_ready') return { label: 'QR ready', color: '#b45309', bg: '#fef3c7' };
  if (status === 'initializing') return { label: 'Connecting', color: '#b45309', bg: '#fef3c7' };
  if (status === 'auth_failure') return { label: 'Auth failed', color: '#b91c1c', bg: '#fee2e2' };
  return { label: 'Disconnected', color: '#475569', bg: '#f1f5f9' };
};

const formatPhone = (phone) => (phone ? `+${phone}` : 'Not connected');

export default function AdminNumbersPage() {
  const navigate = useNavigate();
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await getAdminNumbers();
    setNumbers(data.numbers || []);
    return data.numbers || [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to load numbers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    const connecting = numbers.some((item) => ['initializing', 'qr_ready'].includes(item.status));
    if (!connecting) return;
    const timer = setInterval(() => { load().catch(() => {}); }, 3000);
    return () => clearInterval(timer);
  }, [numbers, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return numbers;
    return numbers.filter((item) => {
      const assigned = (item.assignedUsers || []).map((user) => `${user.name} ${user.email}`).join(' ');
      return [
        item.name,
        item.phone,
        item.status,
        item.plan?.name,
        assigned
      ].join(' ').toLowerCase().includes(q);
    });
  }, [numbers, search]);

  const handleCreate = async () => {
    const label = String(name || '').trim();
    if (!label) {
      toast.error('Give this number a name');
      return;
    }
    setCreating(true);
    try {
      const { data } = await createAdminNumber(label);
      toast.success(data.message || 'Number created');
      setName('');
      const id = data.number?._id;
      if (id) {
        navigate(`/admin/numbers/${id}`, { state: { openQr: true } });
        return;
      }
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create number');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: 28 }}>Phone numbers</h2>
      <p style={{ color: '#475569', fontSize: 15, margin: '0 0 24px', lineHeight: 1.5, maxWidth: 720 }}>
        Create a number, then open Details to scan QR, set a plan, and assign clients.
      </p>

      <section style={card}>
        <label htmlFor="number-label" style={labelStyle}>Add number to pool</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            id="number-label"
            placeholder="Label, e.g. Main line"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreate();
              }
            }}
            style={inputStyle}
          />
          <button type="button" onClick={handleCreate} disabled={creating} style={primaryBtn}>
            {creating ? 'Creating...' : 'Create number'}
          </button>
        </div>
      </section>

      <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <label htmlFor="number-search" style={{ ...labelStyle, marginBottom: 8 }}>Search</label>
          <input
            id="number-search"
            type="search"
            placeholder="Search by label, phone, plan, or client"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%', maxWidth: 420 }}
          />
        </div>

        {loading ? (
          <div style={{ padding: 32, color: '#64748b' }}>Loading numbers...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            {numbers.length === 0 ? 'No numbers yet. Create one above and scan QR.' : 'No numbers match this search.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 720 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={thStyle}>Label</th>
                  <th style={thStyle}>Phone</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Balance</th>
                  <th style={thStyle}>Clients</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((number) => {
                  const status = statusMeta(number.status);
                  const assigned = number.assignedUsers || [];
                  return (
                    <tr key={number._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdStyle}>
                        <Link to={`/admin/numbers/${number._id}`} style={nameLink}>
                          {number.name}
                        </Link>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                        {formatPhone(number.phone)}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ ...badge, color: status.color, background: status.bg }}>
                          {status.label}
                        </span>
                      </td>
                      <td style={tdStyle}>{number.plan?.name || 'No plan'}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#0f766e' }}>
                        {number.messageBalance ?? 0}
                      </td>
                      <td style={tdStyle}>
                        {assigned.length
                          ? assigned.map((user) => user.name || user.email).join(', ')
                          : <span style={{ color: '#94a3b8' }}>Unassigned</span>}
                      </td>
                      <td style={tdStyle}>
                        <Link to={`/admin/numbers/${number._id}`} style={detailsBtn}>
                          Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const card = {
  background: '#fff',
  borderRadius: 16,
  padding: 24,
  marginBottom: 16,
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(15,23,42,0.06)'
};
const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 700,
  color: '#0f172a',
  marginBottom: 10
};
const inputStyle = {
  flex: 1,
  minWidth: 200,
  minHeight: 44,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  boxSizing: 'border-box'
};
const primaryBtn = {
  minHeight: 44,
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#0f766e',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer'
};
const thStyle = {
  textAlign: 'left',
  padding: '12px 16px',
  fontWeight: 600,
  color: '#475569',
  fontSize: 13
};
const tdStyle = {
  padding: '14px 16px',
  verticalAlign: 'middle',
  color: '#0f172a'
};
const badge = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600
};
const nameLink = {
  color: '#0f172a',
  fontWeight: 700,
  textDecoration: 'none'
};
const detailsBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '10px 16px',
  borderRadius: 8,
  background: '#0f172a',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  textDecoration: 'none'
};
