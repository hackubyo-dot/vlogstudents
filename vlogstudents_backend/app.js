/**
 * ============================================================================
 * VLOGSTUDENTS APP CORE - FINAL VERSION
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./src/routes/index');

const app = express();

// ===============================
// SEGURANÇA
// ===============================
app.use(helmet());

app.use(cors({
    origin: '*', // depois podes restringir em produção
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ===============================
// BODY PARSER
// ===============================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===============================
// LOGS
// ===============================
app.use(morgan('dev'));

// ===============================
// RATE LIMIT (ANTI-SPAM / DDOS)
// ===============================
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Muitas requisições. Tente novamente mais tarde.'
    }
});

app.use('/api/', limiter);

// ===============================
// ROTAS
// ===============================
app.use('/api/v1', routes);

// ===============================
// HEALTH CHECK
// ===============================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date()
    });
});

// ===============================
// 404 HANDLER
// ===============================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Rota não encontrada'
    });
});

// ===============================
// ERROR HANDLER GLOBAL
// ===============================
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err);

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Erro interno do servidor'
    });
});

module.exports = app;
