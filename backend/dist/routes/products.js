"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const products_1 = require("../services/products");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.verifyToken);
// GET /api/products — lista produktow z Firestore
router.get('/', async (_req, res) => {
    try {
        const products = await (0, products_1.getProducts)();
        res.json(products);
    }
    catch (error) {
        res.status(500).json({ error: 'Nie udalo sie pobrac listy produktow' });
    }
});
exports.default = router;
