import { db } from './firebase';
import { Product } from '../types';

const COLLECTION = 'products';

/**
 * FUNKCJA INICJALIZUJĄCA STARTOWE PRODUKTY
 * Sprawdza czy kolekcja jest pusta i dodaje Twoje 4 pozycje
 */
export const initializeBaseProducts = async () => {
  try {
    const snapshot = await db.collection(COLLECTION).limit(1).get();
    
    if (snapshot.empty) {
      const baseProducts = [
        "Produkt Standardowy A",
        "Produkt Premium B",
        "Zestaw Akcesoriów C",
        "Komponent Specjalistyczny D"
      ];

      for (const name of baseProducts) {
        await db.collection(COLLECTION).add({
          name,
          createdAt: new Date().toISOString()
        });
      }
      console.log("✅ Zainicjalizowano 4 podstawowe produkty w Firebase");
    }
  } catch (error) {
    console.error("❌ Błąd podczas inicjalizacji produktów:", error);
  }
};

/**
 * POBIERANIE LISTY PRODUKTÓW
 */
export const getProducts = async (): Promise<Product[]> => {
  const snapshot = await db.collection(COLLECTION).orderBy('name').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
};

/**
 * DODAWANIE NOWEGO PRODUKTU DO BAZY NA STAŁE
 */
export const addProduct = async (name: string): Promise<string> => {
  const res = await db.collection(COLLECTION).add({
    name,
    createdAt: new Date().toISOString()
  });
  return res.id;
};