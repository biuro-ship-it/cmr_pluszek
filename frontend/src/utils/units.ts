// Przeliczanie jednostek surowców na potrzeby kalkulacji.
// Każda jednostka należy do jednego wymiaru; przeliczenia możliwe są wyłącznie
// w obrębie tego samego wymiaru masy / długości / objętości.

export type Unit = 'szt' | 'kpl' | 'ark.' | 'm²' | 'mb' | 'm' | 'kg' | 'g' | 'l' | 'ml';

// Lista wszystkich jednostek do użycia w UI (pickery jednostek).
export const ALL_UNITS: Unit[] = ['szt', 'kpl', 'ark.', 'm²', 'mb', 'm', 'kg', 'g', 'l', 'ml'];

type Dimension = 'mass' | 'length' | 'area' | 'volume' | 'count';

// Wymiar + przelicznik do jednostki bazowej danego wymiaru.
const UNIT_TABLE: Record<Unit, { dim: Dimension; factor: number }> = {
  // masa (baza: kg)
  kg: { dim: 'mass', factor: 1 },
  g: { dim: 'mass', factor: 0.001 },
  // długość (baza: m; mb traktujemy jak metr)
  m: { dim: 'length', factor: 1 },
  mb: { dim: 'length', factor: 1 },
  // powierzchnia (baza: m²)
  'm²': { dim: 'area', factor: 1 },
  // objętość (baza: l)
  l: { dim: 'volume', factor: 1 },
  ml: { dim: 'volume', factor: 0.001 },
  // jednostki „licznikowe" — każda osobny licznik, brak przeliczeń krzyżowych
  szt: { dim: 'count', factor: 1 },
  kpl: { dim: 'count', factor: 1 },
  'ark.': { dim: 'area', factor: 1 },
};

/**
 * Przelicza wartość z jednostki `from` na `to`.
 * - from===to → value
 * - obie w tym samym wymiarze masy/długości/objętości → value * factor(from)/factor(to)
 * - różne wymiary lub różne jednostki „licznikowe" → null (brak przeliczenia)
 */
export const convertQuantity = (value: number, from: string, to: string): number | null => {
  if (from === to) return value;

  const f = UNIT_TABLE[from as Unit];
  const t = UNIT_TABLE[to as Unit];
  if (!f || !t) return null;

  // Przeliczamy tylko wewnątrz masy / długości / objętości.
  if (f.dim !== t.dim) return null;
  if (f.dim === 'count' || f.dim === 'area') return null; // „licznikowe" różne → brak przeliczeń krzyżowych

  return (value * f.factor) / t.factor;
};

// Akceptuje przecinek jako separator dziesiętny (polski format).
export const parseNum = (v: string | number): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// Format waluty pl-PL, 2 miejsca po przecinku.
export const zl = (n: number): string =>
  new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );
