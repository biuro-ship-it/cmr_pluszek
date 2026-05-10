import { Router } from 'express';
import { getProducts } from '../services/products';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.use(verifyToken);

// GET /api/products — lista produktow z Firestore
router.get('/', async (_req, res) => {
  try {
    const products = await getProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Nie udalo sie pobrac listy produktow' });
  }
});

export default router;