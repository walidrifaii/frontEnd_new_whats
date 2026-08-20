import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { getAdminUsers, assignUserPlan, updateUserSources } from '../services/api';
import AdminUserDrawer from '../components/AdminUserDrawer';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [plans, setPlans] = useState([]);
  const [planDrafts, setPlanDrafts] = useState({});
  const [actionUserId, setActionUserId] = useState(null);
  const [sourcesModal, setSourcesModal] = useState(null);
  const [sourceDraft, setSourceDraft] = useState([]);
  const [sourceList, setSourceList] = useState([]);
  const [removedSources, setRemovedSources] = useState([]);
  const [customSource, setCustomSource] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await getAdminUsers();
      setUsers(data.users);
      setPlans(data.plans || []);
      const drafts = {};
      (data.users || []).forEach((user) => {
        drafts[user._id] = user.planId || '';
      });
      setPlanDrafts(drafts);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleAssignPlan = async (user) => {
    const planId = planDrafts[user._id] || '';
    try {
      await assignUserPlan(user._id, planId ? { planId, refillBalance: true } : { planId: '', refillBalance: false });
      toast.success(planId ? 'Plan assigned and balance refilled' : 'Plan removed');
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign plan');
    }
  };

  const handleSaveSources = async () => {
    if (!sourcesModal) return;
    try {
      await updateUserSources(sourcesModal._id, sourceDraft, removedSources);
      toast.success('Sources updated');
      setSourcesModal(null);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update sources');
    }
  };

  const toggleSourceDraft = (name) => {
    setSourceDraft((prev) => (
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    ));
  };

  const deleteSourceDraft = (name) => {
    setSourceDraft((prev) => prev.filter((item) => item !== name));
    setSourceList((prev) => prev.filter((item) => item !== name));
    setRemovedSources((prev) => (prev.includes(name) ? prev : [...prev, name]));
  };

  const addCustomSource = () => {
    const name = String(customSource || '').trim().toLowerCase();
    if (!name) return;
    setSourceList((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setSourceDraft((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setRemovedSources((prev) => prev.filter((item) => item !== name));
    setCustomSource('');
  };

  const openSourcesModal = (user) => {
    setSourcesModal(user);
    setSourceDraft(user.enabledSources || []);
    setSourceList([...(user.sourceCatalog || user.enabledSources || [])].filter(Boolean));
    setRemovedSources([]);
    setCustomSource('');
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
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>Manage Users</h2>
          <p style={{ color: '#666', margin: '4px 0 0', fontSize: 14 }}>{users.length} total users</p>
        </div>
        <input
          type="text" placeholder="Search users or phone..." value={search}
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
                    <div style={{ fontSize: 12, color: '#25d366', marginTop: 4 }}>
                      locked source: {user.source}
                    </div>
                  ) : user.parentUserId ? (
                    <div style={{ fontSize: 12, color: '#007aff', marginTop: 4 }}>
                      can switch sources
                    </div>
                  ) : null}
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
                    <div style={{ display: 'grid', gap: 6, minWidth: 180 }}>
                      <select
                        value={planDrafts[user._id] || ''}
                        onChange={(e) => setPlanDrafts((p) => ({ ...p, [user._id]: e.target.value }))}
                        style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12 }}
                      >
                        <option value="">No plan</option>
                        {plans.map((plan) => (
                          <option key={plan._id} value={plan._id}>
                            {user.parentUserId
                              ? `${plan.name} · ${plan.messageQuota} msg`
                              : `${plan.name} · ${plan.messageQuota} msg · ${plan.sourceLimit} src`}
                          </option>
                        ))}
                      </select>
                      <div style={{ fontSize: 11, color: user.planStatus === 'pending' ? '#ff9500' : '#666' }}>
                        {user.planStatus === 'pending' ? 'Waiting for confirm' : (user.plan?.name || 'None')}
                        {!user.parentUserId && user.enabledSources?.length ? ` · ${user.enabledSources.join(', ')}` : ''}
                      </div>
                      {user.parentUserId ? (
                        <div style={{ fontSize: 11, color: '#888' }}>
                          Messages only. WhatsApp is on the owner.
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => handleAssignPlan(user)} style={btnStyle('#5856d6')}>
                          Apply plan
                        </button>
                        {!user.parentUserId ? (
                          <button
                            type="button"
                            onClick={() => openSourcesModal(user)}
                            style={btnStyle('#007aff')}
                          >
                            Sources
                          </button>
                        ) : null}
                      </div>
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
          onOpenSources={openSourcesModal}
        />
      ) : null}

      {sourcesModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 32, minWidth: 420, maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ margin: '0 0 8px', color: '#1a1a2e' }}>Enable sources</h3>
            <p style={{ color: '#666', fontSize: 14, margin: '0 0 16px' }}>
              For <strong>{sourcesModal.name}</strong>.
              {sourcesModal.plan
                ? ` ${sourcesModal.plan.name} allows ${sourcesModal.plan.sourceLimit} source(s).`
                : ' Assign a plan first if you want a source limit.'}
              {' '}Off sources stay on this list for you, but they are hidden from the user. Delete removes a source completely.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {sourceList.filter(Boolean).length === 0 ? (
                <span style={{ fontSize: 13, color: '#888' }}>No sources yet. Add the real name used in sends.</span>
              ) : null}
              {sourceList.filter(Boolean).map((name) => {
                const isOn = sourceDraft.includes(name);
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => toggleSourceDraft(name)}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        minHeight: 44,
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: '1px solid #ddd',
                        background: isOn ? '#25d366' : '#fff',
                        color: isOn ? '#fff' : '#333',
                        fontWeight: 600,
                        textAlign: 'left'
                      }}
                    >
                      {isOn ? `${name} on` : `${name} off`}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${name}`}
                      onClick={() => deleteSourceDraft(name)}
                      style={{
                        padding: '10px 14px',
                        minHeight: 44,
                        minWidth: 88,
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: '1px solid #f5c2c0',
                        background: '#fff5f5',
                        color: '#ff3b30',
                        fontWeight: 600
                      }}
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                placeholder="Add another source"
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomSource();
                  }
                }}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #ddd', fontSize: 14
                }}
              />
              <button
                type="button"
                onClick={addCustomSource}
                style={{
                  padding: '10px 14px',
                  minHeight: 44,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  background: '#fff',
                  cursor: 'pointer'
                }}
              >
                Add
              </button>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSourcesModal(null)}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSources}
                style={{
                  padding: '10px 24px', minHeight: 44, borderRadius: 8, border: 'none',
                  background: '#007aff', color: '#fff', cursor: 'pointer', fontWeight: 600
                }}
              >
                Save sources
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
const btnStyle = (color) => ({
  padding: '5px 12px', borderRadius: 6, border: 'none',
  background: color + '18', color, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
});
