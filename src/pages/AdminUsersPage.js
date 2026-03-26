import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { getAdminUsers, updateUserBalance, addUserBalance, toggleUserActive } from '../services/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balanceModal, setBalanceModal] = useState(null);
  const [balanceInput, setBalanceInput] = useState('');
  const [balanceMode, setBalanceMode] = useState('set');
  const [search, setSearch] = useState('');

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

  const handleBalanceSubmit = async () => {
    const val = parseInt(balanceInput);
    if (isNaN(val) || val < 0) {
      toast.error('Enter a valid number');
      return;
    }
    try {
      if (balanceMode === 'set') {
        await updateUserBalance(balanceModal._id, val);
        toast.success(`Balance set to ${val}`);
      } else {
        await addUserBalance(balanceModal._id, val);
        toast.success(`Added ${val} messages`);
      }
      setBalanceModal(null);
      setBalanceInput('');
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update balance');
    }
  };

  const handleToggleActive = async (userId) => {
    try {
      await toggleUserActive(userId);
      toast.success('User status updated');
      loadUsers();
    } catch (err) {
      toast.error('Failed to update user');
    }
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div>Loading users...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>Manage Users</h2>
          <p style={{ color: '#666', margin: '4px 0 0', fontSize: 14 }}>{users.length} total users</p>
        </div>
        <input
          type="text" placeholder="Search users..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '10px 16px', borderRadius: 8, border: '1px solid #ddd',
            width: 260, fontSize: 14, outline: 'none'
          }}
        />
      </div>

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
              <th style={thStyle}>User</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Message Balance</th>
              <th style={thStyle}>Messages Sent</th>
              <th style={thStyle}>Clients</th>
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
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: user.role === 'admin' ? '#5856d622' : '#25d36622',
                    color: user.role === 'admin' ? '#5856d6' : '#25d366'
                  }}>
                    {user.role}
                  </span>
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
                  <div>{user.stats?.sentCount || 0} sent</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{user.stats?.failedCount || 0} failed</div>
                </td>
                <td style={tdStyle}>{user.clientCount || 0}</td>
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
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => { setBalanceModal(user); setBalanceMode('set'); setBalanceInput(String(user.messageBalance)); }}
                      style={btnStyle('#5856d6')}
                    >Set Balance</button>
                    <button
                      onClick={() => { setBalanceModal(user); setBalanceMode('add'); setBalanceInput(''); }}
                      style={btnStyle('#25d366')}
                    >+ Add</button>
                    <button
                      onClick={() => handleToggleActive(user._id)}
                      style={btnStyle(user.isActive ? '#ff3b30' : '#34c759')}
                    >{user.isActive ? 'Disable' : 'Enable'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>No users found</div>
        )}
      </div>

      {/* Balance Modal */}
      {balanceModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 32, minWidth: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ margin: '0 0 8px', color: '#1a1a2e' }}>
              {balanceMode === 'set' ? 'Set Message Balance' : 'Add Message Balance'}
            </h3>
            <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px' }}>
              User: <strong>{balanceModal.name}</strong> ({balanceModal.email})
            </p>
            <p style={{ color: '#666', fontSize: 14, margin: '0 0 16px' }}>
              Current balance: <strong style={{ color: '#5856d6', fontSize: 18 }}>{balanceModal.messageBalance}</strong>
            </p>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  onClick={() => setBalanceMode('set')}
                  style={{
                    ...tabBtn,
                    background: balanceMode === 'set' ? '#5856d6' : '#f0f0f0',
                    color: balanceMode === 'set' ? '#fff' : '#666'
                  }}
                >Set Exact</button>
                <button
                  onClick={() => setBalanceMode('add')}
                  style={{
                    ...tabBtn,
                    background: balanceMode === 'add' ? '#25d366' : '#f0f0f0',
                    color: balanceMode === 'add' ? '#fff' : '#666'
                  }}
                >Add Amount</button>
              </div>
              <input
                type="number" min="0" value={balanceInput}
                onChange={e => setBalanceInput(e.target.value)}
                placeholder={balanceMode === 'set' ? 'New balance...' : 'Amount to add...'}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8,
                  border: '1px solid #ddd', fontSize: 16, outline: 'none', boxSizing: 'border-box'
                }}
                onKeyDown={e => e.key === 'Enter' && handleBalanceSubmit()}
                autoFocus
              />
              {balanceMode === 'add' && balanceInput && (
                <p style={{ fontSize: 13, color: '#666', margin: '8px 0 0' }}>
                  New balance will be: <strong>{balanceModal.messageBalance + (parseInt(balanceInput) || 0)}</strong>
                </p>
              )}
            </div>

            {/* Quick add buttons */}
            {balanceMode === 'add' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {[100, 500, 1000, 5000, 10000].map(amt => (
                  <button key={amt} onClick={() => setBalanceInput(String(amt))}
                    style={{
                      padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd',
                      background: balanceInput === String(amt) ? '#25d366' : '#fff',
                      color: balanceInput === String(amt) ? '#fff' : '#333',
                      cursor: 'pointer', fontSize: 13, fontWeight: 500
                    }}
                  >+{amt.toLocaleString()}</button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => { setBalanceModal(null); setBalanceInput(''); }}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button onClick={handleBalanceSubmit}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: balanceMode === 'set' ? '#5856d6' : '#25d366',
                  color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600
                }}>
                {balanceMode === 'set' ? 'Set Balance' : 'Add Balance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: '#555', fontSize: 13 };
const tdStyle = { padding: '12px 16px', verticalAlign: 'middle' };
const tabBtn = {
  padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500
};
const btnStyle = (color) => ({
  padding: '5px 12px', borderRadius: 6, border: 'none',
  background: color + '18', color, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
});
