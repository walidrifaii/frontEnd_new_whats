import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getAdminPlans, updateAdminPlan } from '../services/api';

export default function AdminPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    try {
      const { data } = await getAdminPlans();
      const list = data.plans || [];
      setPlans(list);
      const next = {};
      list.forEach((plan) => {
        next[plan._id] = {
          name: plan.name,
          messageQuota: String(plan.messageQuota),
          sourceLimit: String(plan.sourceLimit),
          isActive: Boolean(plan.isActive)
        };
      });
      setDrafts(next);
    } catch (err) {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (planId) => {
    const draft = drafts[planId];
    if (!draft) return;
    const messageQuota = parseInt(draft.messageQuota, 10);
    const sourceLimit = parseInt(draft.sourceLimit, 10);
    if (!draft.name.trim() || !Number.isFinite(messageQuota) || messageQuota < 1) {
      toast.error('Name and a message quota of at least 1 are required');
      return;
    }
    if (!Number.isFinite(sourceLimit) || sourceLimit < 1 || sourceLimit > 10) {
      toast.error('Source limit must be between 1 and 10');
      return;
    }
    setSavingId(planId);
    try {
      await updateAdminPlan(planId, {
        name: draft.name.trim(),
        messageQuota,
        sourceLimit,
        isActive: draft.isActive
      });
      toast.success('Plan saved');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save plan');
    } finally {
      setSavingId('');
    }
  };

  if (loading) return <div>Loading plans...</div>;

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', color: '#1a1a2e' }}>Subscription plans</h2>
      <p style={{ color: '#666', margin: '0 0 24px', fontSize: 14, maxWidth: 720 }}>
        These numbers control every client. Mini / Medium / Max can be renamed and their
        message quota and source slots can be changed here. Assign a plan to an owner on
        Manage Users, then enable the real sources used on that owner.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {plans.map((plan) => {
          const draft = drafts[plan._id] || {};
          return (
            <div
              key={plan._id}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 22,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                borderTop: '4px solid #5856d6'
              }}
            >
              <input
                value={draft.name || ''}
                onChange={(e) => setDrafts((p) => ({ ...p, [plan._id]: { ...draft, name: e.target.value } }))}
                aria-label={`${plan.slug} plan name`}
                style={fieldStyle}
              />
              <p style={{ color: '#888', fontSize: 12, margin: '8px 0 16px' }}>slug: {plan.slug}</p>
              <label style={labelStyle}>
                Messages included
                <input
                  type="number"
                  min="1"
                  value={draft.messageQuota || ''}
                  onChange={(e) => setDrafts((p) => ({ ...p, [plan._id]: { ...draft, messageQuota: e.target.value } }))}
                  style={{ ...fieldStyle, marginTop: 6 }}
                />
              </label>
              <label style={{ ...labelStyle, marginTop: 12 }}>
                Sources allowed
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={draft.sourceLimit || ''}
                  onChange={(e) => setDrafts((p) => ({ ...p, [plan._id]: { ...draft, sourceLimit: e.target.value } }))}
                  style={{ ...fieldStyle, marginTop: 6 }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={Boolean(draft.isActive)}
                  onChange={(e) => setDrafts((p) => ({ ...p, [plan._id]: { ...draft, isActive: e.target.checked } }))}
                />
                Visible for clients to request
              </label>
              <button
                type="button"
                onClick={() => handleSave(plan._id)}
                disabled={savingId === plan._id}
                style={{
                  marginTop: 16,
                  width: '100%',
                  minHeight: 44,
                  border: 'none',
                  borderRadius: 8,
                  background: '#5856d6',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {savingId === plan._id ? 'Saving...' : 'Save plan'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #ddd',
  fontSize: 15,
  boxSizing: 'border-box'
};

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#444'
};
