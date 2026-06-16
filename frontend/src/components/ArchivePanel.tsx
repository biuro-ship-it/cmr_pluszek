import React, { useState } from 'react';
import { getArchive, ArchiveData } from '../services/api';

// Pomocniczo: wymusza pobranie pliku z Bloba.
const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const flatAddress = (a: any, prefix = '') => a ? {
  [`${prefix}Ulica`]: a.street ?? '',
  [`${prefix}Nr`]: a.number ?? '',
  [`${prefix}Miasto`]: a.city ?? '',
  [`${prefix}Kod`]: a.zipCode ?? '',
  [`${prefix}Województwo`]: a.province ?? '',
} : {};

const yesNo = (v: any) => (v ? 'Tak' : 'Nie');

// Buduje wieloarkuszowy skoroszyt Excel z zagnieżdżonego archiwum.
const buildWorkbook = (XLSX: typeof import('xlsx'), data: ArchiveData) => {
  const wb = XLSX.utils.book_new();
  const addSheet = (rows: any[], name: string) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  addSheet(data.clients.map(c => ({
    Firma: c.companyName ?? '',
    Typ: c.type ?? '',
    NIP: c.nip ?? '',
    Osoba: c.contactPerson ?? '',
    Email: c.email ?? '',
    Telefon: c.phone ?? '',
    ...flatAddress(c.address),
    ...flatAddress(c.shippingAddress, 'Wysyłka '),
    'Ostatni kontakt': c.lastContactAt ?? '',
    Utworzono: c.createdAt ?? '',
  })), 'Klienci');

  addSheet(data.interactions.map(i => ({
    Klient: i.clientName ?? '',
    Data: i.contactDate ?? '',
    Kanał: i.channel ?? '',
    Notatka: (i.notes ?? '').replace(/<[^>]+>/g, ' ').trim(),
    Ustalenia: i.tradeNotes ?? '',
    Produkty: Array.isArray(i.products) ? i.products.join(', ') : '',
    Autor: i.createdBy ?? '',
  })), 'Kontakty');

  addSheet(data.products.map(p => ({
    Nazwa: p.name ?? '',
    Kod: p.code ?? '',
    'Cena netto': p.priceNetto ?? '',
    Zdjęcie: p.imageUrl ?? '',
    Utworzono: p.createdAt ?? '',
  })), 'Produkty');

  addSheet(data.promotions.map(p => ({
    Klienci: Array.isArray(p.clientNames) ? p.clientNames.join(', ') : '',
    Produkty: Array.isArray(p.products) ? p.products.map((x: any) => x.name).join(', ') : '',
    'Typ rabatu': p.discountType ?? '',
    'Wartość rabatu': p.discountValue ?? '',
    Temat: p.emailSubject ?? '',
    Status: p.status ?? '',
    'Zaplanowano na': p.scheduledFor ?? '',
    Wysłano: p.sentAt ?? '',
    Utworzono: p.createdAt ?? '',
  })), 'Promocje');

  addSheet(data.notes.map(n => ({
    Tytuł: n.title ?? '',
    Treść: (n.content ?? '').replace(/<[^>]+>/g, ' ').trim(),
    Ważne: yesNo(n.isImportant),
    Pilne: yesNo(n.isUrgent),
    Data: n.date ?? '',
  })), 'Notatki');

  addSheet(data.foamStock.map(f => ({
    Kolor: f.name ?? '',
    Hex: f.hex ?? '',
    Ilość: f.quantity ?? 0,
    'Próg minimalny': f.minQuantity ?? 0,
  })), 'Pianki');

  addSheet(data.foamMovements.map(m => ({
    Kolor: m.foamName ?? '',
    Zmiana: m.delta ?? '',
    Powód: m.reason ?? '',
    'Stan po': m.resultingQuantity ?? '',
    Kto: m.by ?? '',
    Kiedy: m.at ?? '',
  })), 'Ruchy pianek');

  addSheet(data.followups.map(f => ({
    Klient: f.clientName ?? '',
    Termin: f.dueDate ?? '',
    Przypomnienie: f.reminderText ?? '',
    Status: f.status ?? '',
    Utworzono: f.createdAt ?? '',
  })), 'Przypomnienia');

  return wb;
};

const ArchivePanel: React.FC = () => {
  const [loading, setLoading] = useState<null | 'json' | 'xlsx'>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const handleJson = async () => {
    setError(null);
    setLoading('json');
    try {
      const data = await getArchive();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      triggerDownload(blob, `crm-backup-${today}.json`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać archiwum');
    } finally {
      setLoading(null);
    }
  };

  const handleExcel = async () => {
    setError(null);
    setLoading('xlsx');
    try {
      const data = await getArchive();
      const XLSX = await import('xlsx'); // ładowane dynamicznie — nie powiększa głównego bundla
      const wb = buildWorkbook(XLSX, data);
      XLSX.writeFile(wb, `crm-backup-${today}.xlsx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się przygotować Excela');
    } finally {
      setLoading(null);
    }
  };

  const ITEMS = [
    { icon: '🏢', label: 'Klienci i karty klientów' },
    { icon: '💬', label: 'Historia kontaktów (notatki z rozmów)' },
    { icon: '📦', label: 'Produkty' },
    { icon: '📢', label: 'Promocje' },
    { icon: '📝', label: 'Notatki' },
    { icon: '🎨', label: 'Pianki + ruchy magazynowe' },
    { icon: '⏰', label: 'Przypomnienia (follow-upy)' },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-slate-900">Archiwum danych</h2>
        <p className="text-slate-500 text-sm mt-1">Pobierz kompletną kopię bazy na swój komputer — jako zabezpieczenie.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4">⚠️ {error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-2xl">
        <p className="text-sm font-bold text-slate-700 mb-3">Kopia obejmuje:</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          {ITEMS.map(it => (
            <li key={it.label} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="text-base">{it.icon}</span> {it.label}
            </li>
          ))}
        </ul>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleJson}
            disabled={loading !== null}
            className="flex-1 bg-slate-900 hover:bg-blue-600 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loading === 'json' ? '⏳ Przygotowuję...' : '⬇️ Pobierz kopię (JSON)'}
          </button>
          <button
            onClick={handleExcel}
            disabled={loading !== null}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loading === 'xlsx' ? '⏳ Przygotowuję...' : '📊 Pobierz Excel (.xlsx)'}
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-4 leading-relaxed">
          <strong>JSON</strong> to pełna, kompletna kopia (do odtworzenia w razie awarii).{' '}
          <strong>Excel</strong> to czytelne tabele do otwarcia i przeglądania. Plik zapisuje się jako <code>crm-backup-{today}</code>.
        </p>
      </div>
    </div>
  );
};

export default ArchivePanel;
