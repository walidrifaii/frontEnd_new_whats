import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getCampaigns, createCampaign, deleteCampaign, getClients } from '../services/api';
import useAuthStore from '../store/authStore';

const STATUS_COLORS = {
  draft: '#999', running: '#25d366', paused: '#ff9500',
  completed: '#007aff', failed: '#ff3b30'
};

export default function CampaignPage() {
  const navigate = useNavigate();
  const { statsSource, user } = useAuthStore();
  const activeSource = user?.source || statsSource || '';
  const [campaigns, setCampaigns] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', message: '', clientId: '', minDelay: 20000, maxDelay: 30000 });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [c, cl] = await Promise.all([
          getCampaigns(activeSource ? { source: activeSource } : undefined),
          getClients()
        ]);
        setCampaigns(c.data.campaigns);
        setClients(cl.data.clients.filter(c => c.status === 'connected'));
      } catch (e) {
        toast.error('Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeSource]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await createCampaign({
        ...form,
        source: activeSource || undefined
      });
      setCampaigns(prev => [data.campaign, ...prev]);
      setShowForm(false);
      setForm({ name: '', message: '', clientId: '', minDelay: 20000, maxDelay: 30000 });
      toast.success('Campaign created!');
      navigate(`/campaigns/${data.campaign._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      await deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c._id !== id));
      toast.success('Deleted');
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ margin: 0, color: '#1a1a2e' }}>Campaigns</h2>
        <button onClick={() => setShowForm(!showForm)} style={btnGreen}>
          {showForm ? '✕ Cancel' : '+ New Campaign'}
        </button>
      </div>
      <p style={{ color: '#64748b', margin: '0 0 24px', fontSize: 14 }}>
        {activeSource
          ? `Showing and tagging new campaigns as ${activeSource}. Switch service in the sidebar.`
          : 'Showing all services. Select Shop or CRM in the sidebar to filter and tag new campaigns.'}
      </p>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 28, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 20px' }}>Create Campaign</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Campaign Name</label>
                <input required style={inputStyle} placeholder="Summer Sale 2024"
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>WhatsApp Client</label>
                <select required style={inputStyle} value={form.clientId}
                  onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}>
                  <option value="">Select a client...</option>
                  {clients.map(c => <option key={c._id} value={c._id}>{c.name} ({c.phone})</option>)}
                </select>
                {clients.length === 0 && <small style={{ color: '#ff3b30' }}>No connected clients. Connect one first.</small>}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>
                Message Template
                <span style={{ fontWeight: 400, color: '#999', fontSize: 12, marginLeft: 8 }}>
                  Use &#123;name&#125;, &#123;phone&#125;, or any CSV column as variables
                </span>
              </label>
              <textarea required style={{ ...inputStyle, height: 120, resize: 'vertical' }}
                placeholder="Hello {name}, we have a special offer for you! 🎉"
                value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Min Delay (ms)</label>
                <input type="number" style={inputStyle} min={10000} max={60000}
                  value={form.minDelay} onChange={e => setForm(p => ({ ...p, minDelay: +e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Max Delay (ms)</label>
                <input type="number" style={inputStyle} min={10000} max={120000}
                  value={form.maxDelay} onChange={e => setForm(p => ({ ...p, maxDelay: +e.target.value }))} />
              </div>
            </div>
            <button type="submit" disabled={creating} style={btnGreen}>
              {creating ? 'Creating...' : 'Create Campaign →'}
            </button>
          </form>
        </div>
      )}

      {loading ? <div>Loading...</div> : (
        <div style={{ display: 'grid', gap: 14 }}>
          {campaigns.map(camp => (
            <div key={camp._id} style={{
              background: '#fff', borderRadius: 10, padding: '18px 24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderLeft: `4px solid ${STATUS_COLORS[camp.status] || '#ccc'}`,
              cursor: 'pointer'
            }} onClick={() => navigate(`/campaigns/${camp._id}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{camp.name}</div>
                  <div style={{ fontSize: 13, color: '#666' }}>
                    {camp.clientId?.name || 'N/A'} · {camp.totalContacts} contacts
                    {camp.source ? ` · ${camp.source}` : ''}
                  </div>
                  {/* Progress bar */}
                  {camp.totalContacts > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}>
                        <span>{camp.sentCount} sent · {camp.failedCount} failed · {camp.totalContacts - camp.sentCount - camp.failedCount} pending</span>
                        <span>{Math.round((camp.sentCount / camp.totalContacts) * 100)}%</span>
                      </div>
                      <div style={{ background: '#f0f0f0', borderRadius: 4, height: 6 }}>
                        <div style={{
                          background: '#25d366', borderRadius: 4, height: '100%',
                          width: `${(camp.sentCount / camp.totalContacts) * 100}%`, transition: 'width 0.5s'
                        }} />
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 20, alignItems: 'center' }}>
                  <span style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: STATUS_COLORS[camp.status] + '22', color: STATUS_COLORS[camp.status]
                  }}>{camp.status}</span>
                  <button onClick={e => { e.stopPropagation(); handleDelete(camp._id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#ff3b30' }}>
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && (
            <div style={{ textAlign: 'center', color: '#999', padding: 60 }}>
              No campaigns yet. Create your first one above.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const btnGreen = { background: '#25d366', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#444' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' };
