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

dotenv.config();

const app = express();

// Wymagane dla Phusion Passenger (X-Forwarded-For)
app.set('trust proxy', 1);

// 1. BEZPIECZEŃSTWO: Helmet (z poprawką dla Google Sign-In popup)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: 'unsafe-none' }, // wymagane dla Google Sign-In popup
}));

// 2. BEZPIECZEŃSTWO: Ograniczenie CORS
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
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