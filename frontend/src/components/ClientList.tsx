import React, { useState } from 'react';
import { Client, fakturowniaSyncAll, FakturowniaSyncSummary } from '../services/api';
import NipBadge from './NipBadge';
import { vatKey } from '../utils/nip';

type ExtendedClient = Client & { relationshipColor?: string };

type InvoiceInfo = Record<string, { count: number; lastIssueDate: string; net: number }>;

// Stan widoku listy (filtry + strona) mieszka w Dashboardzie, bo ClientList jest
// odmontowywany na czas karty klienta — trzymany lokalnie resetowalby sie do strony 1.
export interface ClientListView {
  search: string;
  provinceFilter: string;
  sortBy: string;
  currentPage: number;
}

export const emptyClientListView = (): ClientListView => ({
  search: '',
  provinceFilter: '',
  sortBy: 'alpha',
  currentPage: 1,
});

interface ClientListProps {
  clients: ExtendedClient[];
  onEdit: (client: ExtendedClient) => void;
  onDelete?: (id: string) => void;
  onView: (client: ExtendedClient) => void;
  invoiceInfo?: InvoiceInfo;
  onRefreshInvoices?: () => void;
  invoiceLoading?: boolean;
  onInvoicesSynced?: () => void;
  view: ClientListView;
  onViewChange: (next: ClientListView) => void;
}

// Sygnał „wymaga uwagi": w Fakturowni jest faktura nowsza niż ostatni kontakt w CRM.
const needsAttention = (client: Client, info?: InvoiceInfo): string => {
  const nip = vatKey(client.nip);
  const fk = nip && info ? info[nip] : undefined;
  if (!fk || fk.count === 0 || !fk.lastIssueDate) return '';
  const lastContact = (client.lastContactAt || '').slice(0, 10);
  if (fk.lastIssueDate > lastContact) {
    return `Faktura z ${fk.lastIssueDate} nowsza niż ostatni kontakt${lastContact ? ` (${lastContact})` : ''} — pobierz z Fakturowni i odnotuj`;
  }
  return '';
};

const PROVINCES = [
  'Dolnośląskie', 'Kujawsko-pomorskie', 'Lubelskie', 'Lubuskie',
  'Łódzkie', 'Małopolskie', 'Mazowieckie', 'Opolskie',
  'Podkarpackie', 'Podlaskie', 'Pomorskie', 'Śląskie',
  'Świętokrzyskie', 'Warmińsko-mazurskie', 'Wielkopolskie', 'Zachodniopomorskie'
];

const PAGE_SIZE = 20;

// NOWE: Kolorujemy całe tło fiszki zamiast samej ramki
const getCardStyle = (colorId?: string) => {
  switch (colorId) {
    case 'blue': return 'bg-blue-50 border-blue-200';
    case 'emerald': return 'bg-emerald-50 border-emerald-200';
    case 'rose': return 'bg-rose-50 border-rose-200';
    case 'slate': 
    default: return 'bg-white border-slate-200';
  }
};

