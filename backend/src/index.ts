import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import clientRoutes from './routes/clients';
import productRoutes from './routes/products';
import followupRoutes from './routes/followups'; // IMPORT TRASY PRZYPOMNIEŃ
import { initializeBaseProducts } from './services/products';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// GŁÓWNE MODUŁY
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/followups', followupRoutes); // AKTYWACJA TRASY PRZYPOMNIEŃ

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