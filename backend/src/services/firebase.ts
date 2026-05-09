import * as admin from 'firebase-admin';

// Wczytywanie klucza (upewnij się, że ścieżka jest poprawna)
const serviceAccount = require('../../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
  console.log("✅ Firebase Admin zainicjalizowany!");
}

// TE LINIE SĄ KLUCZOWE - dodaj je, jeśli ich nie ma:
export const auth = admin.auth();     // To naprawi obecny błąd
export const db = admin.firestore();  // To zapobiegnie kolejnemu błędowi z bazą danych