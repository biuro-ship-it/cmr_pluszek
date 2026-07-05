import { useEffect, useMemo, useState } from 'react';
import { FakturowniaStats, getFakturowniaStats } from '../services/api';

const zl = (n: number) =>
  new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' zł';

// Skrócony format do środka wykresu (żeby zmieścić w otworze donuta).
const zlShort = (n: number): string => {
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace('.', ',') + ' mln zł';
  if (n >= 1e3) return Math.round(n / 1e3).toLocaleString('pl-PL') + ' tys. zł';
  return Math.round(n).toLocaleString('pl-PL') + ' zł';
};

// Paleta kategoryczna (dataviz, tryb light) — stała kolejność, CVD-bezpieczna.
const PIE_COLORS = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'];
const REST_COLOR = '#898781'; // „Pozostałe" — neutralna szarość, nie kolejny hue

type PieItem = { label: string; value: number; color: string };

// Donut top-N udziału firm w obrocie (inline SVG, bez bibliotek).
function DonutChart({ data, total }: { data: PieItem[]; total: number }) {
  const size = 220, stroke = 34, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0" role="img" aria-label="Udział firm w obrocie">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {data.map((d, i) => {
          const frac = total > 0 ? d.value / total : 0;
          const dash = Math.max(frac * C - 2, 0); // 2px przerwa między wycinkami
          const el = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r} fill="none"
              stroke={d.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-acc * C}
            >
              <title>{`${d.label}: ${zl(d.value)} (${(frac * 100).toFixed(1)}%)`}</title>
            </circle>
          );
          acc += frac;
          return el;
        })}
      </g>
      <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-800" style={{ fontSize: 15, fontWeight: 800 }}>{zlShort(total)}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11 }}>obrót netto</text>
    </svg>
  );
}

const PERIODS: { id: string; label: string }[] = [
  { id: 'all', label: 'Cały czas' },
  { id: 'this_year', label: 'Bieżący rok' },
  { id: 'last_year', label: 'Poprzedni rok' },
  { id: 'this_month', label: 'Bieżący miesiąc' },
  { id: 'last_month', label: 'Poprzedni miesiąc' },
];

type SortKey = 'net' | 'count' | 'avg';
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'net', label: 'Obrót' },
  { id: 'count', label: 'Liczba faktur' },
  { id: 'avg', label: 'Śr. faktura' },
];

const inputCls = 'border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 bg-white text-sm';

