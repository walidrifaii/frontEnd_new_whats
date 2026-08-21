import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getAdminUser,
  getAdminUserClients,
  getAdminNumbers,
  assignAdminNumberUser,
  connectAdminClient,
  getAdminClientQrShareLink
} from '../services/api';

export default function AdminWhatsAppPage() {
  const { userId } = useParams();
  const [account, setAccount] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState([]);
  const [assignId, setAssignId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [qr, setQr] = useState(null);
  const [qrDismissed, setQrDismissed] = useState(false);

  const load = useCallback(async () => {
    const { data } = await getAdminUserClients(userId);
    setClients(data.clients || []);
    setAccount((prev) => prev || {
      _id: data.userId,
      name: data.ownerName,
      email: data.ownerEmail
    });
    try {
      const poolRes = await getAdminNumbers();
      setPool((poolRes.data.numbers || []).filter((item) =>
        !(item.assignedUsers || []).some((assigned) => String(assigned._id) === String(userId))
      ));
    } catch (_) { /* assign list is optional */ }
    return data.clients || [];
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        try {
          const { data } = await getAdminUser(userId);
          if (!cancelled) {
            setAccount(data.user);
          }
        } catch (_) { /* clients payload still has owner name */ }
        await load();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to load WhatsApp clients');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, load]);

  useEffect(() => {
    const connecting = clients.some((c) => ['initializing', 'qr_ready'].includes(c.status));
    if (!connecting) return;
    const timer = setInterval(() => { load().catch(() => {}); }, 3000);
    return () => clearInterval(timer);
  }, [clients, load]);

  useEffect(() => {
    if (qr || qrDismissed) return;
    const ready = clients.find((c) => c.status === 'qr_ready' && c.qrCode);
    if (ready) setQr({ name: ready.name, qr: ready.qrCode });
  }, [clients, qr, qrDismissed]);

  const handleAssign = async () => {
    if (!assignId) {
      toast.error('Pick a number from the pool');
      return;
    }
    setAssigning(true);
    try {
      const { data } = await assignAdminNumberUser(assignId, userId);
      toast.success(data.message || 'Number assigned');
      setAssignId('');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign number');
    } finally {
      setAssigning(false);
    }
  };

  const handleShareQr = async (client) => {
    setBusyId(client._id);
    try {
      if (['disconnected', 'auth_failure'].includes(client.status)) {
        await connectAdminClient(client._id);
        setClients((prev) => prev.map((c) => (
          c._id === client._id ? { ...c, status: 'initializing' } : c
        )));
      }
      const { data } = await getAdminClientQrShareLink(client._id);
      if (data.qrCode) setQr({ name: client.name, qr: data.qrCode });
      if (data.pageUrl) {
        window.open(data.pageUrl, '_blank', 'noopener,noreferrer');
        toast.success('Opened the QR scan page');
      } else {
        toast.error('QR share link is not available');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to open QR page');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <Link to="/admin/users" style={backLink}>Back to clients</Link>
      <h2 style={{ margin: '12px 0 6px', color: '#0f172a', fontSize: 28 }}>WhatsApp / QR</h2>
      <p style={{ color: '#475569', fontSize: 15, margin: '0 0 24px', lineHeight: 1.5 }}>
        {account ? (
          <>Assigned numbers for <strong>{account.name}</strong> ({account.email}). Create new numbers on the Numbers page, then assign them here.</>
        ) : 'Assign a pool number and share the QR page to scan.'}
      </p>

      <section style={card}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <select value={assignId} onChange={(e) => setAssignId(e.target.value)} style={inputStyle}>
            <option value="">Assign a number...</option>
            {pool.map((item) => (
              <option key={item._id} value={item._id}>
                {item.phone ? `+${item.phone}` : item.name} · {item.status}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleAssign} disabled={assigning} style={primaryBtn}>
            {assigning ? 'Assigning...' : 'Assign number'}
          </button>
          <Link to="/admin/numbers" style={{ ...secondaryBtn, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            Open Numbers
          </Link>
        </div>
      </section>

      <section style={card}>
        {loading ? (
          <div style={{ color: '#64748b' }}>Loading clients...</div>
        ) : clients.length === 0 ? (
          <div style={{ color: '#64748b' }}>No WhatsApp assigned yet. Assign a pool number above.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {clients.map((client) => (
              <div key={client._id} style={clientRow}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{client.name}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    {client.phone ? `+${client.phone}` : 'Not connected'}
                    {' · '}{String(client.status || '').replace('_', ' ')}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontFamily: 'ui-monospace, monospace' }}>
                    {client._id}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {client.status === 'qr_ready' && client.qrCode ? (
                    <button type="button" onClick={() => setQr({ name: client.name, qr: client.qrCode })} style={secondaryBtn}>
                      Show QR
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleShareQr(client)}
                    disabled={busyId === client._id}
                    style={{ ...primaryBtn, opacity: busyId === client._id ? 0.7 : 1 }}
                  >
                    {busyId === client._id ? 'Opening...' : 'Share QR'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {qr ? (
        <div style={overlay} onClick={() => { setQr(null); setQrDismissed(true); }}>
          <div style={qrCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>Scan WhatsApp QR</h3>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
              {qr.name}. Open WhatsApp → Linked devices → Link a device.
            </p>
            <img src={qr.qr} alt="WhatsApp QR code" style={{ width: 280, height: 280, borderRadius: 8 }} />
            <div style={{ marginTop: 20 }}>
              <button type="button" onClick={() => { setQr(null); setQrDismissed(true); }} style={secondaryBtn}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
const clientRow = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 14,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  alignItems: 'center'
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
