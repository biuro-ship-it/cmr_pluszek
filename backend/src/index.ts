import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import clientRoutes from './routes/clients';
import productRoutes from './routes/products'; // IMPORT TRASY PRODUKTÓW
import { initializeBaseProducts } from './services/products';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// PODPIĘCIE GŁÓWNYCH MODUŁÓW
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes); // AKTYWACJA TRASY PRODUKTÓW

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
  console.log(`✅ Backend CRM uruchomiony na porcie ${PORT}`);
  try {
    await initializeBaseProducts();
  } catch (error) {
    console.error("❌ Błąd podczas inicjalizacji startowej listy produktów:", error);
  }
});