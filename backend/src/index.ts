import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as dotenv from 'dotenv';
import clientRoutes from './routes/clients';
import productRoutes from './routes/products';
import followupRoutes from './routes/followups';

dotenv.config();

const app = express();

// 1. BEZPIECZEŃSTWO: Helmet (ukrywa technologię i dodaje bezpieczne nagłówki HTTP)
app.use(helmet());

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

// 3. BEZPIECZEŃSTWO: Rate Limiting (Ochrona przed masowym spamowaniem API)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 200, // limit 200 zapytań z jednego IP
  message: { error: 'Zbyt wiele requestów. Spróbuj za chwilę.' }
});
app.use('/api/', limiter);

// GŁÓWNE MODUŁY
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/followups', followupRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend CRM uruchomiony na porcie ${PORT}`);
});