# Poprawki CRM Pluszek — Plan Naprawy

Data audytu: 2026-05-09  
Audytor: Claude Code (Sonnet 4.6)

---

## PRIORYTET 1 — Krytyczne błędy blokujące działanie

---

### P1-1. Przepiąć `main.tsx` na właściwe drzewo komponentów

**Plik:** `frontend/src/main.tsx`  
**Problem:** Aplikacja renderuje stary `App.tsx` bez logowania. Cały kod w `Dashboard.tsx`, `useAuth.ts`, `useClients.ts` jest martwy.

**Obecny kod:**
```tsx
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Docelowy kod:**
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { useAuth } from './hooks/useAuth';
import LoginPage from './components/LoginPage';
import Dashboard from './pages/Dashboard';

function Root() {
  const { user, loading, error, signIn, signOut } = useAuth();

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Ładowanie...</div>;
  if (!user) return <LoginPage onSignIn={signIn} error={error} />;
  return <Dashboard user={user} onSignOut={signOut} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
```

**Efekt:** Użytkownik niezalogowany widzi stronę logowania. Zalogowany trafia do Dashboardu z pełną funkcjonalnością.

---

### P1-2. Dodać `verifyToken` middleware do wszystkich endpointów klientów

**Plik:** `backend/src/routes/clients.ts`  
**Problem:** Wszystkie endpointy są publiczne — każdy bez logowania może czytać, dodawać, edytować i usuwać klientów.

**Obecny kod:**
```ts
router.get('/', async (req, res) => { ... });
router.post('/', async (req, res) => { ... });
router.put('/:id', async (req, res) => { ... });
router.delete('/:id', async (req, res) => { ... });
```

**Docelowy kod:**
```ts
import { verifyToken } from '../middleware/auth';

router.get('/', verifyToken, async (req, res) => { ... });
router.post('/', verifyToken, async (req, res) => { ... });
router.put('/:id', verifyToken, async (req, res) => { ... });
router.delete('/:id', verifyToken, async (req, res) => { ... });
```

**Efekt:** Każdy request do API wymaga ważnego tokenu Firebase. Nieautoryzowany dostęp zwraca HTTP 401.

---

### P1-3. Dodać prop `initial` do `ClientForm` — formularz edycji nie działa

**Plik:** `frontend/src/components/ClientForm.tsx`  
**Problem:** `Dashboard.tsx` przekazuje `initial={editClient}`, ale `ClientForm` nie ma tej prop w interfejsie i ją ignoruje. Edycja klienta otwiera pusty formularz.

**Obecny interfejs:**
```tsx
interface ClientFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const ClientForm: React.FC<ClientFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    type: 'sklep',
    contactPerson: '',
    email: '',
    phone: '',
    address: { province: '', zipCode: '', city: '', street: '', number: '' }
  });
```

**Docelowy interfejs:**
```tsx
import { Client } from '../services/api';

interface ClientFormProps {
  onSubmit: (data: ClientFormData) => void;
  onCancel: () => void;
  initial?: Client | null;
}

const ClientForm: React.FC<ClientFormProps> = ({ onSubmit, onCancel, initial }) => {
  const [formData, setFormData] = useState({
    companyName: initial?.company_name ?? '',
    type: (initial?.type as 'hurt' | 'sklep') ?? 'sklep',
    contactPerson: initial?.contact_person_name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    address: initial?.address ?? { province: '', zipCode: '', city: '', street: '', number: '' }
  });
```

**Uwaga:** Wymaga też ujednolicenia modelu danych (patrz P1-4).

---

### P1-4. Ujednolicić model `Client` — niespójne nazwy pól

**Problem:** Backend i frontend używają różnych nazw pól dla tego samego obiektu:

| Pole | Backend `types/index.ts` | Frontend `services/api.ts` |
|------|--------------------------|----------------------------|
| Nazwa firmy | `companyName` | `company_name` |
| Osoba kontaktowa | `contactPerson` | `contact_person_name` |
| Adres | `Address` (obiekt) | `string` |

`ClientForm.tsx` wysyła camelCase + obiekt adresu.  
`ClientList.tsx` oczekuje snake_case + string adresu.  
Dane nigdy nie wyświetlają się poprawnie.

**Rozwiązanie — ujednolicić na camelCase + obiekt (zgodnie z backendem):**

**`frontend/src/services/api.ts` — zmienić interfejsy:**
```ts
export interface Address {
  province: string;
  zipCode: string;
  city: string;
  street: string;
  number: string;
}

export interface Client {
  id: string;
  companyName: string;
  type: 'hurt' | 'sklep';
  contactPerson: string;
  email: string;
  phone: string;
  address: Address;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientFormData {
  companyName: string;
  type: 'hurt' | 'sklep';
  contactPerson: string;
  email: string;
  phone: string;
  address: Address;
}
```

