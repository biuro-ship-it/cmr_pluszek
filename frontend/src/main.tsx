import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { useAuth } from './hooks/useAuth';
import LoginPage from './components/LoginPage';
import Dashboard from './pages/Dashboard';

// ─── Powiadomienia push dla follow-upów ────────────────────────────────────

async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function showFollowUpNotifications(tasks: { clientName: string; reminderText: string; dueDate: string }[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (tasks.length === 0) return;

  const overdue = tasks.filter(t => t.dueDate < new Date().toISOString().split('T')[0]);
  const today = tasks.filter(t => t.dueDate === new Date().toISOString().split('T')[0]);

  if (overdue.length > 0) {
    new Notification(`CRM Pluszek — ${overdue.length} zaległych zadań`, {
      body: overdue.slice(0, 3).map(t => `• ${t.clientName}: ${t.reminderText}`).join('\n'),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'followup-overdue',
    });
  }

  if (today.length > 0) {
    new Notification(`CRM Pluszek — ${today.length} zadań na dziś`, {
      body: today.slice(0, 3).map(t => `• ${t.clientName}: ${t.reminderText}`).join('\n'),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'followup-today',
    });
  }
}

// Eksportuj do użycia w Dashboard
export { requestNotificationPermission, showFollowUpNotifications };

// ─── Root komponent ───────────────────────────────────────────────────────

function Root() {
  const { user, loading, error, signIn, signOut } = useAuth();

  // Poproś o zgodę na powiadomienia po zalogowaniu
  React.useEffect(() => {
    if (user) {
      requestNotificationPermission();
    }
  }, [user]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">📦</div>
        <p className="font-bold text-slate-500 animate-pulse">Ładowanie CRM Pluszek...</p>
      </div>
    </div>
  );

  if (!user) return <LoginPage onSignIn={signIn} error={error} />;
  return <Dashboard user={user} onSignOut={signOut} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
