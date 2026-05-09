import { Router } from 'express';
import { getProducts } from '../services/products';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Zabezpieczamy endpoint - tylko dla zalogowanych (P1-2)
router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const products = await getProducts();
    res.json(products);
  } catch (error) {
    console.error("Błąd pobierania produktów:", error);
    res.status(500).json({ error: 'Nie udało się pobrać listy produktów' });
  }
});

export default router;