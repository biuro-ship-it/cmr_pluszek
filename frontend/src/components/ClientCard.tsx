import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  Client, Interaction, InteractionFormData, Product, FakturowniaInvoice,
  getClientInteractions, createClientInteraction, updateClientInteraction,
  getProductsList, createFollowUp, fakturowniaLookup, openFakturowniaPdf
} from '../services/api';
import EmailSendModal from './EmailSendModal';

type ExtendedClient = Client & { relationshipColor?: string };

// ─── Modal wysyłki produktów mailem ─────────────────────────────────────────
interface ProductEmailModalProps {
  client: ExtendedClient;
  products: Product[];
  onClose: () => void;
}

const ProductEmailModal: React.FC<ProductEmailModalProps> = ({ client, products, onClose }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emailBody, setEmailBody] = useState('');
  const [step, setStep] = useState<'select' | 'preview'>('select');

  const toggleProduct = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedProducts = products.filter(p => selected.has(p.id));

  const buildEmailBody = () => {
    const greeting = client.contactPerson ? `Dzień dobry Panie/Pani ${client.contactPerson},` : 'Dzień dobry,';
    const productLines = selectedProducts.map(p => {
      const priceStr = p.priceNetto > 0 ? `Cena netto: ${p.priceNetto.toFixed(2)} zł` : '';
      const codeStr = p.code ? `Kod: ${p.code}` : '';
      const details = [codeStr, priceStr].filter(Boolean).join(' | ');
      const imageStr = p.imageUrl ? `\nZdjęcie: ${p.imageUrl}` : '';
      return `• ${p.name}${details ? `\n  ${details}` : ''}${imageStr}`;
    }).join('\n\n');

    return `${greeting}\n\nW nawiązaniu do naszej rozmowy, przesyłam informacje o produktach z naszej oferty:\n\n${productLines}\n\nW razie pytań dotyczących cen, dostępności lub zamówienia — pozostaję do dyspozycji.\n\nPozdrawiam serdecznie,`;
  };

  const handleSend = () => {
    const subject = encodeURIComponent(`Oferta produktów — Pluszek`);
    const body = encodeURIComponent(emailBody);
    window.location.href = `mailto:${client.email}?subject=${subject}&body=${body}`;
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">{step === 'select' ? '📦 Wybierz produkty' : '✉️ Podgląd e-maila'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl">✕</button>
        </div>
        {step === 'select' && (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4">
                {products.map(p => (
                  <button key={p.id} type="button" onClick={() => toggleProduct(p.id)} className={`text-left rounded-2xl border-2 overflow-hidden transition-all ${selected.has(p.id) ? 'border-blue-500 shadow-md' : 'border-slate-200'}`}>
                    {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-28 object-cover" /> : <div className="w-full h-28 bg-slate-100 flex items-center justify-center text-3xl">📦</div>}
                    <div className="p-3"><p className="font-bold text-slate-800 text-sm leading-tight">{p.name}</p></div>
                  </button>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm text-slate-500">Wybrano: {selected.size}</span>
              <button onClick={() => { setEmailBody(buildEmailBody()); setStep('preview'); }} disabled={selected.size === 0} className="bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl disabled:opacity-40">Dalej →</button>
            </div>
          </>
        )}
        {step === 'preview' && (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={16} className="w-full border border-slate-200 rounded-xl p-4 text-sm font-mono outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-between">
              <button onClick={() => setStep('select')} className="text-slate-500 font-semibold text-sm">← Wróć</button>
              <button onClick={handleSend} className="bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2"><span>✉️</span> Otwórz w kliencie poczty</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface ClientCardProps {
  client: ExtendedClient;
  onClose: () => void;
  onDelete?: (id: string) => void | Promise<void>;
}

const CHANNEL_ICON: Record<string, string> = { telefon: '📞', mail: '✉️', spotkanie: '🤝', inne: '📌' };
const emptyForm = (): InteractionFormData => ({ contactDate: new Date().toISOString().split('T')[0], channel: 'telefon', notes: '', tradeNotes: '', products: [] });

// ─── Hook: dyktowanie głosowe ───
const useSpeechRecognition = (onResult: (text: string) => void) => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const win = window as any;
  const isSupported = !!win.SpeechRecognition || !!win.webkitSpeechRecognition;

  const start = useCallback(() => {
    if (!isSupported) return;
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'pl-PL';
    recognition.continuous = true;
    recognition.onresult = (e: any) => {
      const transcript = Array.from({ length: e.results.length }, (_, i) => e.results[i]).slice(e.resultIndex).map((r: any) => r[0].transcript).join('');
      onResult(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }, [isSupported, onResult, win]);

  const stop = useCallback(() => { recognitionRef.current?.stop(); setListening(false); }, []);
  return { listening, isSupported, start, stop };
};

const InteractionForm: React.FC<any> = ({ initialData, products, onSave, onCancel, saveLabel, withFollowUp = false, clientId, clientName }) => {
  const [data, setData] = useState<InteractionFormData>(initialData);
  const [planFollowUp, setPlanFollowUp] = useState(false);
  const [followUpData, setFollowUpData] = useState({ dueDate: '', reminderText: '' });
  const [saving, setSaving] = useState(false);

  const { listening, isSupported, start, stop } = useSpeechRecognition((transcript) => {
    setData(prev => ({ ...prev, notes: prev.notes ? prev.notes + ' ' + transcript : transcript }));
  });

  const quillModules = { toolbar: [['bold', 'italic', 'underline', 'strike'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['clean']] };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.notes || data.notes === '<p><br></p>') {
      alert("Proszę wpisać przebieg rozmowy!");
      return;
    }
    setSaving(true);
    try {
      await onSave(data);
      if (withFollowUp && planFollowUp && followUpData.dueDate && clientId) {
        await createFollowUp(clientId, { clientName: clientName || '', dueDate: followUpData.dueDate, reminderText: followUpData.reminderText || 'Zaplanowany kontakt' });
      }
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6 animate-in slide-in-from-top-4 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Data kontaktu</label>
          <input type="date" required className="w-full bg-white border border-slate-200 rounded-xl p-3" value={data.contactDate} onChange={e => setData({ ...data, contactDate: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Forma kontaktu</label>
          <select className="w-full bg-white border border-slate-200 rounded-xl p-3" value={data.channel} onChange={e => setData({ ...data, channel: e.target.value as any })}>
            <option value="telefon">📞 Telefon</option><option value="mail">✉️ E-mail</option><option value="spotkanie">🤝 Spotkanie</option><option value="inne">📌 Inne</option>
          </select>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between ml-1 mb-2">
          <label className="text-xs font-bold text-slate-500 uppercase">Przebieg rozmowy (Notatki)</label>
          {isSupported && (
            <button type="button" onClick={listening ? stop : start} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg ${listening ? 'bg-red-100 text-red-600 animate-pulse border-red-200' : 'bg-white border-slate-200 text-slate-600'}`}>
              <span className="text-base">{listening ? '⏹' : '🎤'}</span> {listening ? 'Słucham...' : 'Dyktuj (dodaje tekst)'}
            </button>
          )}
        </div>
        
        {/* REACT QUILL EDYTOR ZAMIAST TEXTAREA */}
        <div className={`bg-white rounded-xl overflow-hidden border ${listening ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-300'}`}>
          <ReactQuill theme="snow" value={data.notes} onChange={(val) => setData({...data, notes: val})} modules={quillModules} className="h-40 mb-10" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Ustalenia Cenowe / Rabaty</label>
          <textarea rows={3} className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none resize-none" placeholder="Np. Rabat 10%..." value={data.tradeNotes} onChange={e => setData({ ...data, tradeNotes: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-2 block">Zainteresowany Produktami</label>
          <div className="bg-white border border-slate-200 rounded-xl p-3 max-h-[100px] overflow-y-auto space-y-2">
            {products.map((p: any) => (
              <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded">
                <input type="checkbox" checked={data.products.includes(p.name)} onChange={() => setData(prev => ({...prev, products: prev.products.includes(p.name) ? prev.products.filter((x:any) => x !== p.name) : [...prev.products, p.name]}))} className="rounded text-blue-600" />
                <span className="text-slate-700">{p.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {withFollowUp && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 mb-4 select-none">
            <input type="checkbox" checked={planFollowUp} onChange={e => setPlanFollowUp(e.target.checked)} className="w-5 h-5 rounded text-blue-600" />
            ⏰ Zaplanuj kolejny kontakt
          </label>
          {planFollowUp && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200">
              <div className="col-span-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Kiedy zadzwonić?</label>
                <input type="date" required={planFollowUp} className="w-full mt-1 border border-slate-200 rounded-lg p-2" value={followUpData.dueDate} onChange={e => setFollowUpData({ ...followUpData, dueDate: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Notatka dla przypomnienia</label>
                <input type="text" placeholder="O co zapytać?" className="w-full mt-1 border border-slate-200 rounded-lg p-2" value={followUpData.reminderText} onChange={e => setFollowUpData({ ...followUpData, reminderText: e.target.value })} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">Anuluj</button>
        <button type="submit" disabled={saving} className="bg-blue-600 text-white font-bold px-8 py-2.5 rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-60">{saving ? 'Zapisuję...' : saveLabel}</button>
      </div>
    </form>
  );
};

const getHeaderColor = (colorId?: string) => {
  switch (colorId) {
    case 'blue': return 'bg-blue-50 border-blue-200';
    case 'emerald': return 'bg-emerald-50 border-emerald-200';
    case 'rose': return 'bg-rose-50 border-rose-200';
    case 'slate': default: return 'bg-white border-slate-100';
  }
};

const zlFmt = (n: number) =>
  new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fkStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    paid: 'Zapłacona', issued: 'Wystawiona', sent: 'Wysłana',
    partial: 'Częściowo', rejected: 'Odrzucona',
  };
  return map[status] || status || '—';
};

const ClientCard: React.FC<ClientCardProps> = ({ client, onClose, onDelete }) => {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Faktury z Fakturowni (pobierane na żywo po NIP)
  const [fkInvoices, setFkInvoices] = useState<FakturowniaInvoice[]>([]);
  const [fkSyncedAt, setFkSyncedAt] = useState('');
  const [fkLoading, setFkLoading] = useState(false);
  const [fkError, setFkError] = useState('');

  const handleFakturowniaSync = async () => {
    const nip = (client.nip || '').replace(/[-\s]/g, '');
    if (nip.length !== 10) { setFkError('Klient nie ma poprawnego NIP (wymagane 10 cyfr).'); return; }
    setFkLoading(true); setFkError('');
    try {
      const { invoices } = await fakturowniaLookup(nip);
      setFkInvoices(invoices);
      setFkSyncedAt(new Date().toISOString());

      // Dopisz nowe faktury do Historii Kontaktów (dedup po numerze faktury).
      const existingNumbers = new Set(
        interactions
          .map(i => i.notes?.match(/Faktura\s+(.+?):/)?.[1]?.trim())
          .filter((x): x is string => Boolean(x))
      );
      const newInvoices = invoices.filter(inv => inv.number && !existingNumbers.has(inv.number));
      if (newInvoices.length > 0) {
        for (const inv of newInvoices) {
          const contactDate = /^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate)
            ? inv.issueDate
            : new Date().toISOString().split('T')[0];
          await createClientInteraction(client.id, {
            contactDate,
            channel: 'inne',
            notes: `🧾 Faktura ${inv.number}: ${zlFmt(inv.priceNet)} zł netto`,
            tradeNotes: '',
            products: [],
          });
        }
        const refreshed = await getClientInteractions(client.id);
        setInteractions(refreshed);
      }
    } catch (e) {
      setFkError(e instanceof Error ? e.message : 'Błąd synchronizacji z Fakturownią');
    } finally {
      setFkLoading(false);
    }
  };

  const handleOpenPdf = async (id: number) => {
    try { await openFakturowniaPdf(id); }
    catch { alert('Nie udało się otworzyć PDF faktury.'); }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [interactionsData, productsData] = await Promise.all([getClientInteractions(client.id), getProductsList()]);
        setInteractions(interactionsData); setProducts(productsData);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchData();
  }, [client.id]);

  const handleAddSave = async (data: InteractionFormData) => {
    const newInteraction = await createClientInteraction(client.id, data);
    setInteractions(prev => [newInteraction, ...prev]);
    setShowAddForm(false);
  };

  const handleEditSave = async (interactionId: string, data: InteractionFormData) => {
    const updated = await updateClientInteraction(client.id, interactionId, data);
    setInteractions(prev => prev.map(i => i.id === interactionId ? updated : i));
    setEditingId(null);
  };

  return (
    <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 animate-in fade-in duration-300 overflow-hidden">
      <div className="mb-6 flex items-center justify-between gap-4">
        <button onClick={onClose} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors">
          <span>←</span> Wróć do listy klientów
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={async () => {
              if (window.confirm(`Usunąć klienta "${client.companyName}"? Tej operacji nie można cofnąć.`)) {
                await onDelete(client.id);
                onClose();
              }
            }}
            className="bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold text-sm px-4 py-2 transition-colors"
          >
            🗑 Usuń klienta
          </button>
        )}
      </div>

      {/* Dynamiczny, kolorowy nagłówek karty */}
      <div className={`flex flex-col md:flex-row justify-between items-start border-b pb-6 mb-6 gap-4 p-6 -mx-8 -mt-2 rounded-t-2xl ${getHeaderColor(client.relationshipColor)}`}>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-black text-slate-800">{client.companyName}</h2>
            <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${client.type === 'hurt' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {client.type}
            </span>
          </div>
          <p className="text-slate-600 font-medium">Osoba kontaktowa: <span className="text-slate-900 font-bold">{client.contactPerson || 'Brak'}</span></p>
        </div>
        <div className="text-sm text-slate-600 bg-white/60 p-4 rounded-2xl md:text-right w-full md:w-auto shadow-sm backdrop-blur-sm">
          <p className="flex items-center gap-2 md:justify-end mb-1"><span>📞</span><a href={`tel:${client.phone}`} className="hover:text-blue-600 font-bold">{client.phone || 'Brak'}</a></p>
          <p className="flex items-center gap-2 md:justify-end"><span>✉️</span><a href={`mailto:${client.email}`} className="hover:text-blue-600 font-bold">{client.email || 'Brak'}</a></p>
          <p className="flex items-center gap-2 md:justify-end mt-2 text-xs"><span>📍</span> {client.address?.city}, {client.address?.street}</p>
          {client.email && (
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={() => setShowEmailModal(true)} className="w-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold py-2.5 px-4 rounded-xl text-xs flex justify-center gap-2"><span className="text-base">📦</span> Wyślij ofertę produktów</button>
              <button onClick={() => setShowTemplateModal(true)} className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-2.5 px-4 rounded-xl text-xs flex justify-center gap-2"><span className="text-base">✉️</span> Wyślij mail z szablonu</button>
            </div>
          )}
        </div>
      </div>

      {/* FAKTURY Z FAKTUROWNI (tylko odczyt) */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <h3 className="text-xl font-bold text-slate-800">🧾 Faktury (Fakturownia)</h3>
          <div className="flex items-center gap-3 flex-wrap">
            {fkSyncedAt && (
              <span className="text-xs text-slate-400">zsync.: {new Date(fkSyncedAt).toLocaleString('pl-PL')}</span>
            )}
            <button
              type="button"
              onClick={handleFakturowniaSync}
              disabled={fkLoading}
              className="bg-slate-900 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
            >
              {fkLoading ? 'Pobieram…' : (fkSyncedAt ? '↻ Odśwież' : '⬇ Pobierz z Fakturowni')}
            </button>
          </div>
        </div>
        {fkError && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-3 mb-4">⚠️ {fkError}</div>}
        {fkInvoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
            {fkSyncedAt ? 'Brak faktur dla tego klienta w Fakturowni.' : 'Kliknij „Pobierz z Fakturowni" (wymaga NIP na karcie klienta).'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 bg-slate-50 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold">Numer</th>
                  <th className="py-2.5 px-3 font-semibold">Data</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Netto</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Brutto</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {fkInvoices.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium text-slate-800">{inv.number}</td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{inv.issueDate}</td>
                    <td className="py-2 px-3 text-right font-mono whitespace-nowrap">{zlFmt(inv.priceNet)} {inv.currency}</td>
                    <td className="py-2 px-3 text-right font-mono whitespace-nowrap text-slate-500">{zlFmt(inv.priceGross)} {inv.currency}</td>
                    <td className="py-2 px-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{fkStatusLabel(inv.status)}</span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button type="button" onClick={() => handleOpenPdf(inv.id)} className="text-blue-600 hover:underline font-bold text-xs">PDF</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-400 px-3 py-2 bg-slate-50 border-t border-slate-100">
              Faktur: {fkInvoices.length} · suma netto: {zlFmt(fkInvoices.reduce((s, i) => s + i.priceNet, 0))} zł
            </p>
          </div>
        )}
      </div>

      {/* Historia kontaktów */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800">Historia Kontaktów</h3>
          <button onClick={() => { setShowAddForm(v => !v); setEditingId(null); }} className="bg-slate-900 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
            {showAddForm ? '✕ Anuluj' : '+ Dodaj notatkę z rozmowy'}
          </button>
        </div>

        {showAddForm && <InteractionForm initialData={emptyForm()} products={products} onSave={handleAddSave} onCancel={() => setShowAddForm(false)} saveLabel="Zapisz notatkę" withFollowUp clientId={client.id} clientName={client.companyName} />}

        {loading ? <p className="text-slate-400 text-center py-8">Ładowanie historii...</p> : interactions.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-100 border-dashed"><span className="text-4xl block mb-3">📭</span><p className="text-slate-500 font-medium">Brak wpisów w historii.</p></div>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            {interactions.map(interaction => (
              <div key={interaction.id} className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-xl mt-1">{CHANNEL_ICON[interaction.channel] ?? '📌'}</div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)]">
                  {editingId === interaction.id ? (
                    <InteractionForm initialData={{ contactDate: interaction.contactDate, channel: interaction.channel, notes: interaction.notes, tradeNotes: interaction.tradeNotes ?? '', products: interaction.products ?? [] }} products={products} onSave={(data: any) => handleEditSave(interaction.id, data)} onCancel={() => setEditingId(null)} saveLabel="Zapisz zmiany" />
                  ) : (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-black text-slate-800">{interaction.contactDate}</span>
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setEditingId(interaction.id); setShowAddForm(false); }} className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1">✎ Edytuj</button>
                        </div>
                      </div>
                      {/* Wyświetlanie sformatowanego tekstu z Quill */}
                      <div className="text-slate-700 text-sm mb-3 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: interaction.notes }} />
                      
                      {(interaction.tradeNotes || (interaction.products && interaction.products.length > 0)) && (
                        <div className="mt-4 pt-4 border-t border-slate-100 text-xs">
                          {interaction.tradeNotes && <p className="mb-2"><span className="font-bold text-slate-500">💰 Ustalenia:</span> {interaction.tradeNotes}</p>}
                          {interaction.products && interaction.products.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1"><span className="font-bold text-slate-500 mr-1 mt-1">📦 Produkty:</span>{interaction.products.map((p, i) => <span key={i} className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100">{p}</span>)}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showEmailModal && <ProductEmailModal client={client} products={products} onClose={() => setShowEmailModal(false)} />}
      {showTemplateModal && <EmailSendModal client={client} onClose={() => setShowTemplateModal(false)} />}
    </div>
  );
};

export default ClientCard;