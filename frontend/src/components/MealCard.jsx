import React, { useState } from 'react';

export default function MealCard({ meal, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ingredientCount = meal.ingredients?.length || 0;
  const hasNutrition = meal.ingredients?.some(i => i.calories_per_serving !== null);

  const totalCal = hasNutrition
    ? meal.ingredients.reduce((sum, i) => sum + (i.calories_per_serving || 0), 0)
    : null;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 14,
        boxShadow: 'var(--shadow)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onEdit}
      onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
    >
      <div style={{ paddingRight: 24 }}>
        <div style={{
          fontFamily: 'Playfair Display',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text)',
          lineHeight: 1.3,
          marginBottom: 6,
        }}>
          {meal.meal_name}
        </div>

        {meal.recipe_url && (
          <a
            href={meal.recipe_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: 11,
              color: 'var(--terracotta)',
              textDecoration: 'none',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: 8,
            }}
          >
            {(() => { try { return new URL(meal.recipe_url).hostname; } catch { return meal.recipe_url; } })()}
          </a>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {ingredientCount > 0 && (
            <span style={{
              fontSize: 11,
              background: 'var(--sage-light)',
              color: 'var(--sage)',
              padding: '2px 8px',
              borderRadius: 12,
              fontWeight: 500,
            }}>
              {ingredientCount} ingredient{ingredientCount !== 1 ? 's' : ''}
            </span>
          )}
          {totalCal !== null && (
            <span style={{
              fontSize: 11,
              background: 'var(--terracotta-light)',
              color: 'var(--terracotta)',
              padding: '2px 8px',
              borderRadius: 12,
              fontWeight: 500,
            }}>
              {Math.round(totalCal)} kcal
            </span>
          )}
        </div>

        {meal.notes && (
          <p style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginTop: 8,
            lineHeight: 1.4,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {meal.notes}
          </p>
        )}
      </div>

      {confirmDelete ? (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 4,
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onDelete}
            style={{ ...iconBtnStyle, background: '#C44B2D', color: 'white', fontSize: 11, padding: '3px 8px' }}
          >
            Delete
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{ ...iconBtnStyle, fontSize: 11, padding: '3px 8px' }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          style={{ ...iconBtnStyle, position: 'absolute', top: 8, right: 8 }}
          onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
          title="Delete meal"
        >
          ×
        </button>
      )}
    </div>
  );
}

const iconBtnStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: 16,
  color: 'var(--text-muted)',
  lineHeight: 1,
};