**`frontend/src/components/ClientList.tsx` — zaktualizować odwołania:**
```tsx
// Było:
c.company_name.toLowerCase().includes(q)
c.contact_person_name.toLowerCase()
<span>{client.company_name}</span>
<span>👤 {client.contact_person_name}</span>
<span>📍 {client.address}</span>  // string

// Powinno być:
c.companyName.toLowerCase().includes(q)
c.contactPerson.toLowerCase()
<span>{client.companyName}</span>
<span>👤 {client.contactPerson}</span>
<span>📍 {client.address.city}, {client.address.province}</span>  // obiekt
```

---

### P1-5. Naprawić crash przy filtracji — `c.phone.toLowerCase()`

**Plik:** `frontend/src/components/ClientList.tsx:34`  
**Problem:** `phone` może być `null` lub `undefined`. Wywołanie `.toLowerCase()` na `undefined` rzuca `TypeError` i rozbija całą listę klientów.

**Obecny kod:**
```ts
const filtered = clients.filter((c) => {
  const q = search.toLowerCase();
  return (
    c.company_name.toLowerCase().includes(q) ||
    c.contact_person_name.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q) ||
    c.phone.toLowerCase().includes(q)  // CRASH gdy phone === null
  );
});
```

**Docelowy kod (po ujednoliceniu modelu z P1-4):**
```ts
const filtered = clients.filter((c) => {
  const q = search.toLowerCase();
  return (
    (c.companyName ?? '').toLowerCase().includes(q) ||
    (c.contactPerson ?? '').toLowerCase().includes(q) ||
    (c.email ?? '').toLowerCase().includes(q) ||
    (c.phone ?? '').toLowerCase().includes(q)
  );
});
```

---

## PRIORYTET 2 — Bezpieczeństwo

---

### P2-1. Ograniczyć CORS do konkretnego origin

**Plik:** `backend/src/index.ts:14`  
**Problem:** `app.use(cors())` akceptuje requesty z dowolnej domeny.

**Obecny kod:**
```ts
app.use(cors());
```

**Docelowy kod:**
```ts
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
```

**Wymaganie:** Zmienna `FRONTEND_URL` musi być ustawiona w `.env` produkcyjnym na właściwą domenę.

---

### P2-2. Dodać walidację danych wejściowych na backendzie

**Plik:** `backend/src/routes/clients.ts`  
**Problem:** `POST /api/clients` i `PUT /api/clients/:id` przyjmują `...req.body` bez żadnej weryfikacji. Można zapisać dowolne pola, w tym puste dane lub złośliwe wartości.

**Rozwiązanie — zainstalować `zod` i dodać schemat walidacji:**

```bash
cd backend && npm install zod
```

```ts
// backend/src/routes/clients.ts
import { z } from 'zod';

const AddressSchema = z.object({
  province: z.string().min(1),
  zipCode: z.string().regex(/^\d{2}-\d{3}$/, 'Format: 00-000'),
  city: z.string().min(1),
  street: z.string().optional().default(''),
  number: z.string().optional().default(''),
});

const ClientSchema = z.object({
  companyName: z.string().min(1, 'Nazwa firmy jest wymagana'),
  type: z.enum(['hurt', 'sklep']),
  contactPerson: z.string().optional().default(''),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().default(''),
  address: AddressSchema,
});

router.post('/', verifyToken, async (req, res) => {
  const parsed = ClientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  // ... reszta logiki z parsed.data zamiast req.body
});
```

---

### P2-3. Usunąć `App.tsx` — martwy kod z luką bezpieczeństwa

**Plik:** `frontend/src/App.tsx`  
**Problem:** Po wykonaniu P1-1 plik `App.tsx` staje się martwym kodem. Zawiera stary fetch bez auth i hardkodowany URL. Należy go usunąć, żeby nie wrócił przypadkowo.

**Akcja:** Usunąć plik `frontend/src/App.tsx` po potwierdzeniu że `main.tsx` działa na nowym drzewie komponentów.

---

## PRIORYTET 3 — Jakość kodu

---

### P3-1. Dodać obsługę błędów w `Dashboard.handleSubmit`

**Plik:** `frontend/src/pages/Dashboard.tsx:28`  
**Problem:** Brak `try/catch` — formularz zamknie się nawet gdy zapis się nie uda. Użytkownik nie dostanie informacji o błędzie.

**Obecny kod:**
```ts
const handleSubmit = async (data: ClientFormData) => {
  if (editClient) {
    await updateClient(editClient.id, data);
  } else {
    await createClient(data);
  }
  setShowForm(false);
  setEditClient(null);
};
```

