import React from 'react';
import MealCard from './MealCard.jsx';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function WeekGrid({ weekStart, meals, onOpenModal, onDeleteMeal }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: 12,
      marginTop: 8,
    }}>
      {DAYS.map((day, i) => {
        const date = addDays(weekStart, i);
        const isToday = date.getTime() === today.getTime();
        const meal = meals.find(m => m.day_of_week === i);

        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              textAlign: 'center',
              padding: '8px 4px',
              borderRadius: 8,
              background: isToday ? 'var(--terracotta)' : 'transparent',
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: isToday ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)',
              }}>
                {day.slice(0, 3)}
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 600,
                fontFamily: 'Playfair Display',
                color: isToday ? '#fff' : 'var(--text)',
                lineHeight: 1.2,
                marginTop: 2,
              }}>
                {formatDate(date)}
              </div>
            </div>

            {meal ? (
              <MealCard
                meal={meal}
                onEdit={() => onOpenModal(i, meal)}
                onDelete={() => onDeleteMeal(meal.id)}
              />
            ) : (
              <button
                onClick={() => onOpenModal(i)}
                style={{
                  flex: 1,
                  minHeight: 120,
                  background: 'var(--bg-card)',
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'all 0.15s',
                  padding: 12,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--terracotta)';
                  e.currentTarget.style.color = 'var(--terracotta)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <span style={{ fontSize: 20 }}>+</span>
                <span>Add meal</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
