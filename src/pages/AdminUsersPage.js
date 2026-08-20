import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getAdminUsers, updateUserBalance, addUserBalance, toggleUserActive, createServiceAccount, assignUserPlan, updateUserSources, setUserSourceLock, getAdminUserClients, createAdminUserClient, connectAdminClient, getAdminClientQrShareLink } from '../services/api';

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balanceModal, setBalanceModal] = useState(null);
  const [balanceInput, setBalanceInput] = useState('');
  const [balanceMode, setBalanceMode] = useState('set');
  const [search, setSearch] = useState('');
  const [serviceModal, setServiceModal] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    email: '',
    password: '',
    source: '',
    messageBalance: '0'
  });
  const [plans, setPlans] = useState([]);
  const [planDrafts, setPlanDrafts] = useState({});
  const [sourcesModal, setSourcesModal] = useState(null);
  const [sourceDraft, setSourceDraft] = useState([]);
  const [sourceList, setSourceList] = useState([]);
  const [removedSources, setRemovedSources] = useState([]);
  const [customSource, setCustomSource] = useState('');
  const [waModal, setWaModal] = useState(null);
  const [waClients, setWaClients] = useState([]);
  const [waLoading, setWaLoading] = useState(false);
  const [waName, setWaName] = useState('');
  const [waCreating, setWaCreating] = useState(false);
  const [waBusyId, setWaBusyId] = useState('');
  const [waQr, setWaQr] = useState(null);
  const [waQrDismissed, setWaQrDismissed] = useState(false);

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

  const loadWaClients = useCallback(async (userId) => {
    if (!userId) return;
    const { data } = await getAdminUserClients(userId);
    setWaClients(data.clients || []);
    return data.clients || [];
  }, []);

  const openWhatsAppModal = async (user) => {
    setWaModal(user);
    setWaName(user.name ? `${user.name} WhatsApp` : 'WhatsApp');
    setWaQr(null);
    setWaQrDismissed(false);
    setWaLoading(true);
    try {
      await loadWaClients(user._id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load WhatsApp clients');
    } finally {
      setWaLoading(false);
    }
  };

  useEffect(() => {
    if (!waModal) return;
    const connecting = waClients.some((c) => ['initializing', 'qr_ready'].includes(c.status));
    if (!connecting) return;
    const timer = setInterval(() => {
      loadWaClients(waModal._id).catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [waModal, waClients, loadWaClients]);

  useEffect(() => {
    if (!waModal || waQr || waQrDismissed) return;
    const ready = waClients.find((c) => c.status === 'qr_ready' && c.qrCode);
    if (ready) setWaQr({ name: ready.name, qr: ready.qrCode });
  }, [waModal, waClients, waQr, waQrDismissed]);

  const handleCreateWaClient = async () => {
    if (!waModal) return;
    const name = String(waName || '').trim();
    if (!name) {
      toast.error('Client name is required');
      return;
    }
    setWaCreating(true);
    try {
      const { data } = await createAdminUserClient(waModal._id, name);
      toast.success(data.message || 'WhatsApp client created');
      setWaName('');
      await loadWaClients(waModal._id);
      loadUsers();
      if (data.qrShare?.pageUrl) {
        window.open(data.qrShare.pageUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create WhatsApp client');
    } finally {
      setWaCreating(false);
    }
  };

  const handleShareQr = async (client) => {
    setWaBusyId(client._id);
    try {
      if (['disconnected', 'auth_failure'].includes(client.status)) {
        await connectAdminClient(client._id);
        setWaClients((prev) => prev.map((c) => (
          c._id === client._id ? { ...c, status: 'initializing' } : c
        )));
      }
      const { data } = await getAdminClientQrShareLink(client._id);
      if (data.qrCode) {
        setWaQr({ name: client.name, qr: data.qrCode });
      }
      if (data.pageUrl) {
        window.open(data.pageUrl, '_blank', 'noopener,noreferrer');
        toast.success('Opened the QR scan page');
      } else {
        toast.error('QR share link is not available');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to open QR page');
    } finally {
      setWaBusyId('');
    }
  };

  const handleSourceLock = async (user, source) => {
    try {
      const { data } = await setUserSourceLock(user._id, source);
      toast.success(data.message || 'Source access updated');
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update source lock');
    }
  };

  const handleCreateService = async () => {
    if (!serviceModal) return;
    const source = String(serviceForm.source || '').trim().toLowerCase();
    if (!serviceForm.name || !serviceForm.email || !serviceForm.password || !source) {
      toast.error('Name, email, password, and source are required');
      return;
    }
    try {
      await createServiceAccount(serviceModal._id, {
        name: serviceForm.name,
        email: serviceForm.email,
        password: serviceForm.password,
        source,
        messageBalance: parseInt(serviceForm.messageBalance, 10) || 0
      });
      toast.success(`Created ${source} login`);
      setServiceModal(null);
      setServiceForm({ name: '', email: '', password: '', source: '', messageBalance: '0' });
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create service login');
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
              <th style={thStyle}>Plan</th>
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
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: user.role === 'admin' ? '#5856d622' : '#25d36622',
                    color: user.role === 'admin' ? '#5856d6' : '#25d366'
                  }}>
                    {user.role}
                  </span>
                    {user.isServiceAccount || user.parentUserId ? (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>service login</div>
                  ) : null}
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
                    {user.role !== 'admin' ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/users/${user._id}/credentials`)}
                        style={btnStyle('#0f766e')}
                      >Credentials</button>
                    ) : null}
                    <button
                      onClick={() => handleToggleActive(user._id)}
                      style={btnStyle(user.isActive ? '#ff3b30' : '#34c759')}
                    >{user.isActive ? 'Disable' : 'Enable'}</button>
                    {!user.parentUserId && user.role !== 'admin' ? (
                      <button
                        type="button"
                        onClick={() => openWhatsAppModal(user)}
                        style={btnStyle('#128c7e')}
                      >WhatsApp / QR</button>
                    ) : null}
                    {!user.parentUserId && user.role !== 'admin' ? (
                      <button
                        onClick={() => {
                          setServiceModal(user);
                          setServiceForm({
                            name: '',
                            email: '',
                            password: '',
                            source: '',
                            messageBalance: '0'
                          });
                        }}
                        style={btnStyle('#007aff')}
                      >+ Service login</button>
                    ) : null}
                    {user.parentUserId ? (
                      user.source ? (
                        <button
                          type="button"
                          onClick={() => handleSourceLock(user, null)}
                          style={btnStyle('#007aff')}
                        >
                          Allow switch
                        </button>
                      ) : (user.enabledSources || []).length ? (
                        (user.enabledSources || []).map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => handleSourceLock(user, name)}
                            style={btnStyle('#5856d6')}
                          >
                            Lock {name}
                          </button>
                        ))
                      ) : (
                        <span style={{ fontSize: 12, color: '#888' }}>Enable sources on the owner first</span>
                      )
                    ) : null}
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

      {waModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 28, width: 'min(640px, 94vw)',
            maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ margin: '0 0 8px', color: '#1a1a2e' }}>WhatsApp client</h3>
            <p style={{ color: '#666', fontSize: 14, margin: '0 0 16px' }}>
              For <strong>{waModal.name}</strong>. Create a client, then use Share QR to open the scan page.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                placeholder="Client name, e.g. Main number"
                value={waName}
                onChange={(e) => setWaName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateWaClient();
                  }
                }}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #ddd', fontSize: 14, minHeight: 44, boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={handleCreateWaClient}
                disabled={waCreating}
                style={{
                  padding: '10px 16px', minHeight: 44, borderRadius: 8, border: 'none',
                  background: '#128c7e', color: '#fff', cursor: waCreating ? 'wait' : 'pointer',
                  fontWeight: 600, opacity: waCreating ? 0.7 : 1
                }}
              >
                {waCreating ? 'Creating...' : 'Create client'}
              </button>
            </div>
            {waLoading ? (
              <div style={{ color: '#888', fontSize: 14, padding: '12px 0' }}>Loading clients...</div>
            ) : waClients.length === 0 ? (
              <div style={{ color: '#888', fontSize: 14, padding: '12px 0' }}>
                No WhatsApp clients yet. Create one above.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                {waClients.map((client) => (
                  <div
                    key={client._id}
                    style={{
                      border: '1px solid #eee',
                      borderRadius: 10,
                      padding: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{client.name}</div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                        {client.phone ? `+${client.phone}` : 'Not connected'}
                        {' · '}{String(client.status || '').replace('_', ' ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {client.status === 'qr_ready' && client.qrCode ? (
                        <button
                          type="button"
                          onClick={() => setWaQr({ name: client.name, qr: client.qrCode })}
                          style={{
                            ...btnStyle('#25d366'),
                            minHeight: 44,
                            padding: '10px 14px'
                          }}
                        >
                          Show QR
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleShareQr(client)}
                        disabled={waBusyId === client._id}
                        style={{
                          ...btnStyle('#007aff'),
                          minHeight: 44,
                          padding: '10px 14px',
                          opacity: waBusyId === client._id ? 0.7 : 1
                        }}
                      >
                        {waBusyId === client._id ? 'Opening...' : 'Share QR'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setWaModal(null); setWaQr(null); }}
                style={{
                  padding: '10px 20px', minHeight: 44, borderRadius: 8,
                  border: '1px solid #ddd', background: '#fff', cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {waQr && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', maxWidth: 360
          }}>
            <h3 style={{ margin: '0 0 8px', color: '#1a1a2e' }}>Scan WhatsApp QR</h3>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>
              {waQr.name}. Open WhatsApp → Linked devices → Link a device.
            </p>
            <img
              src={waQr.qr}
              alt="WhatsApp QR code"
              style={{ width: 280, height: 280, border: '1px solid #eee', borderRadius: 8 }}
            />
            <div style={{ marginTop: 20 }}>
              <button
                type="button"
                onClick={() => { setWaQr(null); setWaQrDismissed(true); }}
                style={{
                  padding: '10px 24px', minHeight: 44, borderRadius: 8, border: 'none',
                  background: '#666', color: '#fff', cursor: 'pointer', fontWeight: 600
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

      {serviceModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 32, minWidth: 420, maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ margin: '0 0 8px', color: '#1a1a2e' }}>Add service login</h3>
            <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px' }}>
              For <strong>{serviceModal.name}</strong>. Use a real source name from this account
              (from sent messages or enabled sources). That login only sees that source on /stats.
            </p>
            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>
                Source
                <input
                  placeholder="Type the real source name"
                  value={serviceForm.source}
                  onChange={(e) => setServiceForm((p) => ({ ...p, source: e.target.value }))}
                  style={{
                    display: 'block', width: '100%', marginTop: 6, padding: '10px 12px',
                    borderRadius: 8, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box'
                  }}
                />
              </label>
              {(serviceModal.enabledSources || []).length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(serviceModal.enabledSources || []).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setServiceForm((p) => ({ ...p, source: name }))}
                      style={{
                        padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                        border: '1px solid #ddd',
                        background: serviceForm.source === name ? '#25d366' : '#fff',
                        color: serviceForm.source === name ? '#fff' : '#333'
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
                  No sources on this account yet. Type the name used when sending messages.
                </p>
              )}
              <input
                placeholder="Display name"
                value={serviceForm.name}
                onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box'
                }}
              />
              <input
                type="email"
                placeholder="Login email"
                value={serviceForm.email}
                onChange={(e) => setServiceForm((p) => ({ ...p, email: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box'
                }}
              />
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={serviceForm.password}
                onChange={(e) => setServiceForm((p) => ({ ...p, password: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box'
                }}
              />
              <input
                type="number"
                min="0"
                placeholder="Starting message balance"
                value={serviceForm.messageBalance}
                onChange={(e) => setServiceForm((p) => ({ ...p, messageBalance: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setServiceModal(null)}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateService}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: '#007aff', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600
                }}
              >
                Create login
              </button>
            </div>
          </div>
        </div>
      )}

      {sourcesModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
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
const tabBtn = {
  padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500
};
const btnStyle = (color) => ({
  padding: '5px 12px', borderRadius: 6, border: 'none',
  background: color + '18', color, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
});
