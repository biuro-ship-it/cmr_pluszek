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
const clients_1 = __importDefault(require("./routes/clients"));
const products_1 = __importDefault(require("./routes/products"));
const followups_1 = __importDefault(require("./routes/followups"));
dotenv.config();
const app = (0, express_1.default)();
// 1. BEZPIECZEŃSTWO: Helmet (ukrywa technologię i dodaje bezpieczne nagłówki HTTP)
app.use((0, helmet_1.default)());
// 2. BEZPIECZEŃSTWO: Ograniczenie CORS
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',');
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Niedozwolony origin CORS'));
        }
    },
    credentials: true,
}));
app.use(express_1.default.json());
// 3. BEZPIECZEŃSTWO: Rate Limiting (Ochrona przed masowym spamowaniem API)
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minut
    max: 200, // limit 200 zapytań z jednego IP
    message: { error: 'Zbyt wiele requestów. Spróbuj za chwilę.' }
});
app.use('/api/', limiter);
// GŁÓWNE MODUŁY
app.use('/api/clients', clients_1.default);
app.use('/api/products', products_1.default);
app.use('/api/followups', followups_1.default);
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Backend CRM uruchomiony na porcie ${PORT}`);
});
