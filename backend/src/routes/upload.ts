import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Folder docelowy: public/uploads/ (obok dist/)
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');

// Utwórz folder jeśli nie istnieje
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    cb(null, `${safe}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Dozwolone tylko pliki JPG, PNG, WebP, GIF'));
  },
});

// POST /api/upload
router.post('/', verifyToken, (req: Request, res: Response, _next: NextFunction) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: `Błąd uploadu: ${err.message}` });
      return;
    }
    if (err) {
      console.error('[upload] błąd multer:', err);
      res.status(400).json({ error: err.message || 'Nie udało się zapisać pliku' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Brak pliku' });
      return;
    }
    const baseUrl = process.env.FRONTEND_URL?.split(',')[0] || 'https://crm.pluszek.pl';
    const url = `${baseUrl}/uploads/${req.file.filename}`;
    res.json({ url });
  });
});

export default router;
