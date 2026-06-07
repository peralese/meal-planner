import React, { useState, useEffect } from 'react';

const API = '/api';

const CATEGORY_META = {
  produce: { label: 'Produce', emoji: '🥬' },
  dairy: { label: 'Dairy & Eggs', emoji: '🥛' },
  meat: { label: 'Meat & Fish', emoji: '🥩' },
  pantry: { label: 'Pantry', emoji: '🥫' },
  other: { label: 'Other', emoji: '📦' },
};

function formatWeekOf(weekStart) {
  const d = new Date(weekStart + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildPlainText(grouped, weekStart) {
  const lines = [`Shopping List — Week of ${formatWeekOf(weekStart)}`, ''];
  for (const [cat, meta] of Object.entries(CATEGORY_META)) {
    const items = grouped[cat] || [];
    if (!items.length) continue;
    lines.push(meta.label.toUpperCase());
    for (const item of items) {
      const qty = [item.quantity, item.unit].filter(Boolean).join(' ');
      lines.push(`- ${qty ? qty + ' ' : ''}${item.name}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

export default function ShoppingList({ weekId, weekStart, showToast }) {
  const [grouped, setGrouped] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState({});

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/shopping?week_id=${weekId}`)
      .then(r => r.json())
      .then(data => { setGrouped(data); setLoading(false); })
      .catch(() => { showToast('Failed to load shopping list', 'error'); setLoading(false); });
  }, [weekId]);

  const totalItems = grouped ? Object.values(grouped).reduce((s, arr) => s + arr.length, 0) : 0;

  const copyToClipboard = async () => {
    if (!grouped) return;
    const text = buildPlainText(grouped, weekStart);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!');
    } catch {
      showToast('Copy failed — try selecting and copying manually', 'error');
    }
  };

  const handlePrint = () => window.print();

  const toggleItem = (key) => setChecked(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading shopping list…</div>;

  if (!totalItems) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
      <h3 style={{ color: 'var(--text-muted)', fontFamily: 'Playfair Display', fontWeight: 400 }}>No ingredients yet</h3>
      <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 14 }}>Add meals with ingredients to see your shopping list here.</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>Shopping List</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Week of {formatWeekOf(weekStart)} · {totalItems} items
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handlePrint} style={btnSecondary}>🖨 Print</button>
          <button onClick={copyToClipboard} style={btnPrimary}>📋 Copy for Google Keep</button>
        </div>
      </div>

      {Object.entries(CATEGORY_META).map(([cat, meta]) => {
        const items = grouped[cat] || [];
        if (!items.length) return null;
        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
              paddingBottom: 8,
              borderBottom: '2px solid var(--border)',
            }}>
              <span style={{ fontSize: 18 }}>{meta.emoji}</span>
              <h3 style={{ fontSize: 16, fontFamily: 'Playfair Display', fontWeight: 600 }}>{meta.label}</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{items.length} items</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map((item, i) => {
                const key = `${cat}-${i}`;
                const isChecked = checked[key];
                const qty = [item.quantity, item.unit].filter(Boolean).join(' ');
                return (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: isChecked ? 'transparent' : 'var(--bg-card)',
                      border: `1px solid ${isChecked ? 'transparent' : 'var(--border)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked || false}
                      onChange={() => toggleItem(key)}
                      style={{ width: 16, height: 16, accentColor: 'var(--sage)', cursor: 'pointer' }}
                    />
                    <span style={{
                      flex: 1,
                      fontSize: 14,
                      textDecoration: isChecked ? 'line-through' : 'none',
                      color: isChecked ? 'var(--text-muted)' : 'var(--text)',
                    }}>
                      {qty && <strong style={{ marginRight: 4 }}>{qty}</strong>}
                      {item.name}
                    </span>
                    {item.meals?.length > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {item.meals.slice(0, 2).join(', ')}{item.meals.length > 2 ? ` +${item.meals.length - 2}` : ''}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const btnBase = { border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' };
const btnPrimary = { ...btnBase, background: 'var(--terracotta)', color: 'white' };
const btnSecondary = { ...btnBase, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
