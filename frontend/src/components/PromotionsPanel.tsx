import React, { useState, useEffect, useCallback } from 'react';
import {
  Client, Product, Promotion, PromotionProduct, PromotionFormData,
  getClients, getProductsList, getPromotions, createPromotion,
  updatePromotionStatus, deletePromotion,
} from '../services/api';

// ─── Pomocnicze ─────────────────────────────────────────────────────────────

type Step = 'clients' | 'products' | 'discount' | 'template' | 'preview' | 'history';

const STEP_LABELS: Record<Step, string> = {
  clients: '1. Klienci',
  products: '2. Produkty',
  discount: '3. Rabat',
  template: '4. Szablon',
  preview: '5. Podgląd',
  history: 'Historia',
};

const buildEmailBody = (
  products: PromotionProduct[],
  discountType: 'none' | 'percent' | 'flat',
  discountValue: number
): string => {
  const discountLine =
    discountType === 'percent' && discountValue > 0
      ? `\n🎁 Specjalna promocja: ${discountValue}% rabatu na wszystkie produkty z tej oferty!\n`
      : discountType === 'flat' && discountValue > 0
      ? `\n🎁 Specjalna promocja: ${discountValue} zł rabatu na zamówienie!\n`
      : '';

  const productLines = products
    .map(p => {
      const price =
        p.priceNetto && p.priceNetto > 0
          ? discountType === 'percent' && discountValue > 0
            ? `Cena: ${(p.priceNetto * (1 - discountValue / 100)).toFixed(2)} zł netto (po rabacie ${discountValue}%)`
            : discountType === 'flat'
            ? `Cena netto: ${p.priceNetto.toFixed(2)} zł`
            : `Cena netto: ${p.priceNetto.toFixed(2)} zł`
          : '';
      const code = p.code ? `Kod: ${p.code}` : '';
      const details = [code, price].filter(Boolean).join(' | ');
      return `• ${p.name}${details ? `\n  ${details}` : ''}`;
    })
    .join('\n\n');

  return `Dzień dobry,

W nawiązaniu do naszej współpracy, mamy przyjemność przedstawić Państwu aktualną ofertę produktów:
${discountLine}
${productLines}

Zapraszamy do składania zamówień. W razie pytań dotyczących dostępności lub warunków — jesteśmy do dyspozycji.

Pozdrawiam serdecznie,`;
};

// ─── Główny panel ─────────────────────────────────────────────────────────────

