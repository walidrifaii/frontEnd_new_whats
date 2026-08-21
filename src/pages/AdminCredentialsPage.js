import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getAdminUserCredentials, regenerateAdminUserToken } from '../services/api';

const CopyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M5 15V5h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12.5 9.5 17 19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.4M6.1 6.3C4 7.8 2.6 10 2 12c0 0 3.5 7 10 7 2 0 3.7-.5 5.2-1.3M9.9 5.2C10.6 5.1 11.3 5 12 5c6.5 0 10 7 10 7-.4 1-1 2-1.8 2.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const statusColor = (status) => {
  if (status === 'connected') return '#16a34a';
  if (status === 'qr_ready' || status === 'initializing') return '#d97706';
  return '#64748b';
};

const copyText = async (value) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  window.prompt('Copy this value:', value);
  return false;
};

function SecretField({ label, help, value, secret = false, mono = true }) {
  const [revealed, setRevealed] = useState(!secret);
  const [copied, setCopied] = useState(false);
  const display = revealed ? (value || '—') : '•'.repeat(Math.min(28, String(value || '').length || 12));

  const handleCopy = async () => {
    if (!value) return;
    try {
      const ok = await copyText(value);
      setCopied(true);
      toast.success(ok ? `${label} copied` : 'Copy the value from the prompt');
      setTimeout(() => setCopied(false), 1600);
    } catch (_) {
      window.prompt('Copy this value:', value);
    }
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{label}</label>
        {help ? <span style={{ fontSize: 12, color: '#64748b' }}>{help}</span> : null}
      </div>
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'stretch',
        background: '#0f172a',
        borderRadius: 12,
        padding: 8,
        border: '1px solid #1e293b'
      }}>
        <code
          style={{
            flex: 1,
            color: '#f8fafc',
            fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : 'inherit',
            fontSize: 13,
            lineHeight: 1.5,
            padding: '10px 12px',
            overflowWrap: 'anywhere',
            wordBreak: 'break-all'
          }}
        >
          {display}
        </code>
        {secret ? (
          <button
            type="button"
            aria-label={revealed ? 'Hide token' : 'Show token'}
            onClick={() => setRevealed((open) => !open)}
            style={iconBtn}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
            <span>{revealed ? 'Hide' : 'Show'}</span>
          </button>
        ) : null}
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={handleCopy}
          disabled={!value}
          style={{ ...iconBtn, background: copied ? '#16a34a' : '#22c55e', color: '#052e16' }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
}

