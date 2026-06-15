import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as dotenv from 'dotenv';
import path from 'path'; // DODANE: obsługa ścieżek
import clientRoutes from './routes/clients';
import productRoutes from './routes/products';
import followupRoutes from './routes/followups';
import promotionRoutes from './routes/promotions';
import uploadRoutes from './routes/upload';
import noteRoutes from './routes/notes';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();

// Wymagane dla Phusion Passenger (X-Forwarded-For)
app.set('trust proxy', 1);

// 1. BEZPIECZEŃSTWO: Helmet (z poprawką dla Google Sign-In popup oraz wgranych zdjęć)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: 'unsafe-none' }, // wymagane dla Google Sign-In popup
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // NOWE: pozwala przeglądarce wyświetlać zdjęcia z serwera
}));

// 2. BEZPIECZEŃSTWO: Ograniczenie CORS - WERSJA KULOODPORNA
const fallbackOrigins = [
  'https://crm.pluszek.pl',
  'https://www.crm.pluszek.pl',
  'http://localhost:5173'
];

// Pobieramy z .env jeśli działa, w przeciwnym razie używamy rezerwy
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',') 
  : fallbackOrigins;

app.use(cors({
  origin: (origin, callback) => {
    // Zabezpieczenie: usuwamy ewentualny ukośnik na samym końcu adresu (częsty błąd)
    const cleanOrigin = origin ? origin.replace(/\/$/, '') : '';
    
    // Zezwalamy na ruch bez origin (np. z serwera) lub jeśli adres jest na liście (bądź rezerwowej)
    if (!origin || allowedOrigins.includes(cleanOrigin) || fallbackOrigins.includes(cleanOrigin)) {
      callback(null, true);
    } else {
      console.error(`Blokada CORS! Odrzucono zapytanie z adresu: ${origin}`);
      callback(new Error('Niedozwolony origin CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());

// 3. OBSŁUGA FRONTENDU (DODANE)
// Zakładamy, że folder 'public' stworzysz w katalogu głównym backendu
app.use(express.static(path.join(__dirname, '..', 'public')));

// 4. BEZPIECZEŃSTWO: Rate Limiting (validate false — wymagane dla Passenger)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  validate: { xForwardedForHeader: false },
  message: { error: 'Zbyt wiele requestów. Spróbuj za chwilę.' }
});
app.use('/api/', limiter);

// GŁÓWNE MODUŁY API
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notes', noteRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 5. OBSŁUGA ROUTINGU FRONTENDU (DODANE)
// To sprawi, że strona zadziała na telefonie pod głównym adresem
app.get('*', (req, res) => {
  // Jeśli zapytanie nie jest do API, serwujemy index.html z frontendu
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend CRM uruchomiony na porcie ${PORT}`);
});