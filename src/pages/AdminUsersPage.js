import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { getAdminUsers, createAdminUser } from '../services/api';
import AdminUserDrawer from '../components/AdminUserDrawer';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [actionUserId, setActionUserId] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await getAdminUsers();
      setUsers(data.users);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast.error('Name, email, and password are required');
      return;
    }
    setCreating(true);
    try {
      await createAdminUser(createForm);
      toast.success('Client created. Assign a phone number from Phone numbers.');
      setCreateForm({ name: '', email: '', password: '' });
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const actionUser = users.find((u) => u._id === actionUserId) || null;

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const phoneMatch = (u.phones || []).some((item) =>
      String(item.phone || '').toLowerCase().includes(q)
    );
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      phoneMatch
    );
  });

  if (loading) return <div>Loading users...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>Clients</h2>
          <p style={{ color: '#666', margin: '4px 0 0', fontSize: 14 }}>{users.length} total clients</p>
        </div>
        <input
          type="text" placeholder="Search clients or phone..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '10px 16px', borderRadius: 8, border: '1px solid #ddd',
            width: 260, fontSize: 14, outline: 'none'
          }}
        />
      </div>

      <form onSubmit={handleCreateUser} style={{
        background: '#fff', borderRadius: 10, padding: 16, marginBottom: 16,
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        <strong style={{ marginRight: 8 }}>Add client</strong>
        <input
          placeholder="Name"
          value={createForm.name}
          onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', minWidth: 140 }}
        />
        <input
          type="email"
          placeholder="Email"
          value={createForm.email}
          onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', minWidth: 180 }}
        />
        <input
          type="password"
          placeholder="Password (min 6)"
          value={createForm.password}
          onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', minWidth: 160 }}
        />
        <button type="submit" disabled={creating} style={btnStyle('#0f766e')}>
          {creating ? 'Creating...' : 'Create client'}
        </button>
      </form>

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>Phone</th>
              <th style={thStyle}>Plan</th>
              <th style={thStyle}>Message Balance</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(user => (
              <tr key={user._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600 }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{user.email}</div>
                  {user.source ? (
                    <div style={{ fontSize: 12, color: '#d97706', marginTop: 4 }}>
                      locked source: {user.source}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: user.allowSourceSwitch ? '#16a34a' : '#64748b', marginTop: 4 }}>
                      {user.allowSourceSwitch ? 'switch allowed' : 'switch not allowed'}
                      {(user.sourceCatalog || []).length
                        ? ` · ${(user.sourceCatalog || []).map((item) => `${item.name}:${item.enabled ? 'on' : 'off'}`).join(', ')}`
                        : ' · no sources'}
                    </div>
                  )}
                  {user.parentUserId ? (
                    <div style={{ fontSize: 11, color: '#999' }}>Shares owner WhatsApp</div>
                  ) : null}
                  {user.isServiceAccount || user.parentUserId ? (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>service login</div>
                  ) : null}
                </td>
                <td style={tdStyle}>
                  {(user.phones || []).length ? (
                    <div style={{ display: 'grid', gap: 4 }}>
                      {user.phones.map((item) => (
                        <div key={item.phone} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                          <div style={{ fontWeight: 600 }}>{item.phone}</div>
                          <div style={{ fontSize: 11, color: item.status === 'connected' ? '#34c759' : '#999' }}>
                            {item.status === 'connected' ? 'Connected' : (item.name || item.status || '')}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: '#999' }}>—</span>
                  )}
                </td>
                <td style={tdStyle}>
                  {user.role === 'admin' ? (
                    <span style={{ color: '#999', fontSize: 12 }}>—</span>
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ fontSize: 13, color: '#334155' }}>
                        {user.plan?.name || 'No plan on assigned number'}
                      </div>
                      {user.parentUserId ? (
                        <div style={{ fontSize: 11, color: '#888' }}>Shares owner number</div>
                      ) : null}
                    </div>
                  )}
                </td>
                <td style={tdStyle}>
                  <span style={{
                    fontWeight: 700, fontSize: 18,
                    color: user.messageBalance > 50 ? '#34c759' : user.messageBalance > 10 ? '#ff9500' : '#ff3b30'
                  }}>
                    {user.messageBalance}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: user.isActive ? '#34c75922' : '#ff3b3022',
                    color: user.isActive ? '#34c759' : '#ff3b30'
                  }}>
                    {user.isActive ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td style={tdStyle}>
                  <button
                    type="button"
                    onClick={() => setActionUserId(user._id)}
                    style={{
                      minHeight: 44,
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#0f172a',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13
                    }}
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>No users found</div>
        )}
      </div>


      {actionUser ? (
        <AdminUserDrawer
          user={actionUser}
          onClose={() => setActionUserId(null)}
          onRefresh={loadUsers}
        />
      ) : null}
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: '#555', fontSize: 13 };
const tdStyle = { padding: '12px 16px', verticalAlign: 'middle' };
const btnStyle = (color) => ({
  padding: '5px 12px', borderRadius: 6, border: 'none',
  background: color + '18', color, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
});
