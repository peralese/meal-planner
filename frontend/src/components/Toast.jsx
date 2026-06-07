import React from 'react';

export default function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type || 'success'} ${t.fading ? 'fading' : ''}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
