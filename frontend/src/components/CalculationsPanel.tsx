import { useEffect, useMemo, useState } from 'react';
import {
  Calculation, CalculationFormData, CalcComponent, TransportBracket, Supplier,
  getCalculations, createCalculation, updateCalculation, deleteCalculation, getSuppliers,
} from '../services/api';
import { ALL_UNITS, convertQuantity, parseNum, zl } from '../utils/units';

// ─── LOGIKA WYLICZEŃ ───────────────────────────────────────────────────────

// Koszt składnika na 1 szt produktu. mismatch=true → jednostki niezgodne (fallback: mnożnik wprost).
const componentCost = (c: CalcComponent): { cost: number; mismatch: boolean } => {
  if (!c.included) return { cost: 0, mismatch: false };
  const conv = convertQuantity(c.consumption, c.consumptionUnit, c.priceUnit);
  if (conv === null) return { cost: c.unitPrice * c.consumption, mismatch: true };
  return { cost: c.unitPrice * conv, mismatch: false };
};

const materialCostPerUnit = (components: CalcComponent[]): number =>
  components.reduce((sum, c) => sum + componentCost(c).cost, 0);

// Transport / szt dla pojedynczego progu:
// - 'perUnit' → koszt wpisany wprost jako cena za sztukę,
// - 'total'   → koszt całkowity rozłożony na ilość progu (maxQty).
const bracketTransportPerUnit = (b: TransportBracket): number => {
  if (b.costMode === 'perUnit') return b.cost;
  return b.maxQty > 0 ? b.cost / b.maxQty : 0;
};

// Marża handlowa (od ceny sprzedaży): cena = koszt / (1 − marża/100).
// Marża >= 100% jest niemożliwa (dzielenie przez <=0) → zwracamy 0.
const priceFromMargin = (cost: number, marginPct: number): number => {
  const divisor = 1 - marginPct / 100;
  return divisor > 0 ? cost / divisor : 0;
};

// Wycena jednego wariantu (progu transportu lub — gdy brak progów — bez transportu).
interface CalcLine {
  key: string;
  bracket: TransportBracket | null; // null = brak progów, wariant bazowy bez transportu
  qty: number;                      // ilość, na której liczymy sumy (maxQty progu / productionQty)
  transPerUnit: number;
  totalPerUnit: number;
  price1: number;
  price2: number;
}

interface CalcResult {
  matPerUnit: number;
  lines: CalcLine[];   // po jednej wycenie na każdy próg (min. 1)
  bestKey: string | null; // klucz najtańszego wariantu (najniższy koszt całkowity / szt)
}

const computeCalc = (form: CalculationFormData): CalcResult => {
  const matPerUnit = materialCostPerUnit(form.components);

  const makeLine = (bracket: TransportBracket | null): CalcLine => {
    const transPerUnit = bracket ? bracketTransportPerUnit(bracket) : 0;
    const totalPerUnit = matPerUnit + transPerUnit;
    const qty = bracket && bracket.maxQty > 0 ? bracket.maxQty : (form.productionQty || 0);
    return {
      key: bracket?.id ?? 'base',
      bracket,
      qty,
      transPerUnit,
      totalPerUnit,
      price1: priceFromMargin(totalPerUnit, form.margin1),
      price2: priceFromMargin(totalPerUnit, form.margin2),
    };
  };

  const lines = form.transportBrackets.length
    ? form.transportBrackets.map(makeLine)
    : [makeLine(null)];

  // Najkorzystniejszy = najniższy koszt całkowity / szt (najtańszy transport).
  const best = lines.reduce((a, b) => (b.totalPerUnit < a.totalPerUnit ? b : a), lines[0]);
  const bestKey = lines.length > 1 ? best.key : null;

  return { matPerUnit, lines, bestKey };
};

// Paleta kolorów progów (kolejne progi dostają kolejne kolory).
const BRACKET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#64748b'];

// ─── FORMULARZ ─────────────────────────────────────────────────────────────

const emptyForm = (): CalculationFormData => ({
  name: '',
  components: [],
  margin1: 45,
  margin2: 55,
  transportBrackets: [],
  productionQty: 1,
  notes: '',
});

