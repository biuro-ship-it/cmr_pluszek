import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Skrypt sam sprawdzi, gdzie dokładnie leży plik z kluczem
// (czy jeden folder wyżej, czy dwa foldery wyżej)
const path1 = path.join(__dirname, '..', 'serviceAccountKey.json');
const path2 = path.join(__dirname, '..', '..', 'serviceAccountKey.json');
const path3 = path.join(process.cwd(), 'serviceAccountKey.json'); 

let serviceAccountPath = '';

if (fs.existsSync(path1)) {
  serviceAccountPath = path1;
} else if (fs.existsSync(path2)) {
  serviceAccountPath = path2;
} else if (fs.existsSync(path3)) {
  serviceAccountPath = path3;
}

try {
  if (!serviceAccountPath) {
    throw new Error("Nie znaleziono pliku serviceAccountKey.json w żadnej ze ścieżek!");
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const serviceAccount = require(serviceAccountPath);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase połączony sukcesem! Użyta ścieżka:", serviceAccountPath);
  }
} catch (error) {
  console.error("❌ BŁĄD KRYTYCZNY FIREBASE:");
  console.error(error);
}

export const auth = admin.auth();
export const db = admin.firestore();