import React, { useState, useEffect, useRef } from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const API = '/api';

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MealModal({ day, meal, weekStart, onSave, onClose, showToast }) {
  const [form, setForm] = useState({
    meal_name: meal?.meal_name || '',
    recipe_url: meal?.recipe_url || '',
    notes: meal?.notes || '',
    servings: meal?.servings || 4,
  });
  const [ingredients, setIngredients] = useState(meal?.ingredients || []);
  const [scraping, setScraping] = useState(false);
  const [visionLoading, setVisionLoading] = useState(false);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [nutrition, setNutrition] = useState(null);
  const [visionPreview, setVisionPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Compute nutrition from cached ingredient data
  useEffect(() => {
    const hasData = ingredients.some(i => i.calories_per_serving != null);
    if (hasData) {
      const totals = ingredients.reduce(
        (acc, i) => ({
          calories: acc.calories + (i.calories_per_serving || 0),
          protein_g: acc.protein_g + (i.protein_g || 0),
          carbs_g: acc.carbs_g + (i.carbs_g || 0),
          fat_g: acc.fat_g + (i.fat_g || 0),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      );
      setNutrition(totals);
    } else {
      setNutrition(null);
    }
  }, [ingredients]);

  const handleFetchRecipe = async () => {
    if (!form.recipe_url) return;
    setScraping(true);
    try {
      const res = await fetch(`${API}/recipes/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.recipe_url }),
      });
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); return; }
      if (data.meal_name && !form.meal_name) setForm(f => ({ ...f, meal_name: data.meal_name }));
      if (data.servings) setForm(f => ({ ...f, servings: data.servings }));
      const fresh = data.ingredients?.length
        ? data.ingredients.map(i => ({ ...i, calories_per_serving: null, protein_g: null, carbs_g: null, fat_g: null }))
        : [];
      if (fresh.length) {
        setIngredients(fresh);
        showToast('Recipe fetched — looking up nutrition…');
        await handleLookupNutrition(fresh);
      } else {
        showToast('Recipe fetched!');
      }
    } catch {
      showToast('Failed to fetch recipe', 'error');
    } finally {
      setScraping(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVisionLoading(true);
    setVisionPreview(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${API}/recipes/vision`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); return; }
      setVisionPreview(data);
      showToast('Image analyzed — review and apply below', 'info');
    } catch {
      showToast('Image extraction failed', 'error');
    } finally {
      setVisionLoading(false);
      e.target.value = '';
    }
  };

  const applyVisionPreview = async () => {
    if (!visionPreview) return;
    if (visionPreview.meal_name && !form.meal_name) setForm(f => ({ ...f, meal_name: visionPreview.meal_name }));
    if (visionPreview.servings) setForm(f => ({ ...f, servings: visionPreview.servings }));
    const fresh = visionPreview.ingredients?.length
      ? visionPreview.ingredients.map(i => ({ ...i, calories_per_serving: null, protein_g: null, carbs_g: null, fat_g: null }))
      : [];
    if (fresh.length) {
      setIngredients(fresh);
      setVisionPreview(null);
      showToast('Recipe applied — looking up nutrition…');
      await handleLookupNutrition(fresh);
    } else {
      setVisionPreview(null);
      showToast('Recipe applied');
    }
  };

  const handleLookupNutrition = async (ingredientList = ingredients) => {
    if (!ingredientList.length) return;
    setNutritionLoading(true);
    try {
      const res = await fetch(`${API}/nutrition/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: ingredientList }),
      });
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); return; }
      const enriched = ingredientList.map(ing => {
        const match = data.find(d => d.name.toLowerCase() === ing.name.toLowerCase());
        return match ? { ...ing, ...match } : ing;
      });
      setIngredients(enriched);
      showToast('Nutrition data loaded');
    } catch {
      showToast('Nutrition lookup failed', 'error');
    } finally {
      setNutritionLoading(false);
    }
  };

  const updateIngredient = (i, field, value) => {
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing));
  };

  const addIngredient = () => {
    setIngredients(prev => [...prev, { name: '', quantity: '', unit: '', calories_per_serving: null }]);
  };

  const removeIngredient = (i) => {
    setIngredients(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = () => {
    if (!form.meal_name.trim()) { showToast('Meal name is required', 'error'); return; }
    onSave({
      ...(meal?.id ? { id: meal.id } : {}),
      ...form,
      day_of_week: day,
      ingredients: ingredients.filter(i => i.name.trim()),
    });
  };

  const dayLabel = `${DAYS[day]}${weekStart ? ', ' + addDays(weekStart, day) : ''}`;

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(44,24,16,0.35)', zIndex: 1000 }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(520px, 100vw)',
        background: 'var(--bg)',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(44,24,16,0.15)',
        animation: 'slideIn 0.25s ease',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 20 }}>{meal ? 'Edit Meal' : 'Add Meal'}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{dayLabel}</p>
          </div>
          <button onClick={onClose} style={{ ...btnBase, background: 'none', fontSize: 22, color: 'var(--text-muted)', padding: 4 }}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Basic fields */}
          <Field label="Meal Name *">
            <input
              value={form.meal_name}
              onChange={e => setForm(f => ({ ...f, meal_name: e.target.value }))}
              placeholder="e.g. Roasted Chicken Thighs"
              style={inputStyle}
            />
          </Field>

          <Field label="Recipe URL">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={form.recipe_url}
                onChange={e => setForm(f => ({ ...f, recipe_url: e.target.value }))}
                placeholder="https://..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleFetchRecipe}
                disabled={!form.recipe_url || scraping}
                style={{ ...btnSecondary, whiteSpace: 'nowrap' }}
              >
                {scraping ? '…' : 'Fetch Recipe'}
              </button>
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Servings">
              <input
                type="number"
                min={1}
                value={form.servings}
                onChange={e => setForm(f => ({ ...f, servings: parseInt(e.target.value) || 1 }))}
                style={inputStyle}
              />
            </Field>
            <Field label="Upload Image">
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={visionLoading}
                  style={{ ...btnSecondary, flex: 1 }}
                >
                  {visionLoading ? 'Analyzing…' : '📷 Upload Image'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              </div>
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Cooking notes, substitutions, timing…"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          {/* Vision preview */}
          {visionPreview && (
            <div style={{ background: 'var(--terracotta-light)', border: '1px solid var(--terracotta)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--terracotta)' }}>
                  AI extracted: {visionPreview.meal_name || 'Untitled'} ({visionPreview.ingredients?.length || 0} ingredients)
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={applyVisionPreview} style={{ ...btnPrimary, padding: '4px 12px', fontSize: 13 }}>Apply</button>
                  <button onClick={() => setVisionPreview(null)} style={{ ...btnSecondary, padding: '4px 12px', fontSize: 13 }}>Dismiss</button>
                </div>
              </div>
              <ul style={{ fontSize: 12, color: 'var(--text)', paddingLeft: 16, lineHeight: 1.8 }}>
                {visionPreview.ingredients?.slice(0, 5).map((i, idx) => (
                  <li key={idx}>{[i.quantity, i.unit, i.name].filter(Boolean).join(' ')}</li>
                ))}
                {visionPreview.ingredients?.length > 5 && <li>…and {visionPreview.ingredients.length - 5} more</li>}
              </ul>
            </div>
          )}

          {/* Ingredients */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={labelStyle}>Ingredients ({ingredients.length})</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {ingredients.length > 0 && (
                  <button
                    onClick={handleLookupNutrition}
                    disabled={nutritionLoading}
                    style={{ ...btnSecondary, padding: '4px 10px', fontSize: 12 }}
                  >
                    {nutritionLoading ? 'Looking up…' : '🔍 Nutrition'}
                  </button>
                )}
                <button onClick={addIngredient} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 12 }}>
                  + Add
                </button>
              </div>
            </div>

            {ingredients.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0' }}>
                No ingredients yet. Fetch a recipe URL or add manually.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 24px', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Name</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Qty</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Unit</span>
                  <span />
                </div>
                {ingredients.map((ing, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 24px', gap: 6, alignItems: 'center' }}>
                    <input
                      value={ing.name}
                      onChange={e => updateIngredient(i, 'name', e.target.value)}
                      placeholder="flour"
                      style={{ ...inputStyle, padding: '6px 8px', fontSize: 13 }}
                    />
                    <input
                      value={ing.quantity || ''}
                      onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                      placeholder="2"
                      style={{ ...inputStyle, padding: '6px 8px', fontSize: 13 }}
                    />
                    <input
                      value={ing.unit || ''}
                      onChange={e => updateIngredient(i, 'unit', e.target.value)}
                      placeholder="cups"
                      style={{ ...inputStyle, padding: '6px 8px', fontSize: 13 }}
                    />
                    <button
                      onClick={() => removeIngredient(i)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nutrition summary */}
          {nutrition && (
            <div style={{ background: 'var(--sage-light)', borderRadius: 8, padding: 14, marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--sage)', marginBottom: 8 }}>Nutrition per serving (estimated)</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { label: 'Calories', value: Math.round(nutrition.calories / form.servings), unit: 'kcal' },
                  { label: 'Protein', value: Math.round(nutrition.protein_g / form.servings), unit: 'g' },
                  { label: 'Carbs', value: Math.round(nutrition.carbs_g / form.servings), unit: 'g' },
                  { label: 'Fat', value: Math.round(nutrition.fat_g / form.servings), unit: 'g' },
                ].map(({ label, value, unit }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'Playfair Display' }}>{value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label} {unit}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} style={btnPrimary}>
            {meal ? 'Save Changes' : 'Add Meal'}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 };
const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--bg-card)', color: 'var(--text)', outline: 'none', transition: 'border-color 0.15s' };
const btnBase = { border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' };
const btnPrimary = { ...btnBase, background: 'var(--terracotta)', color: 'white' };
const btnSecondary = { ...btnBase, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
