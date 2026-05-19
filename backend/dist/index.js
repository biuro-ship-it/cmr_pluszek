"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path")); // DODANE: obsługa ścieżek
const clients_1 = __importDefault(require("./routes/clients"));
const products_1 = __importDefault(require("./routes/products"));
const followups_1 = __importDefault(require("./routes/followups"));
const promotions_1 = __importDefault(require("./routes/promotions"));
const upload_1 = __importDefault(require("./routes/upload"));
dotenv.config({ path: path_1.default.join(__dirname, '..', '.env') });
const app = (0, express_1.default)();
// Wymagane dla Phusion Passenger (X-Forwarded-For)
app.set('trust proxy', 1);
// 1. BEZPIECZEŃSTWO: Helmet (z poprawką dla Google Sign-In popup)
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: 'unsafe-none' }, // wymagane dla Google Sign-In popup
}));
// 2. BEZPIECZEŃSTWO: Ograniczenie CORS - WERSJA KULOODPORNA
const fallbackOrigins = [
    'https://crm.pluszek.pl',
    'https://www.crm.pluszek.pl',
    'http://localhost:5173'
];
// Pobieramy z .env jeśli działa, w przeciwnym razie używamy rezerwy
const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',')
    : fallbackOrigins;
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Zabezpieczenie: usuwamy ewentualny ukośnik na samym końcu adresu (częsty błąd)
        const cleanOrigin = origin ? origin.replace(/\/$/, '') : '';
        // Zezwalamy na ruch bez origin (np. z serwera) lub jeśli adres jest na liście (bądź rezerwowej)
        if (!origin || allowedOrigins.includes(cleanOrigin) || fallbackOrigins.includes(cleanOrigin)) {
            callback(null, true);
        }
        else {
            console.error(`Blokada CORS! Odrzucono zapytanie z adresu: ${origin}`);
            callback(new Error('Niedozwolony origin CORS'));
        }
    },
    credentials: true,
}));
app.use(express_1.default.json());
// 3. OBSŁUGA FRONTENDU (DODANE)
// Zakładamy, że folder 'public' stworzysz w katalogu głównym backendu
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
// 4. BEZPIECZEŃSTWO: Rate Limiting (validate false — wymagane dla Passenger)
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    validate: { xForwardedForHeader: false },
    message: { error: 'Zbyt wiele requestów. Spróbuj za chwilę.' }
});
app.use('/api/', limiter);
// GŁÓWNE MODUŁY API
app.use('/api/clients', clients_1.default);
app.use('/api/products', products_1.default);
app.use('/api/followups', followups_1.default);
app.use('/api/promotions', promotions_1.default);
app.use('/api/upload', upload_1.default);
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// 5. OBSŁUGA ROUTINGU FRONTENDU (DODANE)
// To sprawi, że strona zadziała na telefonie pod głównym adresem
app.get('*', (req, res) => {
    // Jeśli zapytanie nie jest do API, serwujemy index.html z frontendu
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path_1.default.join(__dirname, '..', 'public', 'index.html'));
    }
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Backend CRM uruchomiony na porcie ${PORT}`);
});