**Docelowy kod:**
```ts
const [submitError, setSubmitError] = useState<string | null>(null);

const handleSubmit = async (data: ClientFormData) => {
  setSubmitError(null);
  try {
    if (editClient) {
      await updateClient(editClient.id, data);
    } else {
      await createClient(data);
    }
    setShowForm(false);
    setEditClient(null);
  } catch (err) {
    setSubmitError(err instanceof Error ? err.message : 'Błąd zapisu. Spróbuj ponownie.');
  }
};
```

---

### P3-2. Ujednolicić system stylowania

**Problem:** Aplikacja miesza dwa systemy CSS:
- `App.tsx`, `ClientForm.tsx` → **Tailwind CSS**
- `Dashboard.tsx`, `ClientList.tsx`, `LoginPage.tsx` → **inline `React.CSSProperties`**

**Rekomendacja:** Wybrać jeden system i trzymać się go. Ponieważ projekt ma Tailwind 4.3 skonfigurowany i `App.tsx` (stary) oraz `ClientForm.tsx` (nowy) już go używają — **migrować Dashboard, ClientList i LoginPage na Tailwind.**

Przykład dla `LoginPage`:
```tsx
// Zamiast: style={styles.wrapper}
// Używać:
<div className="min-h-screen flex items-center justify-center bg-slate-100">
```

---

### P3-3. Zastąpić produkty zastępcze w bazie

**Plik:** `backend/src/services/products.ts:15`  
**Problem:** Baza inicjalizuje się z fikcyjnymi produktami (`"Produkt Standardowy A"` itd.), które nie mają związku z realną ofertą firmy.

**Akcja:** Podmienić listę `baseProducts` na rzeczywiste produkty firmy Pluszek przed pierwszym uruchomieniem na produkcji (lub ręcznie usunąć kolekcję `products` z Firestore i uruchomić ponownie po aktualizacji kodu).

---

### P3-4. Dodać paginację lub wirtualizację listy klientów

**Plik:** `frontend/src/components/ClientList.tsx`  
**Problem:** Przy docelowych ~300 klientach renderowanie wszystkich jednocześnie będzie wolne. Brak żadnego mechanizmu ograniczającego.

**Rekomendacja — prosta paginacja po stronie frontu:**
```tsx
const PAGE_SIZE = 50;
const [page, setPage] = useState(0);
const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
```

Lub po stronie backendu z `limit` i `startAfter` w Firestore.

---

## PRIORYTET 4 — Brakujące funkcje

---

### P4-1. Aktywować przycisk "Otwórz kartę klienta"

**Plik:** `frontend/src/App.tsx:120` (po migracji — w nowym widoku listy)  
**Problem:** Przycisk renderuje się ale nie ma żadnego `onClick`. Funkcja "karty klienta" nie istnieje.

**Minimum:** Po kliknięciu powinien otwierać modal lub nawigować do widoku szczegółów klienta z historią kontaktów (`Interaction`).

---

### P4-2. Aktywować menu "•••" przy karcie klienta

**Plik:** `frontend/src/App.tsx:101`  
**Problem:** Przycisk z trzema kropkami nie ma akcji.

**Minimum:** Dropdown z opcjami: Edytuj, Usuń, Zarejestruj kontakt.

---

### P4-3. Dodać testy

**Problem:** Brak jakichkolwiek testów w projekcie.

**Rekomendacja — minimum na start:**
```bash
cd frontend && npm install -D vitest @testing-library/react @testing-library/user-event
```

Testy do napisania w pierwszej kolejności:
- `ClientList` — filtracja z nullowym phone
- `ClientForm` — poprawne wypełnienie przy edycji
- `useClients` — obsługa błędu API
- Backend route `POST /api/clients` — walidacja danych wejściowych

---

## Podsumowanie priorytetów

| Nr | Opis | Pilność |
|----|------|---------|
| P1-1 | Przepiąć `main.tsx` na `useAuth + Dashboard` | Krytyczne |
| P1-2 | Dodać `verifyToken` do routes | Krytyczne |
| P1-3 | Naprawić `ClientForm` — prop `initial` | Krytyczne |
| P1-4 | Ujednolicić model `Client` | Krytyczne |
| P1-5 | Naprawić `c.phone.toLowerCase()` | Krytyczne |
| P2-1 | Ograniczyć CORS | Wysoka |
| P2-2 | Walidacja `zod` na backendzie | Wysoka |
| P2-3 | Usunąć `App.tsx` | Wysoka |
| P3-1 | `try/catch` w `handleSubmit` | Średnia |
| P3-2 | Ujednolicić stylowanie | Średnia |
| P3-3 | Realne produkty w bazie | Średnia |
| P3-4 | Paginacja listy | Niska |
| P4-1 | Karta klienta | Niska |
| P4-2 | Menu "•••" | Niska |
| P4-3 | Testy | Niska |
