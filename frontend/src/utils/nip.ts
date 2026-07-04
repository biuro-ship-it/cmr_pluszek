// Pobieranie danych firmy z Białej listy podatników VAT (Ministerstwo Finansów) po NIP.

export interface NipResult {
  companyName: string;
  street: string;      // sama ulica (bez numeru)
  number: string;      // numer budynku/lokalu
  streetFull: string;  // ulica + numer w jednym polu
  zipCode: string;
  city: string;
  raw: string;         // surowy adres z MF
}

// Rozbija adres z MF ("ULICA 74, 03-301 WARSZAWA") na pola.
const parseNipAddress = (raw: string): Omit<NipResult, 'companyName' | 'streetFull' | 'raw'> => {
  if (!raw) return { street: '', number: '', zipCode: '', city: '' };

  const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
  let zipCode = '', city = '';
  const cityPart = parts.length > 1 ? parts[parts.length - 1] : '';
  const zipMatch = cityPart.match(/(\d{2}-\d{3})\s+(.+)/);
  if (zipMatch) {
    zipCode = zipMatch[1];
    city = zipMatch[2].trim();
  } else if (parts.length === 1) {
    const m = raw.match(/(\d{2}-\d{3})\s+([^\d,]+)/);
    if (m) { zipCode = m[1]; city = m[2].trim(); }
  }

  const streetPart = parts.length > 1
    ? parts.slice(0, parts.length - 1).join(', ')
    : raw.replace(/\d{2}-\d{3}.*/, '').trim();
  let street = streetPart, number = '';
  const numMatch = streetPart.match(/^(.*?)[\s]+(\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?)\s*$/);
  if (numMatch) {
    street = numMatch[1].trim();
    number = numMatch[2].trim();
  }
  return { street, number, zipCode, city };
};

// Odpytuje API MF po NIP i zwraca dane firmy. Rzuca Error z komunikatem przy niepowodzeniu.
export const lookupNip = async (nipRaw: string): Promise<NipResult> => {
  const nip = nipRaw.replace(/[-\s]/g, '');
  if (nip.length !== 10) throw new Error('NIP musi mieć 10 cyfr');

  const url = `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${new Date().toISOString().split('T')[0]}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Brak wyników');
  const data = await response.json();
  const subject = data?.result?.subject;
  if (!subject) throw new Error('Firma nie znaleziona');

  const raw = subject.workingAddress || subject.residenceAddress || '';
  const { street, number, zipCode, city } = parseNipAddress(raw);
  return {
    companyName: subject.name || '',
    street,
    number,
    streetFull: [street, number].filter(Boolean).join(' ').trim(),
    zipCode,
    city,
    raw,
  };
};