export default function AdminCredentialsPage() {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: payload } = await getAdminUserCredentials(userId);
      setData(payload);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleRegenerate = async () => {
    if (!window.confirm('Create a new token? The old token will stop working on the other server until you update it.')) {
      return;
    }
    setRegenerating(true);
    try {
      const { data: payload } = await regenerateAdminUserToken(userId);
      setData(payload);
      toast.success(payload.message || 'New token created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to regenerate token');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyEnv = async () => {
    if (!data?.laravelEnv) return;
    try {
      await copyText(data.laravelEnv);
      setCopiedEnv(true);
      toast.success('Environment block copied');
      setTimeout(() => setCopiedEnv(false), 1600);
    } catch (_) {
      window.prompt('Copy this config:', data.laravelEnv);
    }
  };

  if (loading) {
    return <div style={{ color: '#64748b' }}>Loading credentials...</div>;
  }

  if (!data) {
    return (
      <div>
        <p style={{ color: '#64748b' }}>Could not load credentials for this account.</p>
        <Link to="/admin/users" style={backLink}>Back to clients</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <Link to="/admin/users" style={backLink}>Back to clients</Link>
      <h2 style={{ margin: '12px 0 6px', color: '#0f172a', fontSize: 28, lineHeight: 1.2 }}>
        Server credentials
      </h2>
      <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.5, margin: '0 0 24px' }}>
        Paste these values into the other app (Laravel <code>.env</code>) so it can send OTP through this WhatsApp account.
      </p>

      <section style={card}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Account</div>
        <div style={{ fontWeight: 700, fontSize: 18, color: '#0f172a' }}>{data.account.name}</div>
        <div style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>{data.account.email}</div>
        {data.sharesOwnerWhatsApp ? (
          <div style={{ marginTop: 10, fontSize: 13, color: '#166534', background: '#dcfce7', padding: '8px 12px', borderRadius: 8 }}>
            Token and Client ID are from the main owner ({data.owner?.email}). Source is optional — send it only if you want stats split by Laravel app.
          </div>
        ) : null}
        {data.source ? (
          <div style={{ marginTop: 8, fontSize: 13, color: '#1e293b' }}>
            Locked source: <strong>{data.source}</strong> (optional on send; used for stats)
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>
            WHATSAPP_NODE_SOURCE is optional. Billing uses the assigned number’s plan.
          </div>
        )}
      </section>

      <section style={card}>
        <h3 style={sectionTitle}>Connection</h3>
        <SecretField label="API URL" help="WHATSAPP_NODE_URL" value={data.apiBaseUrl} />
        <SecretField label="OTP endpoint" help="POST this URL" value={data.otpUrl} />
        <SecretField
          label="Token"
          help={data.sharesOwnerWhatsApp ? 'WHATSAPP_NODE_TOKEN · owner token' : 'WHATSAPP_NODE_TOKEN · keep private'}
          value={data.token}
          secret
        />
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          style={{
            minHeight: 44,
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid #fecaca',
            background: '#fff',
            color: '#b91c1c',
            fontWeight: 600,
            cursor: regenerating ? 'wait' : 'pointer',
            opacity: regenerating ? 0.7 : 1
          }}
        >
          {regenerating ? 'Creating new token...' : 'Regenerate token'}
        </button>
      </section>

      <section style={card}>
        <h3 style={sectionTitle}>WhatsApp client ID</h3>
        <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 16px', lineHeight: 1.5 }}>
          Use the connected owner client ID as <strong>WHATSAPP_NODE_CLIENT_ID</strong>.
        </p>
        {data.clients.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 14 }}>
            No WhatsApp number assigned to this owner yet. Assign one from Numbers.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {data.clients.map((client) => (
              <div
                key={client._id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 14
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{client.name}</div>
                    <div style={{ fontSize: 13, color: statusColor(client.status), marginTop: 4 }}>
                      {String(client.status || '').replace('_', ' ')}
                      {client.phone ? ` · +${client.phone}` : ''}
                    </div>
                  </div>
                </div>
                <SecretField label="Client ID" help="WHATSAPP_NODE_CLIENT_ID" value={client._id} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>Ready-to-paste .env</h3>
          <button
            type="button"
            onClick={handleCopyEnv}
            style={{
              minHeight: 44,
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: copiedEnv ? '#16a34a' : '#0f172a',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {copiedEnv ? <CheckIcon /> : <CopyIcon />}
            {copiedEnv ? 'Copied block' : 'Copy .env block'}
          </button>
        </div>
        <pre style={{
          margin: 0,
          background: '#0f172a',
          color: '#bbf7d0',
          borderRadius: 12,
          padding: 16,
          fontSize: 13,
          lineHeight: 1.6,
          overflowX: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
        }}>
          {data.laravelEnv}
        </pre>
      </section>
    </div>
  );
}

const card = {
  background: '#fff',
  borderRadius: 16,
  padding: 24,
  marginBottom: 16,
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
  border: '1px solid #e2e8f0'
};

const sectionTitle = {
  margin: '0 0 16px',
  fontSize: 16,
  color: '#0f172a'
};

const backLink = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  color: '#0f766e',
  fontWeight: 600,
  textDecoration: 'none',
  fontSize: 14
};

const iconBtn = {
  minHeight: 44,
  minWidth: 88,
  padding: '8px 12px',
  border: 'none',
  borderRadius: 8,
  background: '#1e293b',
  color: '#f8fafc',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6
};