export default function AnalyticsPanel() {
  const [period, setPeriod] = useState('all');
  const [sort, setSort] = useState<SortKey>('net');
  const [stats, setStats] = useState<FakturowniaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    getFakturowniaStats(period)
      .then(s => { if (!cancelled) setStats(s); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Błąd pobierania danych'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  const companies = useMemo(() => {
    if (!stats) return [];
    const arr = [...stats.companies];
    arr.sort((a, b) => b[sort] - a[sort]);
    return arr;
  }, [stats, sort]);

  const total = stats?.totalNet ?? 0;

  // Dane donuta: top-8 firm wg obrotu + „Pozostałe" (zawsze wg obrotu, niezależnie od sortu tabeli).
  const pie = useMemo<PieItem[]>(() => {
    if (!stats) return [];
    const sorted = [...stats.companies].sort((a, b) => b.net - a.net);
    const top = sorted.slice(0, 8);
    const rest = sorted.slice(8);
    const items: PieItem[] = top.map((c, i) => ({ label: c.name, value: c.net, color: PIE_COLORS[i] }));
    const restNet = rest.reduce((s, c) => s + c.net, 0);
    if (restNet > 0) items.push({ label: `Pozostałe (${rest.length})`, value: restNet, color: REST_COLOR });
    return items;
  }, [stats]);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Analizy</h2>
          <p className="text-sm text-slate-500 mt-1">
            Obrót firm na podstawie faktur z Fakturowni (netto)
            {stats?.category && <span className="ml-1">· kategoria <span className="font-bold text-slate-700">{stats.category}</span></span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={period} onChange={e => setPeriod(e.target.value)} className={inputCls}>
            {PERIODS.map(p => <option key={p.id} value={p.id}>Okres: {p.label}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value as SortKey)} className={inputCls}>
            {SORTS.map(s => <option key={s.id} value={s.id}>Sortuj: {s.label}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-3 mb-4">⚠️ {error}</div>}

      {loading ? (
        <p className="text-center text-sm text-slate-500 py-10">Ładowanie danych z Fakturowni…</p>
      ) : !stats ? null : (
        <>
          {/* KARTY PODSUMOWANIA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="rounded-2xl border border-slate-200 bg-slate-900 text-white p-5">
              <p className="text-xs text-slate-300 uppercase tracking-wider">Obrót całkowity (netto)</p>
              <p className="text-3xl font-black mt-1">{zl(total)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Liczba faktur</p>
              <p className="text-3xl font-black text-slate-800 mt-1">{stats.invoiceCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Liczba firm</p>
              <p className="text-3xl font-black text-slate-800 mt-1">{stats.companyCount}</p>
            </div>
          </div>

          {/* WYKRES KOŁOWY — UDZIAŁ W OBROCIE */}
          {total > 0 && pie.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-8">
              <h3 className="font-bold text-slate-800 mb-4">Udział w obrocie — top 8 firm</h3>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <DonutChart data={pie} total={total} />
                <ul className="flex-1 w-full space-y-1.5">
                  {pie.map((d, i) => {
                    const pct = total > 0 ? (d.value / total) * 100 : 0;
                    return (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: d.color }} />
                        <span className="flex-1 text-slate-700 truncate" title={d.label}>{d.label}</span>
                        <span className="font-mono text-slate-500 w-16 text-right">{pct.toFixed(1)}%</span>
                        <span className="font-mono font-semibold text-slate-800 w-32 text-right whitespace-nowrap">{zl(d.value)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {/* RANKING FIRM */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden mb-8">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Udział firm w obrocie</h3>
            </div>
            {companies.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">
                Brak faktur w kategorii <span className="font-semibold">{stats.category}</span> w wybranym okresie.
                <br />Przypisz odpowiednie faktury do tej kategorii w Fakturowni, aby pojawiły się w analizie.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 bg-slate-50 border-b border-slate-200">
                      <th className="py-2.5 px-3 font-semibold">#</th>
                      <th className="py-2.5 px-3 font-semibold">Firma</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Obrót netto</th>
                      <th className="py-2.5 px-3 font-semibold w-40">Udział</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Faktur</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Śr. faktura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c, idx) => {
                      const pct = total > 0 ? (c.net / total) * 100 : 0;
                      return (
                        <tr key={c.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-medium text-slate-800 truncate max-w-[240px]" title={c.name}>{c.name}</div>
                            {c.nip && <div className="text-xs text-slate-400">NIP {c.nip}</div>}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-800 whitespace-nowrap">{zl(c.net)}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden min-w-[60px]">
                                <div className="h-2 bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-slate-500 w-12 text-right">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">{c.count}</td>
                          <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">{zl(c.avg)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* OBRÓT WG LAT */}
          {stats.byYear.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-slate-800 mb-4">Obrót wg lat</h3>
              <div className="space-y-2">
                {(() => {
                  const maxYear = Math.max(...stats.byYear.map(y => y.net), 1);
                  return stats.byYear.map(y => (
                    <div key={y.year} className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-700 w-14">{y.year}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div className="h-3 bg-emerald-500 rounded-full" style={{ width: `${(y.net / maxYear) * 100}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-slate-800 w-32 text-right whitespace-nowrap">{zl(y.net)}</span>
                      <span className="text-xs text-slate-400 w-16 text-right">{y.count} fv</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
