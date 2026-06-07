import React from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NutritionPanel({ meals, weekStart }) {
  const mealsByDay = Array.from({ length: 7 }, (_, i) => {
    const meal = meals.find(m => m.day_of_week === i);
    if (!meal?.ingredients?.length) return { day: DAYS[i], date: addDays(weekStart, i), calories: null, protein: null, carbs: null, fat: null };
    const hasData = meal.ingredients.some(ing => ing.calories_per_serving != null);
    if (!hasData) return { day: DAYS[i], date: addDays(weekStart, i), calories: null, protein: null, carbs: null, fat: null };
    const totals = meal.ingredients.reduce(
      (acc, ing) => ({
        calories: acc.calories + (ing.calories_per_serving || 0),
        protein: acc.protein + (ing.protein_g || 0),
        carbs: acc.carbs + (ing.carbs_g || 0),
        fat: acc.fat + (ing.fat_g || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const servings = meal.servings || 1;
    return {
      day: DAYS[i],
      date: addDays(weekStart, i),
      name: meal.meal_name,
      calories: Math.round(totals.calories / servings),
      protein: Math.round(totals.protein / servings),
      carbs: Math.round(totals.carbs / servings),
      fat: Math.round(totals.fat / servings),
    };
  });

  const withData = mealsByDay.filter(d => d.calories !== null);
  const avgCalories = withData.length ? Math.round(withData.reduce((s, d) => s + d.calories, 0) / withData.length) : null;
  const totalProtein = withData.length ? Math.round(withData.reduce((s, d) => s + d.protein, 0)) : null;
  const totalCarbs = withData.length ? Math.round(withData.reduce((s, d) => s + d.carbs, 0)) : null;
  const totalFat = withData.length ? Math.round(withData.reduce((s, d) => s + d.fat, 0)) : null;

  const chartData = mealsByDay.map(d => ({
    name: d.day,
    calories: d.calories || 0,
    hasData: d.calories !== null,
    mealName: d.name,
  }));

  if (!withData.length) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
      <h3 style={{ color: 'var(--text-muted)', fontFamily: 'Playfair Display', fontWeight: 400 }}>No nutrition data yet</h3>
      <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 14 }}>
        Add ingredients to your meals and use "Look Up Nutrition" to see data here.
      </p>
    </div>
  );

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, marginBottom: 20 }}>Weekly Nutrition</h2>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { label: 'Avg Calories/day', value: avgCalories, unit: 'kcal', color: 'var(--terracotta)' },
          { label: 'Total Protein', value: totalProtein, unit: 'g', color: 'var(--sage)' },
          { label: 'Total Carbs', value: totalCarbs, unit: 'g', color: '#C4A02D' },
          { label: 'Total Fat', value: totalFat, unit: 'g', color: '#8B6BB1' },
        ].map(({ label, value, unit, color }) => (
          <div key={label} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px 20px',
            boxShadow: 'var(--shadow)',
          }}>
            <div style={{ fontSize: 28, fontFamily: 'Playfair Display', fontWeight: 700, color }}>
              {value !== null ? value : '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label} ({unit})</div>
          </div>
        ))}
      </div>

      {/* Calories bar chart */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, boxShadow: 'var(--shadow)', marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Calories per Meal (per serving)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={32}>
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                    {d.mealName && <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.mealName}</div>}
                    <div>{d.hasData ? `${d.calories} kcal/serving` : 'No data'}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="calories" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.hasData ? 'var(--terracotta)' : 'var(--border)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-day breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mealsByDay.filter(d => d.calories !== null).map(d => (
          <div key={d.day} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'grid',
            gridTemplateColumns: '100px 1fr repeat(4, 80px)',
            alignItems: 'center',
            gap: 12,
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{d.day}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.date}</div>
            </div>
            <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
            {[
              { val: d.calories, label: 'kcal', color: 'var(--terracotta)' },
              { val: d.protein, label: 'g protein', color: 'var(--sage)' },
              { val: d.carbs, label: 'g carbs', color: '#C4A02D' },
              { val: d.fat, label: 'g fat', color: '#8B6BB1' },
            ].map(({ val, label, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color }}>{val}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
