"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = void 0;
const firebase_1 = require("../services/firebase");
// Lista dozwolonych adresów e-mail (jeden użytkownik, dwa konta Google)
const ALLOWED_EMAILS = ['biuro@antyramy.eu', 'info@pluszek.pl'];
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    // Sprawdzamy, czy nagłówek z tokenem w ogóle istnieje
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Brak tokenu autoryzacyjnego. Dostęp zabroniony.' });
    }
    // Wyciągamy sam ciąg znaków tokenu (bez słowa "Bearer ")
    const token = authHeader.split(' ')[1];
    try {
        // Weryfikujemy token w Firebase Admin SDK
        const decodedToken = await firebase_1.auth.verifyIdToken(token);
        // Sprawdzamy czy email użytkownika jest na liście dozwolonych
        const userEmail = decodedToken.email?.toLowerCase();
        if (!userEmail || !ALLOWED_EMAILS.includes(userEmail)) {
            return res.status(403).json({ error: 'Brak uprawnien. To konto nie ma dostepu do aplikacji.' });
        }
        req.user = decodedToken;
        next();
    }
    catch (error) {
        console.error('Blad weryfikacji tokenu:', error);
        return res.status(401).json({ error: 'Nieprawidlowy lub wygasly token.' });
    }
};
exports.verifyToken = verifyToken;
