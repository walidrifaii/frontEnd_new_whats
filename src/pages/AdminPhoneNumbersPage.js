import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getAdminUsers,
  getAdminPhoneNumbers,
  addAdminUserSource,
  createAdminUserClient,
  connectAdminClient,
  getAdminClientQrShareLink
} from '../services/api';

const emptySourceForm = { userId: '', source: '' };

export default function AdminPhoneNumbersPage() {
  const [owners, setOwners] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceForm, setSourceForm] = useState(emptySourceForm);
  const [addingSource, setAddingSource] = useState(false);
  const [inlineSource, setInlineSource] = useState({});
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
          client.phone?.toLowerCase().includes(q)
        ))
      );
    });
  }, [owners, search, clientsByOwner]);

  const addSource = async (userId, source) => {
    const name = String(source || '').trim().toLowerCase();
    if (!userId) {
      toast.error('Select a main service');
      return false;
    }
    if (!name) {
      toast.error('Source name is required');
      return false;
    }
    const { data } = await addAdminUserSource(userId, name);
    toast.success(data.message || `Source ${name} assigned`);
    await load();
    return true;
  };

  const handleAddSource = async (event) => {
    event.preventDefault();
    setAddingSource(true);
    try {
      const ok = await addSource(sourceForm.userId, sourceForm.source);
      if (ok) setSourceForm(emptySourceForm);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add source');
    } finally {
      setAddingSource(false);
    }
  };

  const handleInlineAddSource = async (owner) => {
    const value = inlineSource[owner._id] || '';
    setBusyId(`source-${owner._id}`);
    try {
      const ok = await addSource(owner._id, value);
      if (ok) setInlineSource((prev) => ({ ...prev, [owner._id]: '' }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add source');
    } finally {
      setBusyId('');
    }
  };

  const handleScanNumber = async (owner) => {
    setBusyId(`scan-${owner._id}`);
    try {
      const clientName = `${owner.name} WhatsApp`;
      const { data } = await createAdminUserClient(owner._id, clientName);
      toast.success(data.message || 'Scan the QR to add this number');
      await load();
      if (data.qrShare?.pageUrl) {
        window.open(data.qrShare.pageUrl, '_blank', 'noopener,noreferrer');
      }
      const client = data.client;
      if (client?._id) {
        const share = await getAdminClientQrShareLink(client._id);
        if (share.data?.qrCode) setQr({ name: client.name, qr: share.data.qrCode });
      }
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>Manage Phone Numbers</h2>
          <p style={{ color: '#666', margin: '6px 0 0', fontSize: 14, lineHeight: 1.5 }}>
            Assign a source to each main service, then scan QR to add a WhatsApp number for that user.
          </p>
        </div>
        <input
          type="search"
          placeholder="Search user or source..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users and sources"
          style={searchStyle}
        />
      </div>

      <form onSubmit={handleAddSource} style={{ ...card, marginBottom: 24 }}>
        <h3 style={cardTitle}>Add source to main service</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'end' }}>
          <label style={labelStyle}>
            Main service
            <select
              value={sourceForm.userId}
              onChange={(e) => setSourceForm({ ...sourceForm, userId: e.target.value })}
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
            Source name
            <input
              value={sourceForm.source}
              onChange={(e) => setSourceForm({ ...sourceForm, source: e.target.value })}
              placeholder="e.g. amctag"
              style={inputStyle}
            />
          </label>
          <button type="submit" disabled={addingSource} style={primaryBtn}>
            {addingSource ? 'Adding...' : 'Add source'}
          </button>
        </div>
      </form>

      <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>
            Users and sources ({filteredOwners.length})
          </h3>
        </div>
        {loading ? (
          <div style={{ padding: 24, color: '#64748b' }}>Loading users...</div>
        ) : filteredOwners.length === 0 ? (
          <div style={{ padding: 24, color: '#64748b' }}>No main services yet.</div>
        ) : (
          <div>
            {filteredOwners.map((owner) => {
              const ownerClients = clientsByOwner[owner._id] || [];
              const sources = owner.enabledSources || [];
              return (
                <div key={owner._id} style={ownerRow}>
                  <div style={{ minWidth: 220 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{owner.name}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{owner.email}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      {owner.plan?.name || 'No plan'}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Sources</div>
                    {sources.length ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        {sources.map((source) => (
                          <span key={source} style={sourceChip}>{source}</span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 10 }}>No sources assigned</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        value={inlineSource[owner._id] || ''}
                        onChange={(e) => setInlineSource((prev) => ({ ...prev, [owner._id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleInlineAddSource(owner);
                          }
                        }}
                        placeholder="New source"
                        aria-label={`Add source for ${owner.name}`}
                        style={{ ...inputStyle, marginTop: 0, width: 160 }}
                      />
                      <button
                        type="button"
                        onClick={() => handleInlineAddSource(owner)}
                        disabled={busyId === `source-${owner._id}`}
                        style={secondaryBtn}
                      >
                        {busyId === `source-${owner._id}` ? 'Adding...' : 'Add source'}
                      </button>
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>WhatsApp numbers</div>
                    {ownerClients.length ? (
                      <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                        {ownerClients.map((client) => (
                          <div key={client._id} style={numberRow}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{client.name}</div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                {client.phone ? `+${String(client.phone).replace(/^\+/, '')}` : 'Scan to connect'}
                                {' · '}
                                {String(client.status || '').replace('_', ' ')}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleShareQr(client)}
                              disabled={busyId === client._id}
                              style={secondaryBtn}
                            >
                              {busyId === client._id ? 'Opening...' : 'Scan QR'}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 10 }}>No number yet</div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleScanNumber(owner)}
                        disabled={busyId === `scan-${owner._id}`}
                        style={primaryBtn}
                      >
                        {busyId === `scan-${owner._id}` ? 'Starting...' : 'Add number by scan'}
                      </button>
                      <Link to={`/admin/users/${owner._id}/whatsapp`} style={linkBtn}>
                        Open WhatsApp
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
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
const linkBtn = {
  ...secondaryBtn,
  display: 'inline-flex',
  alignItems: 'center',
  textDecoration: 'none',
  color: '#0f172a',
  boxSizing: 'border-box'
};
const ownerRow = {
  display: 'flex',
  gap: 24,
  padding: 20,
  borderBottom: '1px solid #f0f0f0',
  flexWrap: 'wrap',
  alignItems: 'flex-start'
};
const sourceChip = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 10px',
  borderRadius: 999,
  background: '#ecfdf5',
  color: '#0f766e',
  fontSize: 13,
  fontWeight: 700
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
