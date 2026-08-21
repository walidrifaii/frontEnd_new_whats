import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getAdminNumber,
  assignAdminNumberPlan,
  assignAdminNumberUser,
  updateAdminNumberBalance,
  connectAdminClient,
  getAdminClientQrShareLink
} from '../services/api';

const statusMeta = (status) => {
  if (status === 'connected') return { label: 'Connected', color: '#15803d', bg: '#dcfce7' };
  if (status === 'qr_ready') return { label: 'QR ready', color: '#b45309', bg: '#fef3c7' };
  if (status === 'initializing') return { label: 'Connecting', color: '#b45309', bg: '#fef3c7' };
  if (status === 'auth_failure') return { label: 'Auth failed', color: '#b91c1c', bg: '#fee2e2' };
  return { label: 'Disconnected', color: '#475569', bg: '#f1f5f9' };
};

const formatPhone = (phone) => (phone ? `+${phone}` : 'Not connected');

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const copyText = async (value) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  window.prompt('Copy this value:', value);
  return false;
};

export default function AdminNumberDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const openedQrRef = useRef(false);
  const [number, setNumber] = useState(null);
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [balanceMode, setBalanceMode] = useState('add');
  const [balanceInput, setBalanceInput] = useState('');
  const [qr, setQr] = useState(null);

  const load = useCallback(async () => {
    const { data } = await getAdminNumber(id);
    setNumber(data.number || null);
    setUsers(data.users || []);
    setPlans(data.plans || []);
    return data.number || null;
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to load number');
        if (!cancelled) setNumber(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    if (!['initializing', 'qr_ready'].includes(number?.status)) return;
    const timer = setInterval(() => { load().catch(() => {}); }, 3000);
    return () => clearInterval(timer);
  }, [number?.status, load]);

  const handlePlan = async (planId) => {
    setBusy('plan');
    try {
      const { data } = await assignAdminNumberPlan(id, {
        planId,
        refillBalance: Boolean(planId)
      });
      toast.success(data.message || 'Plan updated');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign plan');
    } finally {
      setBusy('');
    }
  };

  const handleAssign = async (userId) => {
    if (!userId) return;
    setBusy('assign');
    try {
      const { data } = await assignAdminNumberUser(id, userId);
      toast.success(data.message || 'Client added');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign client');
    } finally {
      setBusy('');
    }
  };

  const handleRemoveUser = async (userId) => {
    setBusy(`remove-${userId}`);
    try {
      const { data } = await assignAdminNumberUser(id, userId, 'remove');
      toast.success(data.message || 'Client removed');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove client');
    } finally {
      setBusy('');
    }
  };

  const handleBalance = async () => {
    const val = parseInt(balanceInput, 10);
    if (Number.isNaN(val) || val < 0) {
      toast.error('Enter a valid number');
      return;
    }
    setBusy('balance');
    try {
      const payload = balanceMode === 'set' ? { balance: val } : { amount: val };
      const { data } = await updateAdminNumberBalance(id, payload);
      toast.success(data.message || 'Balance updated');
      setBalanceInput('');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update balance');
    } finally {
      setBusy('');
    }
  };

  const handleShareQr = async () => {
    setBusy('qr');
    try {
      if (['disconnected', 'auth_failure'].includes(number.status)) {
        await connectAdminClient(id);
        setNumber((prev) => (prev ? { ...prev, status: 'initializing' } : prev));
      }
      const { data } = await getAdminClientQrShareLink(id);
      if (data.qrCode) setQr({ name: number.name, qr: data.qrCode });
      if (data.pageUrl) {
        window.open(data.pageUrl, '_blank', 'noopener,noreferrer');
        toast.success('Opened the QR scan page');
      }
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to open QR page');
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    if (!number || openedQrRef.current || !location.state?.openQr) return;
    openedQrRef.current = true;
    handleShareQr();
  }, [number, location.state, handleShareQr]);

  const handleCopy = async (label, value) => {
    if (!value) return;
    try {
      await copyText(value);
      toast.success(`${label} copied`);
    } catch (_) {
      window.prompt(`Copy ${label}:`, value);
    }
  };

  if (loading) {
    return <div style={{ color: '#64748b' }}>Loading number details...</div>;
  }

  if (!number) {
    return (
      <div>
        <Link to="/admin/numbers" style={backLink}>Back to phone numbers</Link>
        <h2 style={{ margin: '12px 0 8px', color: '#0f172a' }}>Number not found</h2>
        <p style={{ color: '#64748b' }}>This phone number may have been removed.</p>
      </div>
    );
  }

  const status = statusMeta(number.status);
  const assigned = number.assignedUsers || [];
  const assignedIds = new Set(assigned.map((item) => item._id));
  const available = users.filter((user) => !assignedIds.has(user._id));

  return (
    <div style={{ maxWidth: 980 }}>
      <Link to="/admin/numbers" style={backLink}>Back to phone numbers</Link>

      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', margin: '12px 0 24px' }}>
        <div>
          <h2 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 28 }}>{number.name}</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...badge, color: status.color, background: status.bg }}>{status.label}</span>
            <span style={{ color: '#475569', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {formatPhone(number.phone)}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {number.status === 'qr_ready' && number.qrCode ? (
            <button type="button" onClick={() => setQr({ name: number.name, qr: number.qrCode })} style={secondaryBtn}>
              Show QR
            </button>
          ) : null}
          <button type="button" onClick={handleShareQr} disabled={busy === 'qr'} style={primaryBtn}>
            {busy === 'qr' ? 'Opening...' : 'Share QR'}
          </button>
        </div>
      </header>

      <div style={grid}>
        <section style={card}>
          <h3 style={heading}>Connection</h3>
          <p style={hint}>Scan this number before assigning it to clients. The real WhatsApp phone fills in after a successful scan.</p>
          <dl style={metaList}>
            <div style={metaRow}>
              <dt style={dt}>WhatsApp number</dt>
              <dd style={dd}>{formatPhone(number.phone)}</dd>
            </div>
            <div style={metaRow}>
              <dt style={dt}>Last connected</dt>
              <dd style={dd}>{formatDate(number.lastConnected)}</dd>
            </div>
            <div style={metaRow}>
              <dt style={dt}>Created</dt>
              <dd style={dd}>{formatDate(number.createdAt)}</dd>
            </div>
          </dl>
          <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
            <CopyRow label="Client ID" value={number._id} help="Laravel WHATSAPP_NODE_CLIENT_ID" onCopy={handleCopy} />
            <CopyRow label="Session ID" value={number.clientId} help="Internal WhatsApp session" onCopy={handleCopy} />
          </div>
        </section>

        <section style={card}>
          <h3 style={heading}>Plan and balance</h3>
          <p style={hint}>Mini / Medium / Max live on this number. Every assigned client shares this remaining balance.</p>
          <label htmlFor="number-plan" style={labelStyle}>Plan</label>
          <select
            id="number-plan"
            value={number.planId || ''}
            onChange={(e) => handlePlan(e.target.value)}
            disabled={busy === 'plan'}
            style={selectStyle}
          >
            <option value="">No plan</option>
            {plans.map((plan) => (
              <option key={plan._id} value={plan._id}>
                {plan.name} · {plan.messageQuota} msg
              </option>
            ))}
          </select>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#0f766e', margin: '20px 0 12px' }}>
            {number.messageBalance ?? 0}
            <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginLeft: 8 }}>messages left</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button type="button" onClick={() => setBalanceMode('add')} style={balanceMode === 'add' ? tabOn : tabOff}>
              Add amount
            </button>
            <button type="button" onClick={() => setBalanceMode('set')} style={balanceMode === 'set' ? tabOn : tabOff}>
              Set exact
            </button>
          </div>
          <label htmlFor="balance-input" style={labelStyle}>
            {balanceMode === 'set' ? 'New balance' : 'Amount to add'}
          </label>
          <input
            id="balance-input"
            type="number"
            min="0"
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBalance()}
            style={inputStyle}
          />
          {balanceMode === 'add' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {[100, 500, 1000, 5000].map((amt) => (
                <button key={amt} type="button" onClick={() => setBalanceInput(String(amt))} style={chipBtn}>
                  +{amt.toLocaleString()}
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={handleBalance} disabled={busy === 'balance'} style={{ ...primaryBtn, marginTop: 12, width: '100%' }}>
            {busy === 'balance' ? 'Saving...' : (balanceMode === 'set' ? 'Set balance' : 'Add balance')}
          </button>
        </section>
      </div>

      <section style={card}>
        <h3 style={heading}>Assigned clients</h3>
        <p style={hint}>One WhatsApp line can be used by more than one client. Removing a client does not disconnect the phone.</p>
        {assigned.length ? (
          <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
            {assigned.map((item) => (
              <div key={item._id} style={clientRow}>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{item.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveUser(item._id)}
                  disabled={busy === `remove-${item._id}`}
                  style={secondaryBtn}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ ...hint, marginBottom: 16 }}>Not assigned to any client yet.</p>
        )}
        <label htmlFor="assign-client" style={labelStyle}>Add client</label>
        {available.length ? (
          <select
            id="assign-client"
            value=""
            onChange={(e) => handleAssign(e.target.value)}
            disabled={busy === 'assign'}
            style={selectStyle}
          >
            <option value="">{assigned.length ? 'Add another client...' : 'Assign to a client...'}</option>
            {available.map((user) => (
              <option key={user._id} value={user._id}>
                {user.name} · {user.email}
              </option>
            ))}
          </select>
        ) : (
          <p style={hint}>Every client already has this number, or no clients exist yet.</p>
        )}
      </section>

      {qr ? (
        <div style={overlay} onClick={() => setQr(null)} role="presentation">
          <div style={qrCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="qr-title">
            <h3 id="qr-title" style={{ margin: '0 0 8px', color: '#0f172a' }}>Scan WhatsApp QR</h3>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              {qr.name}. Open WhatsApp → Linked devices → Link a device.
            </p>
            <img src={qr.qr} alt="WhatsApp QR code" style={{ width: 280, height: 280, borderRadius: 8 }} />
            <div style={{ marginTop: 20 }}>
              <button type="button" onClick={() => setQr(null)} style={secondaryBtn}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CopyRow({ label, value, help, onCopy }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={labelStyle}>{label}</span>
        {help ? <span style={{ fontSize: 12, color: '#64748b' }}>{help}</span> : null}
      </div>
      <div style={copyBox}>
        <code style={codeStyle}>{value || '—'}</code>
        <button
          type="button"
          onClick={() => onCopy(label, value)}
          disabled={!value}
          aria-label={`Copy ${label}`}
          style={copyBtn}
        >
          Copy
        </button>
      </div>
    </div>
  );
}

const backLink = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  color: '#0f766e',
  fontWeight: 600,
  textDecoration: 'none'
};
const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 16,
  marginBottom: 16
};
const card = {
  background: '#fff',
  borderRadius: 16,
  padding: 24,
  marginBottom: 16,
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(15,23,42,0.06)'
};
const heading = { margin: '0 0 8px', fontSize: 16, color: '#0f172a' };
const hint = { margin: '0 0 16px', fontSize: 13, color: '#64748b', lineHeight: 1.5 };
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 };
const inputStyle = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  boxSizing: 'border-box'
};
const selectStyle = { ...inputStyle, background: '#fff' };
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
const secondaryBtn = {
  minHeight: 44,
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
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
const metaList = { margin: 0 };
const metaRow = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' };
const dt = { color: '#64748b', fontSize: 13 };
const dd = { margin: 0, color: '#0f172a', fontWeight: 600, fontSize: 13, textAlign: 'right' };
const copyBox = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  background: '#0f172a',
  borderRadius: 10,
  padding: 8
};
const codeStyle = {
  flex: 1,
  color: '#e2e8f0',
  fontSize: 12,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  padding: '0 8px'
};
const copyBtn = {
  minHeight: 44,
  padding: '8px 12px',
  borderRadius: 8,
  border: 'none',
  background: '#1e293b',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600
};
const clientRow = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  padding: 12,
  border: '1px solid #e2e8f0',
  borderRadius: 12
};
const tabOn = {
  minHeight: 44,
  padding: '8px 12px',
  borderRadius: 8,
  border: 'none',
  background: '#0f172a',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600
};
const tabOff = {
  minHeight: 44,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer'
};
const chipBtn = {
  minHeight: 36,
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13
};
const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1100
};
const qrCard = {
  background: '#fff',
  borderRadius: 16,
  padding: 32,
  textAlign: 'center',
  maxWidth: 360
};