const PromotionsPanel: React.FC = () => {
  const [step, setStep] = useState<Step>('history');

  // Dane
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Formularz
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'flat'>('none');
  const [discountValue, setDiscountValue] = useState(0);
  const [emailSubject, setEmailSubject] = useState('Oferta produktów — Pluszek');
  const [emailBody, setEmailBody] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p, promo] = await Promise.all([getClients(), getProductsList(), getPromotions()]);
      setClients(c);
      setProducts(p);
      setPromotions(promo);
    } catch {
      setError('Nie udało się załadować danych');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-generuj treść maila gdy zmienią się produkty lub rabat
  useEffect(() => {
    const selected = products.filter(p => selectedProductIds.has(p.id));
    const promos: PromotionProduct[] = selected.map(p => ({
      id: p.id, name: p.name, code: p.code,
      priceNetto: p.priceNetto, imageUrl: p.imageUrl,
    }));
    if (promos.length > 0) {
      setEmailBody(buildEmailBody(promos, discountType, discountValue));
    }
  }, [selectedProductIds, discountType, discountValue, products]);

  const selectedClients = clients.filter(c => selectedClientIds.has(c.id));
  const selectedProducts = products.filter(p => selectedProductIds.has(p.id));
  const filteredClients = clients.filter(c =>
    clientSearch === '' || c.companyName.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleSend = async (sendNow: boolean) => {
    setSaving(true);
    setError('');
    try {
      const promos: PromotionProduct[] = selectedProducts.map(p => ({
        id: p.id, name: p.name, code: p.code,
        priceNetto: p.priceNetto, imageUrl: p.imageUrl,
      }));

      const data: PromotionFormData = {
        clientIds: Array.from(selectedClientIds),
        clientNames: selectedClients.map(c => c.companyName),
        products: promos,
        discountType,
        discountValue,
        emailSubject,
        emailBody,
        scheduledFor: scheduledFor || null,
        status: sendNow ? 'sent' : scheduledFor ? 'scheduled' : 'draft',
      };

      await createPromotion(data);

      if (sendNow) {
        // Otwórz klienta pocztowego z BCC
        const bcc = selectedClients.map(c => c.email).filter(Boolean).join(',');
        const subject = encodeURIComponent(emailSubject);
        const body = encodeURIComponent(emailBody);
        window.location.href = `mailto:?bcc=${bcc}&subject=${subject}&body=${body}`;
      }

      // Reset i powrót do historii
      setSelectedClientIds(new Set());
      setSelectedProductIds(new Set());
      setDiscountType('none');
      setDiscountValue(0);
      setEmailSubject('Oferta produktów — Pluszek');
      setEmailBody('');
      setScheduledFor('');
      setStep('history');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd podczas zapisywania promocji');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkSent = async (id: string) => {
    try {
      await updatePromotionStatus(id, 'sent');
      setPromotions(prev => prev.map(p => p.id === id ? { ...p, status: 'sent', sentAt: new Date().toISOString() } : p));
    } catch { setError('Błąd zmiany statusu'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePromotion(id);
      setPromotions(prev => prev.filter(p => p.id !== id));
      setDeleteConfirm(null);
    } catch { setError('Błąd usuwania'); }
  };

  const canProceedFromClients = selectedClientIds.size > 0;
  const canProceedFromProducts = selectedProductIds.size > 0;

  if (loading) return (
    <div className="text-center text-slate-400 py-16 animate-pulse">Ładowanie promocji...</div>
  );

  // ─── STEPPER HEADER ──────────────────────────────────────────────────────

  const NEW_STEPS: Step[] = ['clients', 'products', 'discount', 'template', 'preview'];

  return (
    <div>
      {/* Nagłówek */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">📢 Promocje</h2>
          <p className="text-slate-500 text-sm mt-1">
            {step === 'history'
              ? `${promotions.length} wysłanych / zaplanowanych`
              : 'Utwórz nową wysyłkę promocyjną'}
          </p>
        </div>
        {step === 'history' ? (
          <button
            onClick={() => setStep('clients')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
          >
            ＋ Nowa promocja
          </button>
        ) : (
          <button
            onClick={() => setStep('history')}
            className="text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1"
          >
            ✕ Anuluj
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Stepper (tylko w trybie tworzenia) */}
      {step !== 'history' && (
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
          {NEW_STEPS.map((s, i) => {
            const idx = NEW_STEPS.indexOf(step);
            const done = i < idx;
            const active = s === step;
            return (
              <React.Fragment key={s}>
                <button
                  onClick={() => done || active ? setStep(s) : undefined}
                  disabled={!done && !active}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    active ? 'bg-blue-600 text-white shadow-sm'
                    : done ? 'bg-emerald-100 text-emerald-700 cursor-pointer'
                    : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {done ? '✓' : i + 1} {STEP_LABELS[s].replace(/^\d+\.\s/, '')}
                </button>
                {i < NEW_STEPS.length - 1 && (
                  <span className="text-slate-300 text-xs font-bold">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ── KROK 1: WYBÓR KLIENTÓW ────────────────────────────────────────── */}
      {step === 'clients' && (
        <div className="animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <p className="font-bold text-slate-700">Wybierz klientów do wysyłki</p>
                <span className="text-sm text-slate-500">Zaznaczono: {selectedClientIds.size}</span>
              </div>
              <input
                type="text"
                placeholder="Szukaj firmy..."
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500 bg-slate-50"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
              />
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
              {/* Zaznacz wszystkich */}
              <label className="flex items-center gap-3 p-4 hover:bg-blue-50 cursor-pointer bg-slate-50 border-b border-slate-100">
                <input
                  type="checkbox"
                  checked={filteredClients.length > 0 && filteredClients.every(c => selectedClientIds.has(c.id))}
                  onChange={e => {
                    if (e.target.checked) setSelectedClientIds(new Set(filteredClients.map(c => c.id)));
                    else setSelectedClientIds(new Set());
                  }}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-black text-slate-500 uppercase">
                  Zaznacz wszystkich ({filteredClients.length})
                </span>
              </label>
              {filteredClients.map(c => (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 p-4 hover:bg-blue-50 cursor-pointer transition-colors ${
                    selectedClientIds.has(c.id) ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedClientIds.has(c.id)}
                    onChange={e => {
                      const next = new Set(selectedClientIds);
                      e.target.checked ? next.add(c.id) : next.delete(c.id);
                      setSelectedClientIds(next);
                    }}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${
                        c.type === 'hurt' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>{c.type}</span>
                      <span className="font-semibold text-slate-800 text-sm truncate">{c.companyName}</span>
                    </div>
                    {c.email && <p className="text-xs text-slate-400 mt-0.5 truncate">{c.email}</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              disabled={!canProceedFromClients}
              onClick={() => setStep('products')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-40"
            >
              Dalej — wybierz produkty →
            </button>
          </div>
        </div>
      )}

      {/* ── KROK 2: WYBÓR PRODUKTÓW ───────────────────────────────────────── */}
      {step === 'products' && (
        <div className="animate-in fade-in">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => {
              const selected = selectedProductIds.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const next = new Set(selectedProductIds);
                    selected ? next.delete(p.id) : next.add(p.id);
                    setSelectedProductIds(next);
                  }}
                  className={`text-left rounded-2xl border-2 overflow-hidden transition-all ${
                    selected ? 'border-blue-500 shadow-md shadow-blue-100' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} className="w-full h-28 object-cover" />
                    : <div className="w-full h-28 bg-slate-100 flex items-center justify-center text-3xl">📦</div>
                  }
                  <div className="p-3">
                    <div className="flex justify-between items-start gap-1">
                      <p className="font-bold text-slate-800 text-xs leading-tight">{p.name}</p>
                      {selected && <span className="text-blue-600 shrink-0">✓</span>}
                    </div>
                    {p.code && <p className="text-xs text-slate-400 font-mono mt-0.5">{p.code}</p>}
                    {p.priceNetto > 0 && <p className="text-sm font-black text-slate-900 mt-1">{p.priceNetto.toFixed(2)} zł</p>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between items-center mt-4">
            <button onClick={() => setStep('clients')} className="text-slate-500 hover:text-slate-800 font-semibold text-sm">← Wróć</button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">Wybrano: {selectedProductIds.size} produktów</span>
              <button
                disabled={!canProceedFromProducts}
                onClick={() => setStep('discount')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-40"
              >
                Dalej — rabat →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── KROK 3: RABAT ────────────────────────────────────────────────── */}
      {step === 'discount' && (
        <div className="animate-in fade-in max-w-lg">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div>
              <p className="text-sm font-bold text-slate-600 mb-3">Typ rabatu</p>
              <div className="flex gap-3">
                {(['none', 'percent', 'flat'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setDiscountType(t); setDiscountValue(0); }}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                      discountType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {t === 'none' ? '🚫 Brak rabatu' : t === 'percent' ? '% Procentowy' : '💰 Kwotowy (zł)'}
                  </button>
                ))}
              </div>
            </div>
            {discountType !== 'none' && (
              <div className="animate-in fade-in">
                <p className="text-sm font-bold text-slate-600 mb-2">
                  Wartość rabatu {discountType === 'percent' ? '(%)' : '(zł)'}
                </p>
                <input
                  type="number"
                  min="0"
                  max={discountType === 'percent' ? 100 : undefined}
                  step="0.01"
                  value={discountValue}
                  onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xl font-bold text-slate-800 outline-none focus:border-blue-500"
                  placeholder="0"
                />
                {discountType === 'percent' && discountValue > 0 && (
                  <p className="text-sm text-emerald-600 mt-2">
                    Np. produkt 100 zł → <strong>{(100 * (1 - discountValue / 100)).toFixed(2)} zł</strong> po rabacie
                  </p>
                )}
              </div>
            )}

            {/* Harmonogram */}
            <div>
              <p className="text-sm font-bold text-slate-600 mb-2">Zaplanuj wysyłkę (opcjonalnie)</p>
              <input
                type="date"
                value={scheduledFor}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setScheduledFor(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-slate-700"
              />
              {scheduledFor && (
                <p className="text-xs text-blue-600 mt-1.5">
                  📅 Promocja zostanie zapisana jako zaplanowana na {scheduledFor}.
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-between mt-4">
            <button onClick={() => setStep('products')} className="text-slate-500 hover:text-slate-800 font-semibold text-sm">← Wróć</button>
            <button
              onClick={() => setStep('template')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
            >
              Dalej — szablon maila →
            </button>
          </div>
        </div>
      )}

      {/* ── KROK 4: SZABLON MAILA ─────────────────────────────────────────── */}
      {step === 'template' && (
        <div className="animate-in fade-in space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Temat wiadomości</label>
              <input
                type="text"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Treść e-maila</label>
                <button
                  type="button"
                  onClick={() => setEmailBody(buildEmailBody(
                    selectedProducts.map(p => ({ id: p.id, name: p.name, code: p.code, priceNetto: p.priceNetto, imageUrl: p.imageUrl })),
                    discountType, discountValue
                  ))}
                  className="text-xs text-blue-600 hover:underline"
                >
                  ↺ Regeneruj
                </button>
              </div>
              <textarea
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                rows={14}
                className="w-full border border-slate-200 rounded-xl p-4 text-sm text-slate-700 outline-none focus:border-blue-500 resize-none font-mono leading-relaxed"
              />
            </div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 border border-blue-100">
            <strong>Do:</strong> BCC — {selectedClients.map(c => c.email || c.companyName).join(', ')}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep('discount')} className="text-slate-500 hover:text-slate-800 font-semibold text-sm">← Wróć</button>
            <button
              onClick={() => setStep('preview')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
            >
              Dalej — podgląd →
            </button>
          </div>
        </div>
      )}

      {/* ── KROK 5: PODGLĄD I WYSYŁKA ────────────────────────────────────── */}
      {step === 'preview' && (
        <div className="animate-in fade-in space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Odbiorcy</p>
              <p className="text-2xl font-black text-slate-800">{selectedClientIds.size}</p>
              <p className="text-sm text-slate-500">klientów</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Produkty</p>
              <p className="text-2xl font-black text-slate-800">{selectedProductIds.size}</p>
              <p className="text-sm text-slate-500">w ofercie</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase mb-2">Rabat</p>
              <p className="text-2xl font-black text-slate-800">
                {discountType === 'none' ? '—' : discountType === 'percent' ? `${discountValue}%` : `${discountValue} zł`}
              </p>
              <p className="text-sm text-slate-500">{discountType === 'none' ? 'bez rabatu' : discountType === 'percent' ? 'procentowy' : 'kwotowy'}</p>
            </div>
          </div>

          {scheduledFor && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              📅 <strong>Zaplanowano na: {scheduledFor}</strong> — promocja zostanie zapisana jako &quot;Zaplanowana&quot;
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Temat: </p>
            <p className="font-bold text-slate-800 mb-4">{emailSubject}</p>
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Treść:</p>
            <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed bg-slate-50 p-4 rounded-xl">{emailBody}</pre>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <button onClick={() => setStep('template')} className="text-slate-500 hover:text-slate-800 font-semibold text-sm">← Wróć</button>
            <div className="flex gap-3">
              <button
                onClick={() => handleSend(false)}
                disabled={saving}
                className="px-5 py-2.5 border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                💾 Zapisz jako {scheduledFor ? 'zaplanowaną' : 'szkic'}
              </button>
              <button
                onClick={() => handleSend(true)}
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors disabled:opacity-40 flex items-center gap-2 shadow-lg shadow-emerald-200"
              >
                {saving ? '⏳ Zapisuję...' : '✉️ Wyślij teraz (BCC)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIA ─────────────────────────────────────────────────────── */}
      {step === 'history' && (
        <div className="space-y-4 animate-in fade-in">
          {promotions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
              <span className="text-4xl block mb-3">📢</span>
              <p className="text-slate-500 font-medium">Brak promocji. Utwórz pierwszą powyżej.</p>
            </div>
          ) : (
            promotions.map(promo => (
              <div
                key={promo.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  promo.status === 'sent' ? 'border-emerald-200' :
                  promo.status === 'scheduled' ? 'border-amber-200' : 'border-slate-200'
                }`}
              >
                <div className="p-5">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-wide ${
                          promo.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
                          promo.status === 'scheduled' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {promo.status === 'sent' ? '✓ Wysłana' : promo.status === 'scheduled' ? '📅 Zaplanowana' : '📝 Szkic'}
                        </span>
                        {promo.discountType !== 'none' && (
                          <span className="text-xs bg-rose-50 text-rose-600 font-bold px-2 py-0.5 rounded">
                            🎁 {promo.discountType === 'percent' ? `${promo.discountValue}% rabatu` : `${promo.discountValue} zł rabatu`}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-800">{promo.emailSubject}</p>
                    </div>
                    <div className="text-right text-xs text-slate-400 whitespace-nowrap">
                      <p>{new Date(promo.createdAt).toLocaleDateString('pl-PL')}</p>
                      {promo.scheduledFor && <p className="text-amber-600 font-bold">→ {promo.scheduledFor}</p>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-4">
                    <span>👥 {promo.clientNames.length} klientów: {promo.clientNames.slice(0, 3).join(', ')}{promo.clientNames.length > 3 ? ` +${promo.clientNames.length - 3}` : ''}</span>
                    <span>📦 {promo.products.length} produktów: {promo.products.slice(0, 2).map(p => p.name).join(', ')}{promo.products.length > 2 ? ` +${promo.products.length - 2}` : ''}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-400">Autor: {promo.createdBy}</p>
                    <div className="flex gap-2">
                      {promo.status === 'scheduled' && (
                        <button
                          onClick={() => handleMarkSent(promo.id)}
                          className="text-xs font-bold px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors"
                        >
                          ✓ Oznacz jako wysłaną
                        </button>
                      )}
                      {deleteConfirm === promo.id ? (
                        <>
                          <button onClick={() => handleDelete(promo.id)} className="text-xs font-bold px-3 py-1.5 bg-red-600 text-white rounded-lg">Tak, usuń</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs font-bold px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg">Anuluj</button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteConfirm(promo.id)} className="text-xs font-bold px-3 py-1.5 border border-red-100 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default PromotionsPanel;