const ClientList: React.FC<ClientListProps> = ({ clients, onEdit, onView, invoiceInfo, onRefreshInvoices, invoiceLoading, onInvoicesSynced, view, onViewChange }) => {
  const { search, provinceFilter, sortBy, currentPage } = view;

  // Hurtowe pobranie faktur z Fakturowni do Historii Kontaktów wszystkich klientów.
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncSummary, setSyncSummary] = useState<FakturowniaSyncSummary | null>(null);

  const handleSyncAll = async () => {
    if (!window.confirm('Pobrać faktury z Fakturowni dla wszystkich klientów?\n\nNowe faktury zostaną dopisane do Historii Kontaktów (klienci dopasowani po NIP). Faktury już odnotowane są pomijane.')) return;
    setSyncing(true); setSyncError(''); setSyncSummary(null);
    try {
      setSyncSummary(await fakturowniaSyncAll());
      onInvoicesSynced?.();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Błąd aktualizacji z Fakturowni');
    } finally {
      setSyncing(false);
    }
  };

  // Zmiana filtra/sortowania cofa na pierwszą stronę; samo przewijanie stron jej nie rusza.
  const setFilters = (patch: Partial<ClientListView>) =>
    onViewChange({ ...view, ...patch, currentPage: 1 });
  const goToPage = (page: number) => onViewChange({ ...view, currentPage: page });

  let processed = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = (c.companyName ?? '').toLowerCase().includes(q) ||
                        (c.contactPerson ?? '').toLowerCase().includes(q) ||
                        (c.email ?? '').toLowerCase().includes(q) ||
                        (c.phone ?? '').toLowerCase().includes(q);
    const matchProvince = provinceFilter === '' ? true : c.address?.province === provinceFilter;
    return matchSearch && matchProvince;
  });

  processed.sort((a, b) => {
    if (sortBy === 'alpha') return (a.companyName || '').localeCompare(b.companyName || '');
    if (sortBy === 'type') return (a.type || '').localeCompare(b.type || '');
    if (sortBy === 'oldest') {
      const dateA = new Date(a.lastContactAt || a.createdAt).getTime();
      const dateB = new Date(b.lastContactAt || b.createdAt).getTime();
      return dateA - dateB;
    }
    return 0;
  });

  const totalPages = Math.ceil(processed.length / PAGE_SIZE) || 1;
  // Gdy lista sie skurczy (usuniety klient, wezszy filtr), zapamietana strona moze
  // wypasc poza zakres — pokazujemy wtedy ostatnia istniejaca zamiast pustki.
  const page = Math.min(Math.max(currentPage, 1), totalPages);
  const paginated = processed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const renderDaysCounter = (client: Client) => {
    const dateToUse = client.lastContactAt || client.createdAt;
    if (!dateToUse) return null;
    const diffTime = new Date().getTime() - new Date(dateToUse).getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 45) return <span className="text-red-600 font-bold ml-2">({diffDays})</span>;
    if (diffDays > 21) return <span className="text-orange-500 font-bold ml-2">({diffDays})</span>;
    return <span className="text-slate-500 font-normal ml-2">({diffDays})</span>;
  };

  return (
    <div>
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 animate-in fade-in">
        <div className="flex-1">
          <input type="text" placeholder="Szukaj (nazwa, osoba, e-mail, telefon)..." className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" value={search} onChange={(e) => setFilters({ search: e.target.value })} />
        </div>
        <div className="w-full md:w-1/4">
          <select className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 cursor-pointer" value={provinceFilter} onChange={(e) => setFilters({ provinceFilter: e.target.value })}>
            <option value="">Wszystkie województwa</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="w-full md:w-1/4">
          <select className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 cursor-pointer" value={sortBy} onChange={(e) => setFilters({ sortBy: e.target.value })}>
            <option value="alpha">🔤 Alfabetycznie (A-Z)</option>
            <option value="oldest">⏳ Od najstarszego kontaktu</option>
            <option value="type">🏢 Według kategorii</option>
          </select>
        </div>
        {onRefreshInvoices && (
          <button
            type="button"
            onClick={onRefreshInvoices}
            disabled={invoiceLoading}
            title="Odśwież dane faktur z Fakturowni — sygnał wymaga uwagi"
            className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold disabled:opacity-60 whitespace-nowrap"
          >
            {invoiceLoading ? '⏳ Odświeżam…' : '↻ Odśwież faktury'}
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={syncing}
            className="bg-slate-900 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
          >
            {syncing ? '⏳ Pobieram faktury z Fakturowni…' : '🔄 Pobierz faktury wszystkich klientów'}
          </button>
          {syncError && <span className="text-sm text-rose-700">⚠️ {syncError}</span>}
        </div>
        {syncSummary && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-slate-700 space-y-2">
            <div className="flex justify-between items-start gap-3">
              <p className="font-bold text-emerald-800">
                ✓ Klienci z fakturami: {syncSummary.updatedClients} · nowe wpisy w historii: {syncSummary.newInteractions}
              </p>
              <button type="button" onClick={() => setSyncSummary(null)} className="text-slate-400 hover:text-slate-700 font-bold" aria-label="Zamknij podsumowanie">✕</button>
            </div>
            <p className="text-slate-500">
              Pobrano z Fakturowni {syncSummary.invoicesFetched} faktur na materace, dopasowano {syncSummary.invoicesMatched}
              {syncSummary.invoicesWithoutNip > 0 && ` (${syncSummary.invoicesWithoutNip} bez NIP nabywcy)`}.
            </p>
            {syncSummary.noNip.length > 0 && (
              <details>
                <summary className="cursor-pointer">Klienci bez NIP w CRM: <strong>{syncSummary.noNip.length}</strong></summary>
                <p className="mt-1 text-slate-500">{syncSummary.noNip.join(', ')}</p>
              </details>
            )}
            {syncSummary.noInvoices.length > 0 && (
              <details>
                <summary className="cursor-pointer">Klienci z NIP, bez faktur w Fakturowni: <strong>{syncSummary.noInvoices.length}</strong></summary>
                <p className="mt-1 text-slate-500">{syncSummary.noInvoices.join(', ')}</p>
              </details>
            )}
            {syncSummary.unmatchedBuyers.length > 0 && (
              <details>
                <summary className="cursor-pointer">Nabywcy z faktur, których nie ma w CRM: <strong>{syncSummary.unmatchedBuyers.length}</strong></summary>
                <ul className="mt-1 text-slate-500">
                  {syncSummary.unmatchedBuyers.map(b => (
                    <li key={b.nip}>{b.name || '(brak nazwy)'} · NIP {b.nip} · faktur: {b.count}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {paginated.map((client) => (
          <div 
            key={client.id} 
            className={`p-5 rounded-2xl border shadow-sm hover:shadow-md transition-shadow group relative flex flex-col h-full ${getCardStyle(client.relationshipColor)}`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${
                  client.type === 'hurt' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}>
                  {client.type}
                </span>
                <NipBadge nip={client.nip} size={16} />
                {(() => {
                  const reason = needsAttention(client, invoiceInfo);
                  return reason ? (
                    <span title={reason} className="text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-300 cursor-help">
                      ⚠️ Uwaga
                    </span>
                  ) : null;
                })()}
              </div>
              <button onClick={() => onEdit(client)} className="text-sm text-slate-400 hover:text-blue-600 font-semibold transition-colors">✎ Edytuj</button>
            </div>
            
            <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors flex items-center flex-wrap">
              {client.companyName}
              {renderDaysCounter(client)}
            </h3>
            <p className="text-slate-600 text-sm mb-4">👤 {client.contactPerson || 'Brak osoby kontaktowej'}</p>
            
            <div className="space-y-2 mb-6 flex-grow">
              <div className="flex items-center gap-2 text-xs text-slate-700"><span>📍</span><span>{client.address?.city || 'Brak miasta'}, {client.address?.province || 'Brak woj.'}</span></div>
              <div className="flex items-center gap-2 text-xs text-slate-700"><span>📞</span><span>{client.phone || 'Brak telefonu'}</span></div>
            </div>

            <button onClick={() => onView(client)} className="w-full mt-auto py-2 bg-white/60 hover:bg-white text-slate-800 text-sm font-semibold rounded-xl transition-colors border border-black/5">
              Otwórz kartę klienta
            </button>
          </div>
        ))}
        {paginated.length === 0 && <div className="col-span-full bg-white p-8 rounded-2xl text-center text-slate-500 border border-slate-200 border-dashed">Brak wyników wyszukiwania.</div>}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 bg-white py-3 px-6 rounded-2xl border border-slate-200 w-max mx-auto shadow-sm">
          <button disabled={page === 1} onClick={() => goToPage(page - 1)} className="text-slate-500 hover:text-blue-600 font-bold disabled:opacity-30">← Poprzednia</button>
          <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">Strona {page} z {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => goToPage(page + 1)} className="text-slate-500 hover:text-blue-600 font-bold disabled:opacity-30">Następna →</button>
        </div>
      )}
    </div>
  );
};

export default ClientList;