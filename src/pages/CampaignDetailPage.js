import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getCampaign, startCampaign, pauseCampaign,
  getContacts, uploadContacts
} from '../services/api';
import { useSocket } from '../utils/socket';

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [contactPage, setContactPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const { data } = await getCampaign(id);
      setCampaign(data.campaign);
    } catch {
      toast.error('Campaign not found');
      navigate('/campaigns');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const loadContacts = useCallback(async (page = 1) => {
    try {
      const { data } = await getContacts(id, { page, limit: 20 });
      setContacts(data.contacts);
      setContactsTotal(data.total);
      setContactPage(page);
    } catch {}
  }, [id]);

  useEffect(() => {
    load();
    loadContacts(1);
  }, [load, loadContacts]);

  // Real-time updates
  useSocket(campaign?.clientId?.clientId, {
    'campaign-progress': (update) => {
      if (update.campaignId !== id) return;
      setCampaign(prev => prev ? {
        ...prev, sentCount: update.sentCount, failedCount: update.failedCount,
        totalContacts: update.totalContacts
      } : prev);
    },
    'campaign-completed': ({ campaignId }) => {
      if (campaignId !== id) return;
      setCampaign(prev => prev ? { ...prev, status: 'completed' } : prev);
      toast.success('🎉 Campaign completed!');
      loadContacts(1);
    },
    'campaign-balance-exhausted': ({ campaignId, message }) => {
      if (campaignId !== id) return;
      setCampaign(prev => prev ? { ...prev, status: 'paused' } : prev);
      toast.error(message || 'You need to charge balance in message.');
      loadContacts(1);
    }
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await uploadContacts(id, file);
      toast.success(data.message);
      await load();
      await loadContacts(1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await startCampaign(id);
      setCampaign(prev => prev ? { ...prev, status: 'running' } : prev);
      toast.success('Campaign started!');
    } catch (err) {
      if (err.response?.data?.balanceExhausted) {
        toast.error('You need to charge balance in message.');
      } else {
        toast.error(err.response?.data?.error || 'Failed to start');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await pauseCampaign(id);
      setCampaign(prev => prev ? { ...prev, status: 'paused' } : prev);
      toast.info('Campaign paused');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to pause');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div>Loading campaign...</div>;
  if (!campaign) return null;

  const progress = campaign.totalContacts > 0
    ? Math.round((campaign.sentCount / campaign.totalContacts) * 100) : 0;
  const pending = campaign.totalContacts - campaign.sentCount - campaign.failedCount;

  const STATUS_COLORS = {
    draft: '#999', running: '#25d366', paused: '#ff9500', completed: '#007aff', failed: '#ff3b30'
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/campaigns')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>←</button>
        <h2 style={{ margin: 0, color: '#1a1a2e' }}>{campaign.name}</h2>
        <span style={{
          padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
          background: STATUS_COLORS[campaign.status] + '22', color: STATUS_COLORS[campaign.status]
        }}>{campaign.status}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Progress card */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 20px' }}>Campaign Progress</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total', value: campaign.totalContacts, color: '#5856d6' },
                { label: 'Sent', value: campaign.sentCount, color: '#25d366' },
                { label: 'Failed', value: campaign.failedCount, color: '#ff3b30' },
                { label: 'Pending', value: Math.max(0, pending), color: '#ff9500' }
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: '12px', background: color + '11', borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#f0f0f0', borderRadius: 8, height: 12, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 8,
                background: 'linear-gradient(90deg, #25d366, #128c7e)',
                width: `${progress}%`, transition: 'width 0.5s'
              }} />
            </div>
            <div style={{ textAlign: 'center', marginTop: 8, color: '#666', fontSize: 14 }}>
              {progress}% complete
              {campaign.status === 'running' && <span style={{ color: '#25d366', marginLeft: 8 }}>● Live</span>}
            </div>
          </div>

          {/* Message preview */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 12px' }}>Message Template</h3>
            <div style={{
              background: '#dcf8c6', borderRadius: '12px 12px 2px 12px', padding: '12px 16px',
              fontSize: 14, lineHeight: 1.6, maxWidth: 400, whiteSpace: 'pre-wrap', color: '#333'
            }}>
              {campaign.message}
            </div>
            <p style={{ fontSize: 12, color: '#999', marginTop: 12 }}>
              Variables like &#123;name&#125; will be replaced from CSV columns
            </p>
          </div>

          {/* Contacts table */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px' }}>Contacts ({contactsTotal})</h3>
            {contacts.length === 0 ? (
              <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>No contacts uploaded yet</div>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8f8f8' }}>
                      {['Name', 'Phone', 'Status', 'Sent At'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#666', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(c => (
                      <tr key={c._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 12px' }}>{c.name || '—'}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{c.phone}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 12, fontSize: 11,
                            background: { pending: '#f0f0f0', sent: '#dcf8c6', failed: '#ffe0de', skipped: '#fff3cd' }[c.status] || '#f0f0f0',
                            color: { pending: '#666', sent: '#128c7e', failed: '#ff3b30', skipped: '#ff9500' }[c.status] || '#666'
                          }}>{c.status}</span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#999', fontSize: 12 }}>
                          {c.sentAt ? new Date(c.sentAt).toLocaleTimeString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
                  {contactPage > 1 && <button onClick={() => loadContacts(contactPage - 1)} style={btnSmall}>← Prev</button>}
                  <span style={{ fontSize: 13, color: '#666', lineHeight: '30px' }}>Page {contactPage}</span>
                  {contacts.length === 20 && <button onClick={() => loadContacts(contactPage + 1)} style={btnSmall}>Next →</button>}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right column - actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upload contacts */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 12px' }}>Upload Contacts</h3>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
              CSV must have a <code>phone</code> column. Optional: <code>name</code>, and any extra columns become template variables.
            </p>
            <label style={{
              display: 'block', padding: '14px', background: '#f8fff9', border: '2px dashed #25d366',
              borderRadius: 8, textAlign: 'center', cursor: 'pointer', color: '#25d366', fontWeight: 600, fontSize: 14
            }}>
              {uploading ? '⏳ Uploading...' : '📂 Choose CSV File'}
              <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 8, textAlign: 'center' }}>
              Example: phone,name,code<br />2348012345678,John,PROMO10
            </p>
          </div>

          {/* Campaign controls */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px' }}>Controls</h3>
            {['draft', 'paused'].includes(campaign.status) && (
              <button onClick={handleStart} disabled={actionLoading || campaign.totalContacts === 0} style={{ ...btnGreen, width: '100%', marginBottom: 10 }}>
                {actionLoading ? 'Starting...' : '▶ Start Campaign'}
              </button>
            )}
            {campaign.status === 'running' && (
              <button onClick={handlePause} disabled={actionLoading} style={{ ...btnYellow, width: '100%', marginBottom: 10 }}>
                {actionLoading ? 'Pausing...' : '⏸ Pause Campaign'}
              </button>
            )}
            {campaign.status === 'completed' && (
              <div style={{ color: '#25d366', fontWeight: 600, textAlign: 'center', padding: 12 }}>
                ✅ Campaign Completed!
              </div>
            )}
          </div>

          {/* Client info */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 12px' }}>WhatsApp Client</h3>
            <div style={{ fontSize: 14 }}>
              <div style={{ fontWeight: 600 }}>{campaign.clientId?.name}</div>
              <div style={{ color: '#666', fontSize: 13 }}>{campaign.clientId?.phone || 'N/A'}</div>
              <div style={{ marginTop: 8 }}>
                <span style={{ color: campaign.clientId?.status === 'connected' ? '#25d366' : '#999' }}>●</span>
                <span style={{ fontSize: 13, marginLeft: 6 }}>{campaign.clientId?.status}</span>
              </div>
            </div>
          </div>

          {/* Delay info */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 12px' }}>⏱ Anti-ban Delays</h3>
            <div style={{ fontSize: 13, color: '#666' }}>
              <div>Min delay: <strong>{campaign.minDelay / 1000}s</strong></div>
              <div>Max delay: <strong>{campaign.maxDelay / 1000}s</strong></div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#aaa' }}>
                Random delay between messages prevents WhatsApp bans.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const btnGreen = { background: '#25d366', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const btnYellow = { background: '#ff9500', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const btnSmall = { background: '#f0f0f0', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: 13 };
