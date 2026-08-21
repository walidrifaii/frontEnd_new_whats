import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  toggleUserActive,
  createServiceAccount,
  getAdminServiceAccounts,
  setUserSourceLock,
  setUserSourceSwitch,
  addUserSource,
  setUserSourceEnabled,
  setUserSourceNumber,
  deleteUserSource,
  getAdminNumbers,
  assignAdminNumberUser,
  updateAdminNumberBalance
} from '../services/api';

const fieldStyle = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 14,
  boxSizing: 'border-box'
};

export default function AdminUserDrawer({ user, onClose, onRefresh }) {
  const navigate = useNavigate();
  const [balanceMode, setBalanceMode] = useState('add');
  const [balanceInput, setBalanceInput] = useState('');
  const [savingBalance, setSavingBalance] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    email: '',
    password: '',
    source: '',
    messageBalance: '0'
  });
  const [savingService, setSavingService] = useState(false);
  const [subAccounts, setSubAccounts] = useState([]);
  const [poolNumbers, setPoolNumbers] = useState([]);
  const [assignId, setAssignId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [balanceNumberId, setBalanceNumberId] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newNumberId, setNewNumberId] = useState('');
  const [savingSource, setSavingSource] = useState(false);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!user || user.parentUserId) return;
    let cancelled = false;
    getAdminNumbers()
      .then(({ data }) => {
        if (cancelled) return;
        setPoolNumbers((data.numbers || []).filter((item) =>
          !(item.assignedUsers || []).some((assigned) => assigned._id === user._id)
        ));
        const first = (user.assignedNumbers || [])[0];
        setBalanceNumberId(first?._id || '');
        if (!newNumberId) {
          const assigned = (user.assignedNumbers || [])[0];
          setNewNumberId(assigned?._id || '');
        }
      })
      .catch(() => {});
    getAdminServiceAccounts(user._id)
      .then(({ data }) => {
        if (!cancelled) setSubAccounts(data.accounts || []);
      })
      .catch(() => {
        if (!cancelled) setSubAccounts([]);
      });
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;

  const isOwner = !user.parentUserId && user.role !== 'admin';
  const isService = Boolean(user.parentUserId);
  const sourceCatalog = user.sourceCatalog || [];
  const allowSwitch = Boolean(user.allowSourceSwitch);
  const numberOptions = [];
  const seenNumbers = new Set();
  [...(user.assignedNumbers || []), ...poolNumbers].forEach((item) => {
    if (!item?._id || seenNumbers.has(item._id)) return;
    seenNumbers.add(item._id);
    numberOptions.push(item);
  });
  const numberLabel = (item) => {
    if (!item) return 'No number';
    const phone = item.phone ? `+${item.phone}` : item.name || item._id;
    return `${phone}${item.status ? ` · ${item.status}` : ''}`;
  };

  const go = (path) => {
    onClose();
    navigate(path);
  };

  const handleBalance = async () => {
    const val = parseInt(balanceInput, 10);
    if (isNaN(val) || val < 0) {
      toast.error('Enter a valid number');
      return;
    }
    const numberId = balanceNumberId || (user.assignedNumbers || [])[0]?._id;
    if (!numberId) {
      toast.error('Assign a WhatsApp number first');
      return;
    }
    setSavingBalance(true);
    try {
      if (balanceMode === 'set') {
        await updateAdminNumberBalance(numberId, { balance: val });
        toast.success(`Number balance set to ${val}`);
      } else {
        await updateAdminNumberBalance(numberId, { amount: val });
        toast.success(`Added ${val} messages to this number`);
      }
      setBalanceInput('');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update balance');
    } finally {
      setSavingBalance(false);
    }
  };

  const handleAssignNumber = async () => {
    if (!assignId) {
      toast.error('Pick a number from the pool');
      return;
    }
    setAssigning(true);
    try {
      await assignAdminNumberUser(assignId, user._id);
      toast.success('Number assigned');
      setAssignId('');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign number');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignNumber = async (numberId) => {
    try {
      await assignAdminNumberUser(numberId, user._id, 'remove');
      toast.success('Number unassigned from this user');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to unassign');
    }
  };

  const handleToggle = async () => {
    try {
      await toggleUserActive(user._id);
      toast.success(user.isActive ? 'User disabled' : 'User enabled');
      onRefresh();
    } catch (err) {
      toast.error('Failed to update user');
    }
  };

  const handleCreateService = async () => {
    if (!serviceForm.name || !serviceForm.email || !serviceForm.password) {
      toast.error('Name, email, and password are required');
      return;
    }
    setSavingService(true);
    try {
      await createServiceAccount(user._id, {
        name: serviceForm.name,
        email: serviceForm.email,
        password: serviceForm.password
      });
      toast.success(`${serviceForm.email} can now sign in at /stats-login`);
      setServiceForm({ name: '', email: '', password: '', source: '', messageBalance: '0' });
      const { data } = await getAdminServiceAccounts(user._id);
      setSubAccounts(data.accounts || []);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create stats login');
    } finally {
      setSavingService(false);
    }
  };

  const handleLock = async (source) => {
    try {
      const { data } = await setUserSourceLock(user._id, source);
      toast.success(data.message || 'Source access updated');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update source lock');
    }
  };

  const handleAllowSwitch = async (allow) => {
    try {
      const { data } = await setUserSourceSwitch(user._id, allow);
      toast.success(data.message || (allow ? 'Switch allowed' : 'Switch blocked'));
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update switch');
    }
  };

  const handleAddSource = async (name) => {
    const source = String(name || newSource || '').trim().toLowerCase();
    if (!source) {
      toast.error('Enter a service name, for example ehkini or ehkini2');
      return;
    }
    if (!newNumberId) {
      toast.error('Pick a phone number for this service');
      return;
    }
    setSavingSource(true);
    try {
      const { data } = await addUserSource(user._id, {
        source,
        phoneNumberId: newNumberId,
        enabled: true
      });
      toast.success(data.message || `Added ${source}`);
      setNewSource('');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add service');
    } finally {
      setSavingSource(false);
    }
  };

  const handleToggleSource = async (source, enabled) => {
    try {
      const { data } = await setUserSourceEnabled(user._id, source, enabled);
      toast.success(data.message || 'Service updated');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update service');
    }
  };

  const handleChangeNumber = async (source, phoneNumberId) => {
    try {
      const { data } = await setUserSourceNumber(user._id, source, phoneNumberId);
      toast.success(data.message || 'Number updated');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change number');
    }
  };

  const handleRemoveSource = async (source) => {
    try {
      const { data } = await deleteUserSource(user._id, source);
      toast.success(data.message || 'Service removed');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove service');
    }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-drawer-title"
        onClick={(e) => e.stopPropagation()}
        style={panel}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <div id="user-drawer-title" style={{ fontWeight: 700, fontSize: 18, color: '#0f172a' }}>{user.name}</div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{user.email}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={ghostBtn}>Close</button>
        </div>

        {user.role !== 'admin' ? (
          <section style={section}>
            <h4 style={heading}>Pages</h4>
            <p style={hint}>Open a full screen for setup that needs more space.</p>
            <div style={{ display: 'grid', gap: 8 }}>
              <button type="button" onClick={() => go(`/admin/users/${user._id}/credentials`)} style={pageBtn}>
                Credentials
                <span style={pageMeta}>Token and Client ID</span>
              </button>
              {isOwner ? (
                <button type="button" onClick={() => go(`/admin/users/${user._id}/whatsapp`)} style={pageBtn}>
                  WhatsApp / QR
                  <span style={pageMeta}>Assigned numbers and scan</span>
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        <section style={section}>
          <h4 style={heading}>Quick actions</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button type="button" onClick={handleToggle} style={user.isActive ? dangerBtn : primaryBtn}>
              {user.isActive ? 'Disable account' : 'Enable account'}
            </button>
          </div>

          {isService ? (
            <div style={{ marginBottom: 16 }}>
              <div style={hint}>
                This is a stats sub-account. They sign in at /stats-login and use the WhatsApp client they belong to.
                {user.source
                  ? ` They are locked to ${user.source}.`
                  : ' They can switch this client’s services if you allowed switch on the owner.'}
              </div>
              {user.source ? (
                <button type="button" onClick={() => handleLock(null)} style={{ ...ghostBtn, marginTop: 8 }}>
                  Unlock so they can switch
                </button>
              ) : null}
            </div>
          ) : null}

          {isOwner ? (
            <div style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 10,
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}>
              <h4 style={{ ...heading, marginTop: 0 }}>Services</h4>
              <p style={hint}>
                These belong to this WhatsApp client. A stats sub-account (like walidrifaii@gmail.com) signs in at /stats-login and switches them if you allow switch. Add, remove, or turn each one on or off here.
              </p>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
                <button
                  type="button"
                  onClick={() => handleAllowSwitch(true)}
                  style={allowSwitch ? primaryBtn : ghostBtn}
                >
                  Allow switch
                </button>
                <button
                  type="button"
                  onClick={() => handleAllowSwitch(false)}
                  style={!allowSwitch ? dangerBtn : ghostBtn}
                >
                  Do not allow switch
                </button>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: allowSwitch ? '#166534' : '#9a3412', marginBottom: 12 }}>
                {allowSwitch ? 'Switch allowed' : 'Switch not allowed'}
              </div>

              {sourceCatalog.length ? (
                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  {sourceCatalog.map((item) => (
                    <div key={item.name} style={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '10px 12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong>{item.name}</strong>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleSource(item.name, true)}
                            style={item.enabled ? primaryBtn : ghostBtn}
                          >
                            Allowed
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleSource(item.name, false)}
                            style={!item.enabled ? dangerBtn : ghostBtn}
                          >
                            Not allowed
                          </button>
                          <button type="button" onClick={() => handleRemoveSource(item.name)} style={ghostBtn}>
                            Remove
                          </button>
                        </div>
                      </div>
                      <label style={{ ...hint, display: 'block', marginTop: 8 }}>WhatsApp number</label>
                      <select
                        value={item.phoneNumberId || ''}
                        onChange={(e) => handleChangeNumber(item.name, e.target.value)}
                        style={{ ...fieldStyle, marginTop: 4 }}
                      >
                        <option value="">Pick a number</option>
                        {numberOptions.map((number) => (
                          <option key={number._id} value={number._id}>{numberLabel(number)}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={hint}>No services yet. Add ehkini, pick its number, then add ehkini2.</p>
              )}

              <div style={{ display: 'grid', gap: 8 }}>
                <input
                  placeholder="service name (ehkini or ehkini2)"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  style={fieldStyle}
                />
                <select
                  value={newNumberId}
                  onChange={(e) => setNewNumberId(e.target.value)}
                  style={fieldStyle}
                >
                  <option value="">Pick a phone number</option>
                  {numberOptions.map((number) => (
                    <option key={number._id} value={number._id}>{numberLabel(number)}</option>
                  ))}
                </select>
                <button type="button" disabled={savingSource} onClick={() => handleAddSource()} style={primaryBtn}>
                  {savingSource ? 'Adding...' : 'Add service'}
                </button>
                {numberOptions.length === 0 ? (
                  <p style={hint}>Assign a phone number to this client first, then add services.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {isOwner ? (
            <>
          <h4 style={heading}>Assigned numbers</h4>
          {(user.assignedNumbers || []).length ? (
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              {(user.assignedNumbers || []).map((item) => (
                <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.phone || item.name || item._id}</div>
                    <div style={hint}>Balance {item.messageBalance ?? 0}</div>
                  </div>
                  <button type="button" onClick={() => handleUnassignNumber(item._id)} style={ghostBtn}>Unassign</button>
                </div>
              ))}
            </div>
          ) : (
            <p style={hint}>No number assigned yet.</p>
          )}
          {poolNumbers.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <select value={assignId} onChange={(e) => setAssignId(e.target.value)} style={fieldStyle}>
                <option value="">Assign a number...</option>
                {poolNumbers.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.phone ? `+${item.phone}` : item.name} · {item.status}
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleAssignNumber} disabled={assigning} style={primaryBtn}>
                {assigning ? 'Assigning...' : 'Assign number'}
              </button>
            </div>
          ) : (
            <p style={hint}>No more numbers to assign. Create another on the Numbers page, or this user already has every number.</p>
          )}
            </>
          ) : null}

          <h4 style={heading}>Message balance</h4>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0f766e', margin: '0 0 12px' }}>{user.messageBalance}</div>
          {(user.assignedNumbers || []).length > 1 ? (
            <select
              value={balanceNumberId}
              onChange={(e) => setBalanceNumberId(e.target.value)}
              style={{ ...fieldStyle, marginBottom: 10 }}
            >
              {(user.assignedNumbers || []).map((item) => (
                <option key={item._id} value={item._id}>
                  {item.phone || item.name} · {item.messageBalance ?? 0} left
                </option>
              ))}
            </select>
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setBalanceMode('set')}
              style={balanceMode === 'set' ? tabOn : tabOff}
            >
              Set exact
            </button>
            <button
              type="button"
              onClick={() => setBalanceMode('add')}
              style={balanceMode === 'add' ? tabOn : tabOff}
            >
              Add amount
            </button>
          </div>
          <input
            type="number"
            min="0"
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            placeholder={balanceMode === 'set' ? 'New balance' : 'Amount to add'}
            style={fieldStyle}
            onKeyDown={(e) => e.key === 'Enter' && handleBalance()}
          />
          {balanceMode === 'add' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {[100, 500, 1000, 5000].map((amt) => (
                <button key={amt} type="button" onClick={() => setBalanceInput(String(amt))} style={chipBtn}>
                  +{amt.toLocaleString()}
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={handleBalance} disabled={savingBalance} style={{ ...primaryBtn, marginTop: 12, width: '100%' }}>
            {savingBalance ? 'Saving...' : (balanceMode === 'set' ? 'Set balance' : 'Add balance')}
          </button>
        </section>

        {isOwner ? (
          <section style={section}>
            <h4 style={heading}>Stats sub-accounts</h4>
            <p style={hint}>
              Create an email that signs in at /stats-login. That person uses this WhatsApp client and can switch the services above when switch is allowed.
            </p>
            {subAccounts.length ? (
              <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                {subAccounts.map((item) => (
                  <div key={item._id} style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '10px 12px'
                  }}>
                    <div style={{ fontWeight: 600 }}>{item.email}</div>
                    <div style={hint}>
                      {item.name} · /stats-login · {item.isActive ? 'Active' : 'Disabled'}
                      {item.source ? ` · locked to ${item.source}` : ' · can switch'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={hint}>No stats login yet. Add one below, for example walidrifaii@gmail.com.</p>
            )}
            <div style={{ display: 'grid', gap: 10 }}>
              <input placeholder="Display name" value={serviceForm.name} onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))} style={fieldStyle} />
              <input type="email" placeholder="Login email" value={serviceForm.email} onChange={(e) => setServiceForm((p) => ({ ...p, email: e.target.value }))} style={fieldStyle} />
              <input type="password" placeholder="Password (min 6 characters)" value={serviceForm.password} onChange={(e) => setServiceForm((p) => ({ ...p, password: e.target.value }))} style={fieldStyle} />
              <button type="button" onClick={handleCreateService} disabled={savingService} style={primaryBtn}>
                {savingService ? 'Creating...' : 'Create stats login'}
              </button>
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.4)',
  zIndex: 1000,
  display: 'flex',
  justifyContent: 'flex-end'
};
const panel = {
  width: 'min(420px, 100vw)',
  height: '100%',
  background: '#fff',
  boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
  padding: 24,
  overflowY: 'auto'
};
const section = {
  marginTop: 24,
  paddingTop: 20,
  borderTop: '1px solid #e2e8f0'
};
const heading = { margin: '0 0 8px', fontSize: 14, color: '#0f172a' };
const hint = { margin: '0 0 12px', fontSize: 13, color: '#64748b', lineHeight: 1.5 };
const pageBtn = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  minHeight: 44,
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  cursor: 'pointer',
  textAlign: 'left',
  fontWeight: 700,
  color: '#0f172a'
};
const pageMeta = { fontWeight: 500, fontSize: 12, color: '#64748b' };
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
const dangerBtn = {
  minHeight: 44,
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#fef2f2',
  color: '#b91c1c',
  fontWeight: 600,
  cursor: 'pointer'
};
const ghostBtn = {
  minHeight: 44,
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 600
};
const tabOn = {
  minHeight: 40,
  padding: '8px 12px',
  borderRadius: 8,
  border: 'none',
  background: '#0f172a',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600
};
const tabOff = {
  minHeight: 40,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer'
};
const chipBtn = {
  minHeight: 36,
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13
};
