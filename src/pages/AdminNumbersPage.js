import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  getAdminNumbers,
  createAdminNumber,
  assignAdminNumberPlan,
  assignAdminNumberUser,
  connectAdminClient,
  getAdminClientQrShareLink
} from '../services/api';

export default function AdminNumbersPage() {
  const [numbers, setNumbers] = useState([]);
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [qr, setQr] = useState(null);

  const load = useCallback(async () => {
    const { data } = await getAdminNumbers();
    setNumbers(data.numbers || []);
    setUsers(data.users || []);
    setPlans(data.plans || []);
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
      await load();
      if (data.qrShare?.pageUrl) {
        window.open(data.qrShare.pageUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create number');
    } finally {
      setCreating(false);
    }
  };

  const handlePlan = async (number, planId) => {
    setBusyId(`${number._id}-plan`);
    try {
      const { data } = await assignAdminNumberPlan(number._id, {
        planId,
        refillBalance: Boolean(planId)
      });
      toast.success(data.message || 'Plan updated');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign plan');
    } finally {
      setBusyId('');
    }
  };

  const handleAssign = async (number, userId) => {
    setBusyId(`${number._id}-user`);
    try {
      const { data } = await assignAdminNumberUser(number._id, userId);
      toast.success(data.message || 'User added to this number');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign number');
    } finally {
      setBusyId('');
    }
  };

  const handleRemoveUser = async (number, userId) => {
    setBusyId(`${number._id}-user`);
    try {
      const { data } = await assignAdminNumberUser(number._id, userId, 'remove');
      toast.success(data.message || 'User removed');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove user');
    } finally {
      setBusyId('');
    }
  };

  const handleShareQr = async (number) => {
    setBusyId(`${number._id}-qr`);
    try {
      if (['disconnected', 'auth_failure'].includes(number.status)) {
        await connectAdminClient(number._id);
        setNumbers((prev) => prev.map((item) => (
          item._id === number._id ? { ...item, status: 'initializing' } : item
        )));
      }
      const { data } = await getAdminClientQrShareLink(number._id);
      if (data.qrCode) setQr({ name: number.name, qr: data.qrCode });
      if (data.pageUrl) {
        window.open(data.pageUrl, '_blank', 'noopener,noreferrer');
        toast.success('Opened the QR scan page');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to open QR page');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: 28 }}>Phone numbers</h2>
      <p style={{ color: '#475569', fontSize: 15, margin: '0 0 24px', lineHeight: 1.5 }}>
        Connect numbers here with no user. Apply Mini / Medium / Max to the number, then assign it to one or more users.
      </p>

      <section style={card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Add number to pool</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
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

      <section style={card}>
        {loading ? (
          <div style={{ color: '#64748b' }}>Loading numbers...</div>
        ) : numbers.length === 0 ? (
          <div style={{ color: '#64748b' }}>No numbers yet. Create one above and scan QR.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {numbers.map((number) => (
              <div key={number._id} style={row}>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{number.name}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    {number.phone ? `+${number.phone}` : 'Not connected'}
                    {' · '}{String(number.status || '').replace('_', ' ')}
                  </div>
                  <div style={{ fontSize: 12, color: '#0f766e', marginTop: 6, fontWeight: 600 }}>
                    Balance: {number.messageBalance ?? 0}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8, flex: 1, minWidth: 220 }}>
                  <select
                    value={number.planId || ''}
                    onChange={(e) => handlePlan(number, e.target.value)}
                    disabled={busyId === `${number._id}-plan`}
                    style={selectStyle}
                  >
                    <option value="">No plan</option>
                    {plans.map((plan) => (
                      <option key={plan._id} value={plan._id}>
                        {plan.name} · {plan.messageQuota} msg · {plan.sourceLimit} src
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const assigned = number.assignedUsers || [];
                    const assignedIds = new Set(assigned.map((item) => item._id));
                    const available = users.filter((user) => !assignedIds.has(user._id));
                    return (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {assigned.length ? (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {assigned.map((item) => (
                              <span key={item._id} style={chip}>
                                {item.name || item.email}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveUser(number, item._id)}
                                  disabled={busyId === `${number._id}-user`}
                                  style={chipX}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, color: '#64748b' }}>Not assigned to any user</span>
                        )}
                        {available.length ? (
                          <select
                            value=""
                            onChange={(e) => handleAssign(number, e.target.value)}
                            disabled={busyId === `${number._id}-user`}
                            style={selectStyle}
                          >
                            <option value="">{assigned.length ? 'Add another user...' : 'Assign to user...'}</option>
                            {available.map((user) => (
                              <option key={user._id} value={user._id}>
                                {user.name} · {user.email}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {number.status === 'qr_ready' && number.qrCode ? (
                    <button type="button" onClick={() => setQr({ name: number.name, qr: number.qrCode })} style={secondaryBtn}>
                      Show QR
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleShareQr(number)}
                    disabled={busyId === `${number._id}-qr`}
                    style={primaryBtn}
                  >
                    {busyId === `${number._id}-qr` ? 'Opening...' : 'Share QR'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {qr ? (
        <div style={overlay} onClick={() => setQr(null)}>
          <div style={qrCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>Scan WhatsApp QR</h3>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
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

const card = {
  background: '#fff',
  borderRadius: 16,
  padding: 24,
  marginBottom: 16,
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(15,23,42,0.06)'
};
const inputStyle = {
  flex: 1,
  minWidth: 200,
  minHeight: 44,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #ddd',
  fontSize: 14,
  boxSizing: 'border-box'
};
const selectStyle = {
  minHeight: 44,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #ddd',
  fontSize: 13
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
const secondaryBtn = {
  minHeight: 44,
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #ddd',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 600
};
const row = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 14,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  alignItems: 'flex-start'
};
const chip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: '#f1f5f9',
  borderRadius: 999,
  padding: '6px 8px 6px 12px',
  fontSize: 13,
  color: '#0f172a'
};
const chipX = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
  color: '#64748b',
  padding: '0 4px'
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