const labelCls = 'text-xs font-bold text-slate-500 uppercase mb-1 block';
const inputCls = 'w-full border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 bg-white';
const smallInput = 'border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 bg-white text-sm';

type MaterialOption = {
  key: string;
  supplierId: string;
  supplierName: string;
  materialId: string;
  materialName: string;
  unitPrice: number;
  priceUnit: string;
};

export default function CalculationsPanel() {
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<CalculationFormData>(emptyForm());
  // Tekstowe wersje pól dziesiętnych (żeby dało się wpisać przecinek). Klucz = id pozycji.
  const [consText, setConsText] = useState<Record<string, string>>({});
  const [costText, setCostText] = useState<Record<string, string>>({});
  // Które progi są aktualnie rozwinięte do edycji (klucz = id progu). Reszta = zwinięta.
  const [editingBrackets, setEditingBrackets] = useState<Record<string, boolean>>({});

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [calcs, sups] = await Promise.all([getCalculations(), getSuppliers()]);
      setCalculations(calcs);
      setSuppliers(sups);
    } catch {
      alert('Błąd pobierania danych kalkulacji');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Spłaszczona lista surowców wszystkich dostawców do pickera.
  const materialOptions = useMemo<MaterialOption[]>(() =>
    suppliers.flatMap(s =>
      (s.materials ?? []).map(m => ({
        key: `${s.id}::${m.id}`,
        supplierId: s.id,
        supplierName: s.companyName,
        materialId: m.id,
        materialName: m.name,
        unitPrice: m.price,
        priceUnit: m.unit,
      })),
    ), [suppliers]);

  // Uzupełnia stare progi (z bazy) o brakujące pola costMode/color.
  const normalizeBracket = (b: TransportBracket, i: number): TransportBracket => ({
    ...b,
    costMode: b.costMode ?? 'total',
    color: b.color ?? BRACKET_COLORS[i % BRACKET_COLORS.length],
  });

  const openForm = (calc?: Calculation) => {
    if (calc) {
      setEditingId(calc.id!);
      const brackets = (calc.transportBrackets ?? []).map(normalizeBracket);
      const f: CalculationFormData = {
        name: calc.name,
        components: calc.components ?? [],
        margin1: calc.margin1,
        margin2: calc.margin2,
        transportBrackets: brackets,
        productionQty: calc.productionQty ?? 1,
        notes: calc.notes ?? '',
      };
      setForm(f);
      setConsText(Object.fromEntries((f.components).map(c => [c.id, String(c.consumption).replace('.', ',')])));
      setCostText(Object.fromEntries(brackets.map(b => [b.id, String(b.cost).replace('.', ',')])));
      setEditingBrackets({}); // wczytane progi startują zwinięte
    } else {
      setEditingId(null);
      setForm(emptyForm());
      setConsText({});
      setCostText({});
      setEditingBrackets({});
    }
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); };

  // — SKŁADNIKI —
  const addComponent = (opt: MaterialOption) => {
    const comp: CalcComponent = {
      id: crypto.randomUUID(),
      supplierId: opt.supplierId,
      supplierName: opt.supplierName,
      materialId: opt.materialId,
      materialName: opt.materialName,
      unitPrice: opt.unitPrice,
      priceUnit: opt.priceUnit,
      consumption: 0,
      consumptionUnit: opt.priceUnit,
      included: true,
    };
    setForm(prev => ({ ...prev, components: [...prev.components, comp] }));
    setConsText(prev => ({ ...prev, [comp.id]: '' }));
  };

  const updateComponent = (id: string, patch: Partial<CalcComponent>) => {
    setForm(prev => ({
      ...prev,
      components: prev.components.map(c => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const removeComponent = (id: string) => {
    setForm(prev => ({ ...prev, components: prev.components.filter(c => c.id !== id) }));
    setConsText(prev => { const { [id]: _drop, ...rest } = prev; return rest; });
  };

  // — TRANSPORT —
  const addBracket = () => {
    const b: TransportBracket = {
      id: crypto.randomUUID(),
      maxQty: 0,
      cost: 0,
      costMode: 'total',
      color: BRACKET_COLORS[form.transportBrackets.length % BRACKET_COLORS.length],
    };
    setForm(prev => ({ ...prev, transportBrackets: [...prev.transportBrackets, b] }));
    setCostText(prev => ({ ...prev, [b.id]: '' }));
    setEditingBrackets(prev => ({ ...prev, [b.id]: true })); // nowy próg od razu rozwinięty
  };

  const updateBracket = (id: string, patch: Partial<TransportBracket>) => {
    setForm(prev => ({
      ...prev,
      transportBrackets: prev.transportBrackets.map(b => (b.id === id ? { ...b, ...patch } : b)),
    }));
  };

  const removeBracket = (id: string) => {
    setForm(prev => ({ ...prev, transportBrackets: prev.transportBrackets.filter(b => b.id !== id) }));
    setCostText(prev => { const { [id]: _drop, ...rest } = prev; return rest; });
    setEditingBrackets(prev => { const { [id]: _drop, ...rest } = prev; return rest; });
  };

  const setBracketEditing = (id: string, editing: boolean) =>
    setEditingBrackets(prev => ({ ...prev, [id]: editing }));

  const result = computeCalc(form);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { alert('Podaj nazwę kalkulacji'); return; }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateCalculation(editingId, form);
        setCalculations(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      } else {
        const created = await createCalculation(form);
        setCalculations(prev => [created, ...prev]);
      }
      closeForm();
    } catch {
      alert('Błąd zapisu kalkulacji');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Usunąć tę kalkulację?')) return;
    try {
      await deleteCalculation(id);
      setCalculations(prev => prev.filter(c => c.id !== id));
    } catch {
      alert('Błąd usuwania kalkulacji');
    }
  };

  const filtered = calculations.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Kalkulacje</h2>
          <p className="text-sm text-slate-500 mt-1">Wyceny produktów z surowców dostawców, marże i progi transportu</p>
        </div>
        {!showForm && (
          <button onClick={() => openForm()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
            ＋ Nowa kalkulacja
          </button>
        )}
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto rounded-2xl border border-slate-200 p-6 bg-white space-y-6">
          <div className="flex justify-between items-start">
            <h3 className="text-xl font-bold text-slate-800">{editingId ? 'Edytuj kalkulację' : 'Nowa kalkulacja'}</h3>
            <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
          </div>

          {/* NAZWA */}
          <div>
            <label className={labelCls}>Nazwa produktu / receptury</label>
            <input required type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="np. Ramka 20×30 z antyramą" />
          </div>

          {/* SKŁADNIKI */}
          <div className="border-t border-slate-200 pt-5">
            <h4 className="font-semibold text-sm mb-3 text-slate-700">🧩 Składniki (surowce)</h4>

            <div className="mb-4">
              <label className={labelCls}>Dodaj surowiec z katalogu dostawców</label>
              <select
                value=""
                onChange={e => {
                  const opt = materialOptions.find(o => o.key === e.target.value);
                  if (opt) addComponent(opt);
                  e.target.value = '';
                }}
                className={inputCls}
              >
                <option value="">— wybierz surowiec —</option>
                {materialOptions.map(o => (
                  <option key={o.key} value={o.key}>
                    {o.supplierName} — {o.materialName} ({zl(o.unitPrice)} zł / {o.priceUnit})
                  </option>
                ))}
              </select>
              {materialOptions.length === 0 && (
                <p className="text-xs text-slate-400 mt-1 italic">Brak surowców — dodaj je najpierw w kartach dostawców.</p>
              )}
            </div>

            <div className="space-y-2">
              {form.components.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4 italic border border-dashed border-slate-300 rounded-xl">Brak składników. Dodaj surowiec powyżej.</p>
              ) : form.components.map(c => {
                const { cost, mismatch } = componentCost(c);
                return (
                  <div key={c.id} className={`rounded-xl border p-3 ${c.included ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-70'}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[12rem]">
                        <span className="font-bold text-sm text-slate-800">{c.materialName}</span>
                        {c.supplierName && <span className="text-xs text-slate-400 ml-2">{c.supplierName}</span>}
                        <div className="text-xs text-slate-400">{zl(c.unitPrice)} zł / {c.priceUnit}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500">Zużycie:</label>
                        <input
                          value={consText[c.id] ?? ''}
                          onChange={e => {
                            const t = e.target.value;
                            setConsText(prev => ({ ...prev, [c.id]: t }));
                            updateComponent(c.id, { consumption: parseNum(t) });
                          }}
                          inputMode="decimal"
                          placeholder="0"
                          className={`w-24 ${smallInput}`}
                        />
                        <select
                          value={c.consumptionUnit}
                          onChange={e => updateComponent(c.id, { consumptionUnit: e.target.value })}
                          className={smallInput}
                        >
                          {ALL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={c.included} onChange={e => updateComponent(c.id, { included: e.target.checked })} className="w-4 h-4 rounded accent-blue-600" />
                        wlicz
                      </label>
                      <div className="text-sm font-black text-slate-800 w-24 text-right">{zl(cost)} zł</div>
                      <button type="button" onClick={() => removeComponent(c.id)} className="text-xs font-bold text-rose-500 hover:underline">Usuń</button>
                    </div>
                    {mismatch && c.included && (
                      <p className="text-xs text-amber-600 mt-1.5">⚠️ Niezgodne jednostki ({c.consumptionUnit} → {c.priceUnit}) — policzono mnożnik wprost.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* MARŻE */}
          <div className="border-t border-slate-200 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Marża 1 (% od ceny sprzedaży)</label>
              <input type="number" min={0} max={99} step="any" value={form.margin1} onChange={e => setForm({ ...form, margin1: parseNum(e.target.value) })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Marża 2 (% od ceny sprzedaży)</label>
              <input type="number" min={0} max={99} step="any" value={form.margin2} onChange={e => setForm({ ...form, margin2: parseNum(e.target.value) })} className={inputCls} />
            </div>
          </div>

          {/* TRANSPORT */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-slate-700">🚚 Progi transportu (spedycja)</h4>
              <button type="button" onClick={addBracket} className="text-xs font-bold text-blue-600 hover:underline">＋ Dodaj próg</button>
            </div>
            <div className="space-y-2 mb-4">
              {form.transportBrackets.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3 italic border border-dashed border-slate-300 rounded-xl">Brak progów — transport nie będzie doliczony.</p>
              ) : form.transportBrackets.map(b => {
                const isEditing = editingBrackets[b.id];
                const perUnit = bracketTransportPerUnit(b);
                const modeLabel = b.costMode === 'perUnit' ? 'cena za szt' : 'koszt całkowity';

                if (!isEditing) {
                  // ZWINIĘTY PRÓG — podsumowanie z kolorem + przyciski
                  return (
                    <div key={b.id} className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
                      <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                      <span className="font-bold text-sm text-slate-800">do {b.maxQty || 0} szt</span>
                      <span className="text-xs text-slate-500">{modeLabel}: {zl(b.cost)} zł</span>
                      <span className="text-xs font-bold text-slate-700">→ {zl(perUnit)} zł/szt</span>
                      <div className="flex gap-2 ml-auto">
                        <button type="button" onClick={() => setBracketEditing(b.id, true)} className="text-xs font-bold text-blue-600 hover:underline">Edytuj</button>
                        <button type="button" onClick={() => removeBracket(b.id)} className="text-xs font-bold text-rose-500 hover:underline">Usuń</button>
                      </div>
                    </div>
                  );
                }

                // ROZWINIĘTY PRÓG — edycja pól
                return (
                  <div key={b.id} className="bg-slate-50 border-2 rounded-xl p-3 space-y-3" style={{ borderColor: b.color }}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500">do ilości (szt):</label>
                        <input type="number" min={0} value={b.maxQty || ''} onChange={e => updateBracket(b.id, { maxQty: parseNum(e.target.value) })} placeholder="0" className={`w-24 ${smallInput}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500">{b.costMode === 'perUnit' ? 'cena za szt (zł):' : 'koszt całk. (zł):'}</label>
                        <input
                          value={costText[b.id] ?? ''}
                          onChange={e => {
                            const t = e.target.value;
                            setCostText(prev => ({ ...prev, [b.id]: t }));
                            updateBracket(b.id, { cost: parseNum(t) });
                          }}
                          inputMode="decimal"
                          placeholder="0"
                          className={`w-24 ${smallInput}`}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700">→ {zl(perUnit)} zł/szt</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      {/* PRZEŁĄCZNIK trybu kosztu */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500">tryb:</label>
                        <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => updateBracket(b.id, { costMode: 'total' })}
                            className={`px-3 py-1.5 ${b.costMode !== 'perUnit' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
                          >
                            Koszt całkowity
                          </button>
                          <button
                            type="button"
                            onClick={() => updateBracket(b.id, { costMode: 'perUnit' })}
                            className={`px-3 py-1.5 ${b.costMode === 'perUnit' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
                          >
                            Cena za sztukę
                          </button>
                        </div>
                      </div>

                      {/* WYBÓR koloru */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500">kolor:</label>
                        <div className="flex gap-1.5">
                          {BRACKET_COLORS.map(col => (
                            <button
                              key={col}
                              type="button"
                              onClick={() => updateBracket(b.id, { color: col })}
                              className={`w-6 h-6 rounded-full transition-transform ${b.color === col ? 'ring-2 ring-offset-1 ring-slate-800 scale-110' : 'hover:scale-110'}`}
                              style={{ backgroundColor: col }}
                              aria-label={`Kolor ${col}`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 ml-auto">
                        <button type="button" onClick={() => setBracketEditing(b.id, false)} className="text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-lg">Gotowe</button>
                        <button type="button" onClick={() => removeBracket(b.id)} className="text-xs font-bold text-rose-500 hover:underline">Usuń</button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 italic">
                      {b.costMode === 'perUnit'
                        ? 'Koszt wchodzi wprost jako cena za sztukę.'
                        : 'Koszt całkowity rozłożony na ilość progu (koszt ÷ ilość).'}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="max-w-md">
              <label className={labelCls}>Wielkość produkcji (szt) — używana tylko gdy brak progów</label>
              <input type="number" min={0} value={form.productionQty || ''} onChange={e => setForm({ ...form, productionQty: parseNum(e.target.value) })} className={inputCls} placeholder="1" />
            </div>
          </div>

          {/* NOTATKI */}
          <div>
            <label className={labelCls}>📝 Uwagi (opcjonalne)</label>
            <textarea rows={2} value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} className={`${inputCls} text-sm resize-none`} />
          </div>

          {/* PODSUMOWANIE — po jednej wycenie na każdy próg transportu */}
          <div className="bg-slate-900 text-white rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-slate-300">📊 Podsumowanie (netto)</h4>
              <span className="text-xs text-slate-400">Koszt materiałowy / szt: <b className="text-white">{zl(result.matPerUnit)} zł</b></span>
            </div>

            {result.lines.length > 1 && (
              <p className="text-xs text-slate-400 mb-3">Porównanie wariantów transportu — zielona ramka = najtańszy koszt / szt.</p>
            )}

            <div className={`grid grid-cols-1 gap-4 ${result.lines.length > 1 ? 'lg:grid-cols-2 xl:grid-cols-3' : ''}`}>
              {result.lines.map(line => {
                const isBest = line.key === result.bestKey;
                return (
                  <div
                    key={line.key}
                    className={`rounded-xl p-4 border-2 ${isBest ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/10 bg-white/5'}`}
                  >
                    {/* Nagłówek wariantu */}
                    <div className="flex items-center gap-2 mb-3">
                      {line.bracket && <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: line.bracket.color }} />}
                      <span className="font-bold text-sm text-white">
                        {line.bracket ? `do ${line.bracket.maxQty || 0} szt` : 'Bez transportu'}
                      </span>
                      {isBest && <span className="text-[10px] font-black uppercase bg-emerald-400 text-slate-900 px-2 py-0.5 rounded-full ml-auto">Najtańszy</span>}
                    </div>

                    <div className="space-y-1 text-xs text-slate-300 mb-3">
                      <div className="flex justify-between"><span>Transport / szt</span><span className="font-bold text-white">{zl(line.transPerUnit)} zł</span></div>
                      <div className="flex justify-between"><span>Koszt całkowity / szt</span><span className="font-black text-white">{zl(line.totalPerUnit)} zł</span></div>
                    </div>

                    <div className="space-y-2">
                      <div className="bg-white/10 rounded-lg p-2.5">
                        <p className="text-[11px] text-slate-300">Cena (marża {form.margin1}%)</p>
                        <p className="text-xl font-black text-emerald-300">{zl(line.price1)} zł</p>
                        <p className="text-[11px] text-slate-400">Za {line.qty} szt: {zl(line.price1 * line.qty)} zł · zysk {zl(line.price1 - line.totalPerUnit)} zł/szt</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-2.5">
                        <p className="text-[11px] text-slate-300">Cena (marża {form.margin2}%)</p>
                        <p className="text-xl font-black text-emerald-300">{zl(line.price2)} zł</p>
                        <p className="text-[11px] text-slate-400">Za {line.qty} szt: {zl(line.price2 * line.qty)} zł · zysk {zl(line.price2 - line.totalPerUnit)} zł/szt</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeForm} className="border border-slate-200 text-slate-600 font-semibold px-6 py-2.5 rounded-xl hover:bg-slate-100">Anuluj</button>
            <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 py-2.5 rounded-xl transition-colors disabled:opacity-60">
              {saving ? 'Zapisuję...' : 'Zapisz kalkulację'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="mb-6">
            <input type="text" placeholder="Szukaj kalkulacji..." className={`${inputCls} max-w-md`} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loading ? <p className="text-center text-sm text-slate-500 py-6">Ładowanie...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(c => {
                const r = computeCalc(c);
                return (
                  <div key={c.id} className="rounded-2xl border border-slate-200 p-6 flex flex-col h-full shadow-sm hover:shadow-md transition-shadow bg-white">
                    <h3 className="text-lg font-bold text-slate-800 mb-3 truncate" title={c.name}>{c.name}</h3>
                    <div className="text-sm text-slate-600 space-y-1.5 mb-4 flex-grow">
                      <p className="text-xs text-slate-400">Koszt materiałowy / szt: <span className="font-bold text-slate-700">{zl(r.matPerUnit)} zł</span></p>
                      {r.lines.map(line => {
                        const isBest = line.key === r.bestKey;
                        return (
                          <div key={line.key} className={`rounded-lg px-2.5 py-1.5 ${isBest ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                            <div className="flex items-center gap-1.5 text-xs">
                              {line.bracket && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: line.bracket.color }} />}
                              <span className="font-bold text-slate-700">{line.bracket ? `do ${line.bracket.maxQty || 0} szt` : 'Bez transportu'}</span>
                              <span className="text-slate-400">· koszt {zl(line.totalPerUnit)} zł/szt</span>
                              {isBest && <span className="ml-auto text-[10px] font-black uppercase text-emerald-600">najtańszy</span>}
                            </div>
                            <div className="flex gap-3 mt-0.5 text-xs">
                              <span>marża {c.margin1}%: <span className="font-bold text-emerald-600">{zl(line.price1)} zł</span></span>
                              <span>marża {c.margin2}%: <span className="font-bold text-emerald-600">{zl(line.price2)} zł</span></span>
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-xs text-slate-400 pt-1">Składników: {c.components?.length ?? 0}</p>
                    </div>
                    <div className="flex gap-2 mt-auto border-t border-slate-100 pt-4">
                      <button type="button" onClick={() => openForm(c)} className="flex-1 bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold py-2 rounded-lg transition-colors">Otwórz</button>
                      <button type="button" onClick={() => handleDelete(c.id!)} className="px-3 text-rose-500 hover:bg-rose-50 rounded-lg text-xs font-bold bg-slate-100">Usuń</button>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-6 text-center py-10">
                  <p className="text-sm text-slate-400">Brak kalkulacji.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
