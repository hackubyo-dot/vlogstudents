const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const routes = require('./src/routes/index')

const app = express();

// Segurança
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// Rate Limit: 100 requests por 15 minutos por IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Muitas requisições. Tente mais tarde.' }
});
app.use('/api/', limiter);

// Rotas Base
app.use('/api/v1', routes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'active', timestamp: new Date() });
});

// Tratamento Global de Erros
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err);
    res.status(500).json({
        success: false,
        message: err.message || 'Erro crítico no servidor.'
    });
});

module.exports = app;
