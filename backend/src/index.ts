import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import clientRoutes from './routes/clients';
import { initializeBaseProducts } from './services/products';

// Załadowanie zmiennych środowiskowych z pliku .env
dotenv.config();

const app = express();

// Konfiguracja Middleware
// cors() pozwala na komunikację Frontendu z Backendem
app.use(cors());
// express.json() pozwala serwerowi rozumieć dane przesyłane w formacie JSON
app.use(express.json());

/**
 * DEFINICJA TRAS (ROUTES)
 * Wszystkie endpointy dotyczące klientów będą zaczynać się od /api/clients
 */
app.use('/api/clients', clientRoutes);

/**
 * TRASA TESTOWA
 * Pozwala szybko sprawdzić w przeglądarce (localhost:4000/health), czy serwer działa
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Backend CRM Pluszek is running' 
  });
});

const PORT = process.env.PORT || 4000;

/**
 * URUCHOMIENIE SERWERA
 */
app.listen(PORT, async () => {
  console.log(`✅ Backend CRM uruchomiony na porcie ${PORT}`);
  
  try {
    // Wywołanie funkcji, która sprawdza i dodaje Twoje 4 startowe produkty do bazy
    await initializeBaseProducts();
  } catch (error) {
    console.error("❌ Błąd podczas inicjalizacji startowej listy produktów:", error);
  }
});