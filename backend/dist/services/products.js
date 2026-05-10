"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addProduct = exports.getProducts = exports.initializeBaseProducts = void 0;
const firebase_1 = require("./firebase");
const COLLECTION = 'products';
/**
 * FUNKCJA INICJALIZUJĄCA STARTOWE PRODUKTY
 * Sprawdza czy kolekcja jest pusta i dodaje Twoje 4 pozycje
 */
const initializeBaseProducts = async () => {
    try {
        const snapshot = await firebase_1.db.collection(COLLECTION).limit(1).get();
        if (snapshot.empty) {
            const baseProducts = [
                "Pluszek Maxi mix",
                "Pluszek Midi mix",
                "Pluszek siedzisko",
                "Gabki kapielowe mix"
            ];
            for (const name of baseProducts) {
                await firebase_1.db.collection(COLLECTION).add({
                    name,
                    createdAt: new Date().toISOString()
                });
            }
            console.log("✅ Zainicjalizowano 4 podstawowe produkty w Firebase");
        }
    }
    catch (error) {
        console.error("❌ Błąd podczas inicjalizacji produktów:", error);
    }
};
exports.initializeBaseProducts = initializeBaseProducts;
/**
 * POBIERANIE LISTY PRODUKTÓW
 */
const getProducts = async () => {
    const snapshot = await firebase_1.db.collection(COLLECTION).orderBy('name').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
exports.getProducts = getProducts;
/**
 * DODAWANIE NOWEGO PRODUKTU DO BAZY NA STAŁE
 */
const addProduct = async (name) => {
    const res = await firebase_1.db.collection(COLLECTION).add({
        name,
        createdAt: new Date().toISOString()
    });
    return res.id;
};
exports.addProduct = addProduct;
