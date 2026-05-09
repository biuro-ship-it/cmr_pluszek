import { Request, Response, NextFunction } from 'express';
import { auth } from '../services/firebase';

// Rozszerzamy domyślny interfejs Request, aby móc zapisać zdekodowane dane użytkownika
export interface AuthRequest extends Request {
  user?: any;
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  // Sprawdzamy, czy nagłówek z tokenem w ogóle istnieje
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Brak tokenu autoryzacyjnego. Dostęp zabroniony.' });
  }

  // Wyciągamy sam ciąg znaków tokenu (bez słowa "Bearer ")
  const token = authHeader.split(' ')[1];

  try {
    // Weryfikujemy token w Firebase Admin SDK
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken; // Zapisujemy dane (np. user.uid) do użycia w endpointach
    
    // Wszystko OK - przepuszczamy zapytanie dalej
    next();
  } catch (error) {
    console.error('❌ Błąd weryfikacji tokenu:', error);
    return res.status(401).json({ error: 'Nieprawidłowy lub wygasły token.' });
  }
};