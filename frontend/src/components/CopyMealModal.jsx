import React from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CopyMealModal({ meal, nextWeekStart, occupiedDays, onConfirm, onClose }) {
  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(44,24,16,0.35)', zIndex: 1000 }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(360px, calc(100vw - 32px))',
        background: 'var(--bg)',
        borderRadius: 'var(--radius)',
        zIndex: 1001,
        boxShadow: '0 8px 32px rgba(44,24,16,0.2)',
        padding: '20px 22px',
      }}>
        <h2 style={{ fontSize: 17 }}>Copy to next week</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2, marginBottom: 16 }}>
          Pick a day for "{meal.meal_name}"
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {DAYS.map((day, i) => {
            const date = addDays(nextWeekStart, i);
            const occupied = occupiedDays.includes(i);
            return (
              <button
                key={i}
                disabled={occupied}
                onClick={() => onConfirm(i)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: occupied ? 'var(--bg)' : 'var(--bg-card)',
                  color: occupied ? 'var(--text-muted)' : 'var(--text)',
                  fontSize: 14,
                  cursor: occupied ? 'not-allowed' : 'pointer',
                  opacity: occupied ? 0.55 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <span>{day}, {formatDate(date)}</span>
                {occupied && <span style={{ fontSize: 11 }}>Already planned</span>}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '9px 18px',
              fontSize: 14,
              background: 'var(--bg-card)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
