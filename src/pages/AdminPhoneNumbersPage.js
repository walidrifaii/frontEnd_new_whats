import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  getAdminUsers,
  getAdminPhoneNumbers,
  addAdminUserSource,
  createAdminPhoneNumber,
  connectAdminClient,
  getAdminClientQrShareLink
} from '../services/api';

const emptyNumberForm = { userId: '', source: '', newSource: '' };

export default function AdminPhoneNumbersPage() {
  const [owners, setOwners] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [numberForm, setNumberForm] = useState(emptyNumberForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [qr, setQr] = useState(null);

  const load = useCallback(async () => {
    const [{ data: userData }, { data: phoneData }] = await Promise.all([
      getAdminUsers(),
      getAdminPhoneNumbers()
    ]);
    setOwners((userData.users || []).filter((user) => (
      user.role !== 'admin' && !user.parentUserId && !user.isServiceAccount
    )));
    setClients(phoneData.clients || []);
    return phoneData.clients || [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (err) {
        if (!cancelled) toast.error(err.response?.data?.error || 'Failed to load phone numbers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    const connecting = clients.some((client) => ['initializing', 'qr_ready'].includes(client.status));
    if (!connecting) return;
    const timer = setInterval(() => { load().catch(() => {}); }, 4000);
    return () => clearInterval(timer);
  }, [clients, load]);

  const selectedOwner = owners.find((owner) => owner._id === numberForm.userId) || null;
  const selectedSources = selectedOwner?.enabledSources || selectedOwner?.sourceCatalog || [];

  const clientsByOwner = useMemo(() => {
    const map = {};
    clients.forEach((client) => {
      const key = client.userId;
      if (!map[key]) map[key] = [];
      map[key].push(client);
    });
    return map;
  }, [clients]);

  const filteredOwners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return owners;
    return owners.filter((owner) => {
      const ownerClients = clientsByOwner[owner._id] || [];
      return (
        owner.name?.toLowerCase().includes(q) ||
        owner.email?.toLowerCase().includes(q) ||
        (owner.enabledSources || []).some((source) => source.toLowerCase().includes(q)) ||
        ownerClients.some((client) => (
          client.name?.toLowerCase().includes(q) ||
          client.phone?.toLowerCase().includes(q) ||
          client.source?.toLowerCase().includes(q)
        ))
      );
    });
  }, [owners, search, clientsByOwner]);

  const resolveSource = () => {
    if (numberForm.source === '__new') return String(numberForm.newSource || '').trim().toLowerCase();
    return String(numberForm.source || '').trim().toLowerCase();
  };

  const startScan = async (userId, source, clientName) => {
    const { data } = await createAdminPhoneNumber({
      userId,
      source,
      clientName: clientName || source
    });
    toast.success(data.message || `Number assigned to ${source}`);
    await load();
    if (data.qrShare?.pageUrl) {
      window.open(data.qrShare.pageUrl, '_blank', 'noopener,noreferrer');
    }
    if (data.client?._id) {
      const share = await getAdminClientQrShareLink(data.client._id);
      if (share.data?.qrCode) setQr({ name: `${source} · ${data.client.name}`, qr: share.data.qrCode });
    }
    return data;
  };

  const handleAssignNumber = async (event) => {
    event.preventDefault();
    const source = resolveSource();
    if (!numberForm.userId) {
      toast.error('Select a main service');
      return;
    }
    if (!source) {
      toast.error('Select or type a source/client to assign this number');
      return;
    }
    setSaving(true);
    try {
      if (numberForm.source === '__new') {
        await addAdminUserSource(numberForm.userId, source);
      }
      await startScan(numberForm.userId, source);
      setNumberForm((prev) => ({ ...prev, source: source, newSource: '' }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign number');
    } finally {
      setSaving(false);
    }
  };

  const handleScanForSource = async (owner, source) => {
    setBusyId(`${owner._id}-${source}`);
    try {
      await startScan(owner._id, source);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start scan');
    } finally {
      setBusyId('');
    }
  };

  const handleShareQr = async (client) => {
    setBusyId(client._id);
    try {
      if (['disconnected', 'auth_failure'].includes(client.status)) {
        await connectAdminClient(client._id);
        setClients((prev) => prev.map((item) => (
          item._id === client._id ? { ...item, status: 'initializing' } : item
        )));
      }
      const { data } = await getAdminClientQrShareLink(client._id);
      if (data.qrCode) setQr({ name: `${client.source || client.name}`, qr: data.qrCode });
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>Manage Phone Numbers</h2>
          <p style={{ color: '#666', margin: '6px 0 0', fontSize: 14, lineHeight: 1.5 }}>
            Add a WhatsApp number and assign it to a source/client on a main service. Sending with that source uses this number.
          </p>
        </div>
        <input
          type="search"
          placeholder="Search user, source, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users and sources"
          style={searchStyle}
        />
      </div>

      <form onSubmit={handleAssignNumber} style={{ ...card, marginBottom: 24 }}>
        <h3 style={cardTitle}>Add number and assign to client</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={labelStyle}>
            Main service
            <select
              value={numberForm.userId}
              onChange={(e) => setNumberForm({ userId: e.target.value, source: '', newSource: '' })}
              style={inputStyle}
            >
              <option value="">Select a user</option>
              {owners.map((owner) => (
                <option key={owner._id} value={owner._id}>
                  {owner.name} ({owner.email})
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Source / client
            <select
              value={numberForm.source}
              onChange={(e) => setNumberForm({ ...numberForm, source: e.target.value })}
              disabled={!numberForm.userId}
              style={inputStyle}
            >
              <option value="">Select a source</option>
              {selectedSources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
              <option value="__new">Create new source</option>
            </select>
          </label>
          {numberForm.source === '__new' ? (
            <label style={labelStyle}>
              New source name
              <input
                value={numberForm.newSource}
                onChange={(e) => setNumberForm({ ...numberForm, newSource: e.target.value })}
                placeholder="e.g. amctag"
                style={inputStyle}
              />
            </label>
          ) : null}
          <button type="submit" disabled={saving} style={primaryBtn}>
            {saving ? 'Starting scan...' : 'Add number and scan'}
          </button>
        </div>
      </form>

      <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>
            Users, sources, and numbers ({filteredOwners.length})
          </h3>
        </div>
        {loading ? (
          <div style={{ padding: 24, color: '#64748b' }}>Loading...</div>
        ) : filteredOwners.length === 0 ? (
          <div style={{ padding: 24, color: '#64748b' }}>No main services yet.</div>
        ) : (
          filteredOwners.map((owner) => {
            const ownerClients = clientsByOwner[owner._id] || [];
            const sources = [...new Set([
              ...(owner.enabledSources || []),
              ...ownerClients.map((client) => client.source).filter(Boolean)
            ])];
            const unassigned = ownerClients.filter((client) => !client.source);
            return (
              <div key={owner._id} style={ownerRow}>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{owner.name}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{owner.email}</div>
                </div>
                <div style={{ flex: 1, minWidth: 280 }}>
                  {sources.length === 0 && unassigned.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>No sources or numbers yet</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {sources.map((source) => {
                        const assigned = ownerClients.find((client) => client.source === source);
                        return (
                          <div key={source} style={numberRow}>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f766e' }}>{source}</div>
                              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                                {assigned
                                  ? `${assigned.phone ? `+${String(assigned.phone).replace(/^\+/, '')}` : 'Scan to connect'} · ${String(assigned.status || '').replace('_', ' ')}`
                                  : 'No number assigned'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => (assigned ? handleShareQr(assigned) : handleScanForSource(owner, source))}
                              disabled={busyId === assigned?._id || busyId === `${owner._id}-${source}`}
                              style={assigned ? secondaryBtn : primaryBtn}
                            >
                              {busyId === assigned?._id || busyId === `${owner._id}-${source}`
                                ? 'Opening...'
                                : assigned ? 'Scan QR' : 'Add number'}
                            </button>
                          </div>
                        );
                      })}
                      {unassigned.map((client) => (
                        <div key={client._id} style={numberRow}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{client.name}</div>
                            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                              Not assigned to a source
                              {client.phone ? ` · +${String(client.phone).replace(/^\+/, '')}` : ''}
                            </div>
                          </div>
                          <button type="button" onClick={() => handleShareQr(client)} disabled={busyId === client._id} style={secondaryBtn}>
                            {busyId === client._id ? 'Opening...' : 'Scan QR'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
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
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(15,23,42,0.06)'
};
const cardTitle = { margin: '0 0 16px', fontSize: 16, color: '#0f172a' };
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#334155' };
const inputStyle = {
  display: 'block',
  width: '100%',
  minHeight: 44,
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #ddd',
  fontSize: 14,
  boxSizing: 'border-box'
};
const searchStyle = {
  minHeight: 44,
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #ddd',
  width: 280,
  fontSize: 14,
  outline: 'none'
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
const ownerRow = {
  display: 'flex',
  gap: 24,
  padding: 20,
  borderBottom: '1px solid #f0f0f0',
  flexWrap: 'wrap',
  alignItems: 'flex-start'
};
const numberRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '8px 10px'
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
