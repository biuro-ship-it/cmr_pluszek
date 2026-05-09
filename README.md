# CMR App - Sprint 1/2

Monorepo:
- `frontend`: React + Vite + Firebase Auth (Google Sign-In)
- `backend`: Express + Firebase Admin + Firestore (klienci + interakcje)

## 1. Instalacja

```bash
cd /home/krzysiek/cmr-app
npm install
```

## 2. Konfiguracja backendu

```bash
cp backend/.env.example backend/.env
```

Uzupełnij dane Firebase service account w `backend/.env`.

## 3. Konfiguracja frontendu

```bash
cp frontend/.env.example frontend/.env
```

Uzupełnij dane Firebase Web App config w `frontend/.env`.

## 4. Konfiguracja Google API (Sprint 3)

Uzupełnij `backend/.env` o:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `SENDGRID_API_KEY` (opcjonalnie dla e-mail)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (dla Web Push)

## 5. Uruchomienie

W osobnych terminalach:

```bash
cd /home/krzysiek/cmr-app
npm run dev -w backend
```

```bash
cd /home/krzysiek/cmr-app
npm run dev -w frontend
```

Frontend domyślnie: `http://localhost:5173`  
Backend domyślnie: `http://localhost:4000`

## Sprint 1 status

Zrobione:
- Google login (frontend + weryfikacja tokena na backendzie)
- Firestore jako baza
- CRUD klientów na backendzie
- Formularz i lista klientów na frontendzie
- Wyszukiwarka klientów (firma/osoba/e-mail/telefon)
- Edycja i usuwanie klienta z poziomu listy
- Licznik dni od ostatniego kontaktu przy nazwie klienta

## Sprint 2 (część wykonana)

Zrobione:
- API interakcji klienta:
  - `GET /api/clients/:id/interactions`
  - `POST /api/clients/:id/interactions`
- Dodawanie kontaktu (data, kanał, notatka, ustalenia cenowe, produkty).
- Automatyczna aktualizacja `lastContactAt` po dodaniu kontaktu.
- Podgląd historii kontaktów dla wybranego klienta w UI.
- API follow-up:
  - `GET /api/clients/:id/followups`
  - `POST /api/clients/:id/followups`
  - `PATCH /api/clients/:id/followups/:followUpId/status`
  - `GET /api/clients/followups/summary` (na dziś / zaległe)
- Frontend: formularz follow-up, zmiana statusu oraz panel "Na dziś i zaległe".
- Filtry listy klientów: `Wszyscy / Na dziś / Zaległe`.

## Sprint 3

Zrobione:
- Backend: API kalendarza (`/api/calendar/events`, `sync`).
- Backend: Integracja z Google Calendar API (CRUD).
- Backend: Scheduler przypomnień (co 30 min).
- Frontend: Komponent `CalendarView` (pobieranie i wyświetlanie wydarzeń z Google).
- Frontend: Integracja `CalendarView` w głównym widoku.
- Backend: Obsługa Gmail API (wysyłka szablonów).
- Frontend: Opcjonalne załączniki PDF w mailach.

## Sprint 4 (w toku)

Zrobione:
- Backend: Integracja z Firebase Storage (załączniki).
- Backend: Endpointy do listowania i usuwania załączników.
- Frontend: Komponent `AttachmentList` (upload i lista plików).
- Backend: Endpoint raportów `/api/reports/summary`.
- Frontend: Komponent `ReportDashboard`.
- Frontend: Konfiguracja PWA (offline support, caching API).

W trakcie:
- Testy akceptacyjne całego MVP.
- Polerowanie UI/UX.
- Obsługa kolejki zmian offline (Offline Queue).
# cmr_pluszek
