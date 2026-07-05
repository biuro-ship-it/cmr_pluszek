import React, { useEffect, useState, useCallback } from 'react';
import { useClients } from '../hooks/useClients';
import ClientForm from '../components/ClientForm';
import ClientList from '../components/ClientList';
import ClientCard from '../components/ClientCard';
import ProductsPanel from '../components/ProductsPanel';
import AddressesView from '../components/AddressesView';
import PromotionsPanel from '../components/PromotionsPanel';
import NotesBoard from '../components/NotesBoard';
import FoamStockPanel from '../FoamStockPanel';
import ArchivePanel from '../components/ArchivePanel';
import EmailTemplatesPanel from '../components/EmailTemplatesPanel';
import SuppliersPanel from '../components/SuppliersPanel';
import CalculationsPanel from '../components/CalculationsPanel';
import AnalyticsPanel from '../components/AnalyticsPanel';
import { Client, ClientFormData, FollowUp, getFollowUpSummary, updateFollowUpStatus, getFakturowniaStats } from '../services/api';

// Info o fakturach per NIP (do sygnału „wymaga uwagi" na liście klientów).
export type InvoiceInfo = Record<string, { count: number; lastIssueDate: string; net: number }>;
import { User } from 'firebase/auth';

type ActiveTab = 'clients' | 'products' | 'addresses' | 'promotions' | 'notes' | 'foam' | 'mail' | 'suppliers' | 'calculations' | 'analytics' | 'archive';

interface DashboardProps {
  user: User;
  onSignOut: () => void;
}
const NAV_TABS: { id: ActiveTab; label: string; short: string; icon: string }[] = [
  { id: 'clients',    label: 'Klienci',   short: 'Klienci',  icon: '🏢' },
  { id: 'addresses',  label: 'Adresy',    short: 'Adresy',   icon: '📍' },
  { id: 'promotions', label: 'Promocje',  short: 'Promocje', icon: '📢' },
  { id: 'products',   label: 'Produkty',  short: 'Prod.',    icon: '📦' },
  { id: 'notes',      label: 'Notatki',   short: 'Notatki',  icon: '📝' }, // <--- NOWE
  { id: 'foam',       label: 'Pianki',    short: 'Pianki',   icon: '🎨' }, // <--- NOWE
  { id: 'mail',       label: 'Maile',     short: 'Maile',    icon: '✉️' },
  { id: 'suppliers',  label: 'Dostawcy',  short: 'Dostaw.',  icon: '🚚' },
  { id: 'calculations', label: 'Kalkulacje', short: 'Kalk.', icon: '🧮' },
  { id: 'analytics',  label: 'Analizy',   short: 'Analizy',  icon: '📊' },
  { id: 'archive',    label: 'Archiwum',  short: 'Archiw.',  icon: '💾' },
];

