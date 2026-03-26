import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  getClients,
  createClient,
  connectClient,
  disconnectClient,
  deleteClient,
  getClientQrShareLink
} from '../services/api';
import { useSocket } from '../utils/socket';

const STATUS_COLORS = {
  connected: '#25d366', disconnected: '#999', qr_ready: '#ff9500',
  initializing: '#007aff', auth_failure: '#ff3b30'
};

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [qrModal, setQrModal] = useState(null); // { clientId, qr }
  const [dismissedQrKeys, setDismissedQrKeys] = useState({});
  const [sharingClientId, setSharingClientId] = useState(null);
  const [shareDrawer, setShareDrawer] = useState(null); // { clientName, pageUrl, imageUrl }

  const getQrKey = (clientId, qr) => `${clientId}:${qr || ''}`;
  const isGatewayOrNetworkIssue = (err) => {
    const status = err?.response?.status;
    return !err?.response || [502, 503, 504].includes(status);
  };

  const load = useCallback(async () => {
    try {
      const { data } = await getClients();
      setClients(data.clients);
    } catch (e) {
      if (isGatewayOrNetworkIssue(e)) {
        toast.error('Backend is waking up. Try again in a few seconds.');
      } else {
        toast.error('Failed to load clients');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Keep status/QR in sync while any client is connecting.
  useEffect(() => {
    const hasConnectingClients = clients.some((c) =>
      ['initializing', 'qr_ready'].includes(c.status)
    );
    if (!hasConnectingClients) return;

    const timer = setInterval(() => {
      load();
    }, 3000);

    return () => clearInterval(timer);
  }, [clients, load]);

  // If QR is available from API (e.g. missed socket event), show it.
  useEffect(() => {
    if (qrModal) return;
    const qrClient = clients.find((c) => {
      if (!(c.status === 'qr_ready' && c.qrCode)) return false;
      const key = getQrKey(c.clientId, c.qrCode);
      return !dismissedQrKeys[key];
    });
    if (qrClient) {
      setQrModal({ clientId: qrClient.clientId, qr: qrClient.qrCode });
    }
  }, [clients, qrModal, dismissedQrKeys]);

  // Listen to socket events for all client IDs
  const allClientIds = clients.map(c => c.clientId);

  useSocket(allClientIds, {
    qr: ({ clientId, qr }) => {
      const key = getQrKey(clientId, qr);
      if (!dismissedQrKeys[key]) {
        setQrModal({ clientId, qr });
      }
      setClients(prev => prev.map(c => c.clientId === clientId ? { ...c, status: 'qr_ready', qrCode: qr } : c));
    },
    ready: ({ clientId }) => {
      toast.success('WhatsApp connected!');
      setQrModal(null);
      setDismissedQrKeys({});
      setClients(prev => prev.map(c => c.clientId === clientId ? { ...c, status: 'connected', qrCode: null } : c));
    },
    disconnected: ({ clientId }) => {
      setDismissedQrKeys({});
      setClients(prev => prev.map(c => c.clientId === clientId ? { ...c, status: 'disconnected' } : c));
    },
    auth_failure: ({ clientId }) => {
      toast.error('WhatsApp auth failed for client');
      setDismissedQrKeys({});
      setClients(prev => prev.map(c => c.clientId === clientId ? { ...c, status: 'auth_failure' } : c));
    },
    init_error: ({ clientId, message }) => {
      toast.error(message || 'WhatsApp initialization failed');
      setDismissedQrKeys({});
      setClients((prev) =>
        prev.map((c) =>
          c.clientId === clientId ? { ...c, status: 'disconnected', qrCode: null } : c
        )
      );
    },
    init_retry: ({ clientId, attempt, maxAttempts, retryInMs, reason }) => {
      const seconds = Math.max(1, Math.round((retryInMs || 0) / 1000));
      toast.info(
        `Connection retry ${attempt}/${maxAttempts} for ${clientId} in ${seconds}s` +
        (reason ? ` (${reason})` : '')
      );
      setClients((prev) =>
        prev.map((c) =>
          c.clientId === clientId ? { ...c, status: 'initializing', qrCode: null } : c
        )
      );
    }
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await createClient(newName.trim());
      setClients(prev => [data.client, ...prev]);
      setNewName('');
      toast.success('Client created!');
    } catch (err) {
      if (isGatewayOrNetworkIssue(err)) {
        toast.error('Backend is waking up. Wait a few seconds, then create again.');
      } else {
        toast.error(err.response?.data?.error || 'Failed to create client');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleConnect = async (client) => {
    try {
      await connectClient(client._id);
      toast.info('Initializing WhatsApp... Watch for QR code');
      setClients(prev => prev.map(c => c._id === client._id ? { ...c, status: 'initializing' } : c));
      setTimeout(() => load(), 2000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Connection failed');
    }
  };

  const handleDisconnect = async (client) => {
    try {
      await disconnectClient(client._id);
      setClients(prev => prev.map(c => c._id === client._id ? { ...c, status: 'disconnected' } : c));
      toast.success('Disconnected');
    } catch (err) {
      toast.error('Failed to disconnect');
    }
  };

  const handleDelete = async (client) => {
    if (!window.confirm('Delete this client?')) return;
    try {
      await deleteClient(client._id);
      setClients(prev => prev.filter(c => c._id !== client._id));
      toast.success('Client deleted');
    } catch (err) {
      toast.error('Failed to delete client');
    }
  };

  const copyText = async (text) => {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  };

  const handleShareQrLink = async (client) => {
    try {
      setSharingClientId(client._id);

      if (['disconnected', 'auth_failure'].includes(client.status)) {
        await connectClient(client._id);
        setClients((prev) =>
          prev.map((c) => (c._id === client._id ? { ...c, status: 'initializing' } : c))
        );
        toast.info('Starting WhatsApp for this client. QR link will update automatically.');
      } else if (client.status === 'connected') {
        toast.info('This client is already connected. No QR is available unless you reconnect it.');
      }

      const { data } = await getClientQrShareLink(client._id);
      const shareUrl = data?.pageUrl || data?.imageUrl;
      if (!shareUrl) {
        toast.error('QR share link is not available');
        return;
      }
      setShareDrawer({
        clientName: client.name,
        pageUrl: data?.pageUrl || '',
        imageUrl: data?.imageUrl || ''
      });
      toast.success('QR link generated successfully');

      try {
        const copied = await copyText(shareUrl);
        if (copied) {
          toast.success('QR share link copied');
        } else {
          window.prompt('Copy this QR link:', shareUrl);
        }
      } catch (_) {
        window.prompt('Copy this QR link:', shareUrl);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to get QR share link');
    } finally {
      setSharingClientId(null);
    }
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', color: '#1a1a2e' }}>📱 WhatsApp Clients</h2>

      {/* Create form */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: '0 0 16px' }}>Add New Client</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12 }}>
          <input
            value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Marketing Team, Sales Bot"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14 }}
          />
          <button type="submit" disabled={creating} style={btnGreen}>
            {creating ? 'Creating...' : '+ Add Client'}
          </button>
        </form>
      </div>

      {/* Client list */}
      {loading ? <div>Loading...</div> : (
        <div style={{ display: 'grid', gap: 16 }}>
          {clients.map(client => (
            <div key={client._id} style={{
              background: '#fff', borderRadius: 10, padding: '20px 24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderLeft: `4px solid ${STATUS_COLORS[client.status] || '#ccc'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{client.name}</div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                    {client.phone ? `📞 +${client.phone}` : 'Not connected'}
                    {' · '}
                    <span style={{ color: STATUS_COLORS[client.status] }}>●</span>
                    {' '}{client.status.replace('_', ' ')}
                    {' · '}{client.messagesSent || 0} messages sent
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => handleShareQrLink(client)}
                    disabled={sharingClientId === client._id}
                    style={{ ...btnBlue, padding: '8px 14px', opacity: sharingClientId === client._id ? 0.7 : 1 }}
                  >
                    {sharingClientId === client._id ? 'Generating...' : '🔗 Share QR Link'}
                  </button>
                  {client.status === 'qr_ready' && client.qrCode && (
                    <button onClick={() => setQrModal({ clientId: client.clientId, qr: client.qrCode })}
                      style={{ ...btnGreen, padding: '8px 16px' }}>
                      📷 Show QR
                    </button>
                  )}
                  {['disconnected', 'auth_failure'].includes(client.status) && (
                    <button onClick={() => handleConnect(client)} style={{ ...btnGreen, padding: '8px 16px' }}>
                      🔗 Connect
                    </button>
                  )}
                  {client.status === 'connected' && (
                    <button onClick={() => handleDisconnect(client)} style={{ ...btnYellow, padding: '8px 16px' }}>
                      Disconnect
                    </button>
                  )}
                  {client.status === 'initializing' && (
                    <span style={{ fontSize: 13, color: '#007aff' }}>⏳ Initializing...</span>
                  )}
                  <button onClick={() => handleDelete(client)} style={{ ...btnRed, padding: '8px 12px' }}>
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
          {clients.length === 0 && (
            <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
              No clients yet. Add one above to get started.
            </div>
          )}
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', maxWidth: 360 }}>
            <h3 style={{ margin: '0 0 8px' }}>📷 Scan QR Code</h3>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
              Open WhatsApp → Settings → Linked Devices → Link a Device
            </p>
            <img src={qrModal.qr} alt="QR Code" style={{ width: 280, height: 280, border: '1px solid #eee', borderRadius: 8 }} />
            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => {
                  const key = getQrKey(qrModal.clientId, qrModal.qr);
                  setDismissedQrKeys((prev) => ({ ...prev, [key]: true }));
                  setQrModal(null);
                }}
                style={btnGray}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Link Drawer */}
      {shareDrawer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 1200 }}>
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 'min(420px, 95vw)',
            height: '100%',
            background: '#fff',
            boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#1a1a2e' }}>QR Share Link</h3>
              <button onClick={() => setShareDrawer(null)} style={{ ...btnGray, padding: '6px 12px' }}>Close</button>
            </div>
            <div style={{ fontSize: 13, color: '#555' }}>
              Client: <strong>{shareDrawer.clientName}</strong>
            </div>
            <label style={{ fontSize: 13, color: '#444', fontWeight: 600 }}>QR Page Link</label>
            <textarea
              readOnly
              value={shareDrawer.pageUrl}
              style={{ width: '100%', minHeight: 90, border: '1px solid #ddd', borderRadius: 8, padding: 10, resize: 'vertical', fontSize: 12 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={async () => {
                  const ok = await copyText(shareDrawer.pageUrl);
                  if (ok) toast.success('Copied QR page link');
                  else window.prompt('Copy this QR link:', shareDrawer.pageUrl);
                }}
                style={{ ...btnBlue, padding: '10px 14px' }}
              >
                Copy QR Page Link
              </button>
            </div>

            <label style={{ fontSize: 13, color: '#444', fontWeight: 600 }}>QR Image Link (PNG)</label>
            <textarea
              readOnly
              value={shareDrawer.imageUrl}
              style={{ width: '100%', minHeight: 90, border: '1px solid #ddd', borderRadius: 8, padding: 10, resize: 'vertical', fontSize: 12 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={async () => {
                  const ok = await copyText(shareDrawer.imageUrl);
                  if (ok) toast.success('Copied QR image link');
                  else window.prompt('Copy this QR image link:', shareDrawer.imageUrl);
                }}
                style={{ ...btnBlue, padding: '10px 14px' }}
              >
                Copy QR Image Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnGreen = { background: '#25d366', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const btnBlue = { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const btnYellow = { background: '#ff9500', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const btnRed = { background: '#ff3b30', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 };
const btnGray = { background: '#666', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 24px', cursor: 'pointer', fontWeight: 600 };
