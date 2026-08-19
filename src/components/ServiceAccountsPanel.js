import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { createOwnerServiceAccount, getServiceAccounts } from '../services/api';

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #ddd',
  fontSize: 14,
  boxSizing: 'border-box'
};

export default function ServiceAccountsPanel() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    source: 'solv',
    messageBalance: '0'
  });

  const load = useCallback(async () => {
    try {
      const { data } = await getServiceAccounts();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createOwnerServiceAccount({
        name: form.name,
        email: form.email,
        password: form.password,
        source: form.source,
        messageBalance: parseInt(form.messageBalance, 10) || 0
      });
      toast.success(`Created ${form.source} login. They use /stats-login`);
      setForm({ name: '', email: '', password: '', source: 'solv', messageBalance: '0' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create service login');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 10,
      padding: 24,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      marginTop: 20
    }}>
      <h3 style={{ margin: '0 0 8px', color: '#333' }}>Service logins (same WhatsApp)</h3>
      <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px' }}>
        Add an email, password, and source (example: solv). That person signs in at
        {' '}<strong>/stats-login</strong> and only sees that source&apos;s messages.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          style={fieldStyle}
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          style={fieldStyle}
        />
        <input
          required
          type="password"
          minLength={6}
          placeholder="Password (min 6)"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          style={fieldStyle}
        />
        <input
          required
          placeholder="source (solv)"
          value={form.source}
          onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
          style={fieldStyle}
        />
        <input
          type="number"
          min="0"
          placeholder="Balance"
          value={form.messageBalance}
          onChange={(e) => setForm((p) => ({ ...p, messageBalance: e.target.value }))}
          style={fieldStyle}
        />
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderRadius: 8,
            background: '#16a34a',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: 42
          }}
        >
          {saving ? 'Saving...' : 'Add service login'}
        </button>
      </form>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['solv', 'ehkini'].map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setForm((p) => ({ ...p, source: name, name: name }))}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              border: '1px solid #ddd',
              background: form.source === name ? '#16a34a' : '#fff',
              color: form.source === name ? '#fff' : '#333',
              fontSize: 13
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#999', fontSize: 14 }}>Loading service logins...</div>
      ) : accounts.length === 0 ? (
        <div style={{ color: '#999', fontSize: 14 }}>No service logins yet. Add solv or ehkini above.</div>
      ) : (
        accounts.map((account) => (
          <div
            key={account._id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 0',
              borderTop: '1px solid #f0f0f0',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{account.name}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{account.email}</div>
            </div>
            <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>source: {account.source}</div>
            <div style={{ fontSize: 13, color: '#666' }}>balance: {account.messageBalance ?? 0}</div>
          </div>
        ))
      )}
    </div>
  );
}