const Dashboard: React.FC<DashboardProps> = ({ user, onSignOut }) => {
  const { clients, loading, error, fetchClients, createClient, updateClient, removeClient } = useClients();
  const [activeTab, setActiveTab] = useState<ActiveTab>('clients');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<FollowUp[]>([]);
  const [invoiceInfo, setInvoiceInfo] = useState<InvoiceInfo>({});

  // Raz w tle: pobierz obrót firm z Fakturowni (kategoria CRM-Pluszek) i zbuduj mapę po NIP.
  useEffect(() => {
    getFakturowniaStats('all')
      .then(s => {
        const map: InvoiceInfo = {};
        for (const c of s.companies) {
          if (c.nip) map[c.nip] = { count: c.count, lastIssueDate: c.lastIssueDate, net: c.net };
        }
        setInvoiceInfo(map);
      })
      .catch(() => {});
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const summary = await getFollowUpSummary();
      setTasks(summary);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchClients();
    loadTasks();
  }, [fetchClients, loadTasks]);

  const handleAddClick = () => {
    setEditClient(null);
    setViewClient(null);
    setShowForm(true);
  };

  const handleEditClick = (client: Client) => {
    setEditClient(client);
    setViewClient(null);
    setShowForm(true);
  };

  const handleViewClick = (client: Client) => {
    setShowForm(false);
    setViewClient(client);
  };

  // NOWA FUNKCJA: Skok do karty klienta prosto z listy zadań
  const handleOpenClientFromTask = (clientId?: string) => {
    if (!clientId) {
      alert("Błąd: To zadanie nie ma przypisanego ID klienta.");
      return;
    }
    
    // Szukamy klienta w pobranej już bazie
    const clientTarget = clients.find(c => c.id === clientId);
    
    if (clientTarget) {
      // Otwieramy podgląd karty klienta (identycznie jak kliknięcie na liście)
      handleViewClick(clientTarget);
    } else {
      alert("Nie znaleziono klienta w bazie. Prawdopodobnie został usunięty.");
    }
  };

  const handleSubmit = async (data: ClientFormData) => {
    setSubmitError(null);
    try {
      if (editClient) {
        const updated = await updateClient(editClient.id, data);
        if (viewClient?.id === updated.id) setViewClient(updated);
      } else {
        await createClient(data);
      }
      setShowForm(false);
      setEditClient(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Błąd zapisu. Spróbuj ponownie.');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await updateFollowUpStatus(taskId, 'zrealizowane');
      loadTasks();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd serwera';
      alert(`Błąd podczas kończenia zadania:\n${msg}`);
    }
  };

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setShowForm(false);
    setViewClient(null);
    setMobileMenuOpen(false);
  };

  const activeMeta = NAV_TABS.find(t => t.id === activeTab) ?? NAV_TABS[0];

  const isOverdue = (dateStr: string) => dateStr < new Date().toISOString().split('T')[0];

  const activeThisMonth = clients.filter(c => {
    const dateToUse = c.lastContactAt || c.createdAt;
    if (!dateToUse) return false;
    const diffTime = new Date().getTime() - new Date(dateToUse).getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) <= 30;
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">

      {/* ── NAWIGACJA ─────────────────────────────────────────────────────── */}
      <nav className="relative bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <img
              src="/icon-192.png"
              alt="Pluszek"
              className="w-9 h-9 rounded-xl object-cover shadow-sm"
            />
            <h1 className="text-lg font-black bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent hidden sm:block">
              CRM Pluszek
            </h1>
          </div>

          {/* DESKTOP: poziomy pasek zakładek */}
          <div className="hidden md:flex items-center gap-0.5 bg-slate-100 rounded-xl p-1">
            {NAV_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden md:inline">{tab.label}</span>
                {tab.id === 'clients' && tasks.length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                    {tasks.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* MOBILE: aktualna zakładka */}
          <div className="flex md:hidden items-center gap-2 min-w-0">
            <span className="text-lg">{activeMeta.icon}</span>
            <span className="font-bold text-slate-800 truncate">{activeMeta.label}</span>
            {activeTab !== 'clients' && tasks.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                {tasks.length}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-sm text-slate-500 hidden lg:block">{user?.email}</span>
          <button
            onClick={onSignOut}
            className="text-sm font-medium text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors hidden md:block"
          >
            Wyloguj
          </button>

          {/* MOBILE: hamburger */}
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(o => !o)}
            className="md:hidden flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors text-xl"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* MOBILE: rozwijane menu zakładek */}
        {mobileMenuOpen && (
          <>
            <div className="md:hidden fixed inset-0 z-10" onClick={() => setMobileMenuOpen(false)} />
            <div className="md:hidden absolute top-full left-0 right-0 z-20 bg-white border-b border-slate-200 shadow-lg px-3 py-3 animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 gap-1 max-h-[70vh] overflow-y-auto">
                {NAV_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => switchTab(tab.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.id === 'clients' && tasks.length > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                        {tasks.length}
                      </span>
                    )}
                  </button>
                ))}
                <button
                  onClick={onSignOut}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors mt-1 border-t border-slate-100 pt-3"
                >
                  <span className="text-lg">🚪</span>
                  <span>Wyloguj</span>
                </button>
              </div>
            </div>
          </>
        )}
      </nav>

      {/* ── GŁÓWNA TREŚĆ ─────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto p-4 md:p-6">

        {/* ── ZAKŁADKA: KLIENCI ─────────────────────────────────────────── */}
        {activeTab === 'clients' && (
          <>
            {!viewClient && !showForm && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 animate-in slide-in-from-top-4 duration-300">
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-2xl shrink-0">🏢</div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Baza firm</p>
                    <p className="text-3xl font-black text-slate-800">{clients.length}</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-2xl shrink-0">⏰</div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Zadania</p>
                    <p className="text-3xl font-black text-slate-800">{tasks.length}</p>
                  </div>
                </div>
                <div className="col-span-2 md:col-span-1 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-2xl shrink-0">📈</div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Aktywni (30 dni)</p>
                    <p className="text-3xl font-black text-slate-800">{activeThisMonth}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Panel zadań - ULEPSZONY WIDOK */}
            {!viewClient && !showForm && tasks.length > 0 && (
              <div className="mb-6">
                <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <span className="text-red-500">⏰</span> Do wykonania na dziś
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className={`p-4 rounded-2xl border ${
                        isOverdue(task.dueDate) ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
                      } shadow-sm flex flex-col justify-between`}
                    >
                      <div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${
                          isOverdue(task.dueDate) ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800'
                        }`}>
                          {isOverdue(task.dueDate) ? 'Zaległe' : 'Dziś'} ({task.dueDate})
                        </span>
                        <h3 className="font-bold text-slate-800 mt-2">{task.clientName}</h3>
                        <p className="text-sm text-slate-600 mt-1 mb-2">{task.reminderText}</p>
                      </div>
                      
                      {/* NOWY UKŁAD PRZYCISKÓW */}
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleOpenClientFromTask(task.clientId)}
                          className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors text-xs shadow-sm"
                        >
                          Otwórz kartę
                        </button>
                        <button
                          onClick={() => handleCompleteTask(task.id!)}
                          className="flex-1 py-2 bg-white hover:bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 rounded-xl transition-colors text-xs"
                        >
                          ✓ Zrobione
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">
                  {viewClient ? 'Karta Klienta' : showForm ? (editClient ? 'Edycja Klienta' : 'Nowy Klient') : 'Twoi Klienci'}
                </h2>
                <p className="text-slate-500 text-sm">
                  {viewClient ? viewClient.companyName
                    : showForm ? 'Wypełnij formularz poniżej'
                    : 'Zarządzaj swoją bazą relacji biznesowych'}
                </p>
              </div>
              {viewClient ? (
                <button
                  onClick={() => { setViewClient(null); loadTasks(); }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2"
                >
                  ← Wróć do listy
                </button>
              ) : (
                <button
                  onClick={showForm ? () => setShowForm(false) : handleAddClick}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                >
                  {showForm ? '✕ Zamknij' : '＋ Dodaj klienta'}
                </button>
              )}
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4 text-sm">⚠️ {error}</div>}
            {submitError && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4 text-sm">⚠️ {submitError}</div>}

            {loading ? (
              <div className="text-center text-slate-500 py-16 font-bold animate-pulse">Ładowanie danych z bazy...</div>
            ) : showForm ? (
              <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
                <ClientForm onSubmit={handleSubmit} onCancel={() => setShowForm(false)} initial={editClient} onDelete={async (id) => { await removeClient(id); setShowForm(false); setEditClient(null); }} />
              </div>
            ) : viewClient ? (
              <ClientCard
                client={viewClient}
                onClose={() => { setViewClient(null); loadTasks(); }}
                onDelete={async (id) => { await removeClient(id); setViewClient(null); loadTasks(); }}
              />
            ) : (
              <ClientList clients={clients} onEdit={handleEditClick} onDelete={removeClient} onView={handleViewClick} invoiceInfo={invoiceInfo} />
            )}
          </>
        )}

        {activeTab === 'addresses' && (
          <div className="animate-in fade-in duration-300">
            <AddressesView clients={clients} />
          </div>
        )}

        {activeTab === 'promotions' && (
          <div className="animate-in fade-in duration-300">
            <PromotionsPanel />
          </div>
        )}

        {activeTab === 'products' && (
          <div className="animate-in fade-in duration-300">
            <ProductsPanel />
          </div>
        )}
        {activeTab === 'notes' && (
          <NotesBoard />
        )}
        {activeTab === 'foam' && (
          <FoamStockPanel />
        )}
        {activeTab === 'mail' && (
          <div className="animate-in fade-in duration-300">
            <EmailTemplatesPanel />
          </div>
        )}
        {activeTab === 'suppliers' && (
          <div className="animate-in fade-in duration-300">
            <SuppliersPanel />
          </div>
        )}

        {activeTab === 'calculations' && (
          <div className="animate-in fade-in duration-300">
            <CalculationsPanel />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="animate-in fade-in duration-300">
            <AnalyticsPanel />
          </div>
        )}
        {activeTab === 'archive' && (
          <div className="animate-in fade-in duration-300">
            <ArchivePanel />
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;