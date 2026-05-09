import { Request, Response, NextFunction } from 'express';
import { auth } from '../services/firebase';

export interface AuthRequest extends Request {
  uid?: string;
}

export async function verifyToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Brak tokenu autoryzacyjnego' });
    return;
  }

  const token = header.split('Bearer ')[1];

  try {
    const decoded = await auth.verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Nieprawidłowy token' });
  }
}
