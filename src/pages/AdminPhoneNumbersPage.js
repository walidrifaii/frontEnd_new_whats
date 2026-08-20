import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getAdminUsers,
  getAdminPhoneNumbers,
  createAdminPhoneNumber,
  connectAdminClient,
  getAdminClientQrShareLink
} from '../services/api';

const emptyUserForm = {
  name: '',
  email: '',
  password: '',
  clientName: '',
  phone: ''
};

const emptyAddForm = {
  userId: '',
  clientName: '',
  phone: ''
};

export default function AdminPhoneNumbersPage() {
  const [clients, setClients] = useState([]);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [creatingUser, setCreatingUser] = useState(false);
  const [addingNumber, setAddingNumber] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [qr, setQr] = useState(null);

  const load = useCallback(async () => {
    const [{ data: phoneData }, { data: userData }] = await Promise.all([
      getAdminPhoneNumbers(),
      getAdminUsers()
    ]);
    setClients(phoneData.clients || []);
    setOwners((userData.users || []).filter((user) => (
      user.role !== 'admin' && !user.parentUserId && !user.isServiceAccount
    )));
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => (
      client.name?.toLowerCase().includes(q) ||
      client.phone?.toLowerCase().includes(q) ||
      client.ownerName?.toLowerCase().includes(q) ||
      client.ownerEmail?.toLowerCase().includes(q) ||
      client._id?.toLowerCase().includes(q)
    ));
  }, [clients, search]);

  const handleCreateUser = async (event) => {
    event.preventDefault();
    if (!userForm.name.trim() || !userForm.email.trim() || userForm.password.length < 6) {
      toast.error('Name, email, and a password of at least 6 characters are required');
      return;
    }
    if (!userForm.clientName.trim()) {
      toast.error('Phone / client name is required');
      return;
    }
    setCreatingUser(true);
    try {
      const { data } = await createAdminPhoneNumber(userForm);
      toast.success(data.message || 'User and phone number created');
      setUserForm(emptyUserForm);
      await load();
      if (data.qrShare?.pageUrl) {
        window.open(data.qrShare.pageUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleAddNumber = async (event) => {
    event.preventDefault();
    if (!addForm.userId) {
      toast.error('Select a client');
      return;
    }
    if (!addForm.clientName.trim()) {
      toast.error('Phone / client name is required');
      return;
    }
    setAddingNumber(true);
    try {
      const { data } = await createAdminPhoneNumber(addForm);
      toast.success(data.message || 'Phone number added');
      setAddForm(emptyAddForm);
      await load();
      if (data.qrShare?.pageUrl) {
        window.open(data.qrShare.pageUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add phone number');
    } finally {
      setAddingNumber(false);
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
            Create a client, attach a WhatsApp number, and see every connected client.
          </p>
        </div>
        <input
          type="search"
          placeholder="Search name, phone, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search phone numbers"
          style={searchStyle}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
        <form onSubmit={handleCreateUser} style={card}>
          <h3 style={cardTitle}>Create user and number</h3>
          <label style={labelStyle}>
            User name
            <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Email
            <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Password
            <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Phone / client name
            <input value={userForm.clientName} onChange={(e) => setUserForm({ ...userForm, clientName: e.target.value })} placeholder="e.g. Main WhatsApp" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Phone number (optional)
            <input value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} placeholder="e.g. 9665xxxxxxx" style={inputStyle} />
          </label>
          <button type="submit" disabled={creatingUser} style={primaryBtn}>
            {creatingUser ? 'Creating...' : 'Create user and add number'}
          </button>
        </form>

        <form onSubmit={handleAddNumber} style={card}>
          <h3 style={cardTitle}>Add number to existing client</h3>
          <label style={labelStyle}>
            Client
            <select
              value={addForm.userId}
              onChange={(e) => setAddForm({ ...addForm, userId: e.target.value })}
              style={inputStyle}
            >
              <option value="">Select a client</option>
              {owners.map((owner) => (
                <option key={owner._id} value={owner._id}>
                  {owner.name} ({owner.email})
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Phone / client name
            <input value={addForm.clientName} onChange={(e) => setAddForm({ ...addForm, clientName: e.target.value })} placeholder="e.g. Second number" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Phone number (optional)
            <input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} placeholder="e.g. 9665xxxxxxx" style={inputStyle} />
          </label>
          <button type="submit" disabled={addingNumber} style={primaryBtn}>
            {addingNumber ? 'Adding...' : 'Add phone number'}
          </button>
        </form>
      </div>

      <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>
            All clients ({filtered.length})
          </h3>
        </div>
        {loading ? (
          <div style={{ padding: 24, color: '#64748b' }}>Loading phone numbers...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, color: '#64748b' }}>No WhatsApp clients yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Owner</th>
                  <th style={thStyle}>Phone</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{client.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'ui-monospace, monospace', marginTop: 4 }}>
                        {client._id}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div>{client.ownerName || 'Unknown'}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{client.ownerEmail}</div>
                    </td>
                    <td style={tdStyle}>{client.phone ? `+${String(client.phone).replace(/^\+/, '')}` : 'Not connected'}</td>
                    <td style={tdStyle}>
                      <span style={statusBadge(client.status)}>
                        {String(client.status || 'unknown').replace('_', ' ')}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleShareQr(client)}
                          disabled={busyId === client._id}
                          style={secondaryBtn}
                        >
                          {busyId === client._id ? 'Opening...' : 'Share QR'}
                        </button>
                        <Link to={`/admin/users/${client.userId}/whatsapp`} style={linkBtn}>
                          Open WhatsApp
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

const statusBadge = (status) => ({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'capitalize',
  background: status === 'connected' ? '#dcfce7' : status === 'qr_ready' ? '#ffedd5' : '#f1f5f9',
  color: status === 'connected' ? '#166534' : status === 'qr_ready' ? '#9a3412' : '#475569'
});

const card = {
  background: '#fff',
  borderRadius: 16,
  padding: 24,
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(15,23,42,0.06)'
};
const cardTitle = { margin: '0 0 16px', fontSize: 16, color: '#0f172a' };
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 12 };
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
  width: '100%',
  marginTop: 8,
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
const thStyle = { textAlign: 'left', padding: '12px 16px', color: '#64748b', fontWeight: 700 };
const tdStyle = { padding: '14px 16px', verticalAlign: 'top' };
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
