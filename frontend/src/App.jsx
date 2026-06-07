import React, { useState, useEffect, useCallback } from 'react';
import WeekGrid from './components/WeekGrid.jsx';
import MealModal from './components/MealModal.jsx';
import ShoppingList from './components/ShoppingList.jsx';
import NutritionPanel from './components/NutritionPanel.jsx';
import Toast from './components/Toast.jsx';

const API = '/api';

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatWeekLabel(weekStart) {
  const d = new Date(weekStart + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function App() {
  const [currentWeek, setCurrentWeek] = useState(null);
  const [meals, setMeals] = useState([]);
  const [activeTab, setActiveTab] = useState('planner');
  const [modalState, setModalState] = useState(null); // { day, meal | null }
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, fading: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, 3500);
  }, []);

  const fetchWeek = useCallback(async (weekStart) => {
    setLoading(true);
    try {
      let url = weekStart ? `${API}/weeks` : `${API}/weeks/current`;
      let week;
      if (weekStart) {
        const res = await fetch(`${API}/weeks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ week_start: weekStart }),
        });
        week = await res.json();
      } else {
        const res = await fetch(`${API}/weeks/current`);
        week = await res.json();
      }
      setCurrentWeek(week);
      const mealsRes = await fetch(`${API}/meals?week_id=${week.id}`);
      const mealsData = await mealsRes.json();
      setMeals(mealsData);
    } catch {
      showToast('Failed to load week data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  const navigateWeek = (direction) => {
    if (!currentWeek) return;
    const newStart = addDays(currentWeek.week_start, direction * 7);
    fetchWeek(newStart);
  };

  const handleOpenModal = (day, meal = null) => {
    setModalState({ day, meal });
  };

  const handleCloseModal = () => setModalState(null);

  const handleSaveMeal = async (mealData) => {
    try {
      if (mealData.id) {
        const res = await fetch(`${API}/meals/${mealData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mealData),
        });
        const updated = await res.json();
        if (updated.error) throw new Error(updated.error);
        setMeals(prev => prev.map(m => m.id === updated.id ? updated : m));
        showToast('Meal updated');
      } else {
        const res = await fetch(`${API}/meals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...mealData, week_id: currentWeek.id }),
        });
        const created = await res.json();
        if (created.error) throw new Error(created.error);
        setMeals(prev => [...prev, created]);
        showToast('Meal added');
      }
      handleCloseModal();
    } catch (err) {
      showToast(err.message || 'Failed to save meal', 'error');
    }
  };

  const handleDeleteMeal = async (mealId) => {
    try {
      await fetch(`${API}/meals/${mealId}`, { method: 'DELETE' });
      setMeals(prev => prev.filter(m => m.id !== mealId));
      showToast('Meal removed');
    } catch {
      showToast('Failed to delete meal', 'error');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
        boxShadow: '0 1px 4px rgba(44,24,16,0.06)',
      }}>
        <h1 style={{ fontSize: 24, color: 'var(--terracotta)', letterSpacing: '-0.5px' }}>
          Meal Planner
        </h1>
        <nav style={{ display: 'flex', gap: 4 }}>
          {[['planner', 'Week Planner'], ['shopping', 'Shopping List'], ['nutrition', 'Nutrition']].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === tab ? 'var(--terracotta-light)' : 'transparent',
                color: activeTab === tab ? 'var(--terracotta)' : 'var(--text-muted)',
                fontWeight: activeTab === tab ? 600 : 400,
                fontSize: 14,
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {currentWeek && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: '20px 32px 8px',
        }}>
          <button onClick={() => navigateWeek(-1)} style={navBtnStyle}>←</button>
          <span style={{ fontFamily: 'Playfair Display', fontSize: 18, color: 'var(--text)' }}>
            Week of {formatWeekLabel(currentWeek.week_start)}
          </span>
          <button onClick={() => navigateWeek(1)} style={navBtnStyle}>→</button>
          <button
            onClick={() => fetchWeek()}
            style={{ ...navBtnStyle, fontSize: 12, padding: '6px 12px', color: 'var(--text-muted)' }}
          >
            Today
          </button>
        </div>
      )}

      <main style={{ padding: '16px 32px 40px', maxWidth: 1400, margin: '0 auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            Loading…
          </div>
        )}
        {!loading && activeTab === 'planner' && currentWeek && (
          <WeekGrid
            weekStart={currentWeek.week_start}
            meals={meals}
            onOpenModal={handleOpenModal}
            onDeleteMeal={handleDeleteMeal}
          />
        )}
        {!loading && activeTab === 'shopping' && currentWeek && (
          <ShoppingList weekId={currentWeek.id} weekStart={currentWeek.week_start} showToast={showToast} />
        )}
        {!loading && activeTab === 'nutrition' && currentWeek && (
          <NutritionPanel meals={meals} weekStart={currentWeek.week_start} />
        )}
      </main>

      {modalState && (
        <MealModal
          day={modalState.day}
          meal={modalState.meal}
          weekStart={currentWeek?.week_start}
          onSave={handleSaveMeal}
          onClose={handleCloseModal}
          showToast={showToast}
        />
      )}

      <Toast toasts={toasts} />
    </div>
  );
}

const navBtnStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 16,
  color: 'var(--text)',
  cursor: 'pointer',
  transition: 'all 0.15s',
};
