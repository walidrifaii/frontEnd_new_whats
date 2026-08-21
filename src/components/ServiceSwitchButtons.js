import React from 'react';

export default function ServiceSwitchButtons({ value, options = [], onChange, dark = false }) {
  const items = ['', ...options.filter(Boolean)];
  const activeValue = value || '';

  return (
    <div
      role="group"
      aria-label="Switch service"
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
    >
      {items.map((name) => {
        const active = activeValue === name;
        return (
          <button
            key={name || 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(name)}
            style={{
              minHeight: 44,
              minWidth: 72,
              padding: '10px 16px',
              borderRadius: 999,
              border: active
                ? '2px solid #16a34a'
                : (dark ? '1px solid #475569' : '1px solid #d0d5dd'),
              background: active ? '#16a34a' : (dark ? '#0d0d1f' : '#fff'),
              color: active ? '#fff' : (dark ? '#e2e8f0' : '#0f172a'),
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            {name || 'All'}
          </button>
        );
      })}
    </div>
  );
}
