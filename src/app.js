// FILE: src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Rotas
const authRoutes = require('./routes/authRoutes');

const app = express();

/**
 * Configuração de Segurança Industrial
 */
app.use(helmet()); // Protege contra vulnerabilidades HTTP conhecidas
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logger de requisições
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Rate Limiting para evitar abusos (DDoS/Brute Force)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requests por IP por janela
  message: { success: false, message: "Muitas requisições originadas deste IP, tente novamente mais tarde." }
});
app.use('/api/', limiter);

/**
 * Injeção de Rotas
 */
app.use('/api/auth', authRoutes);

// Rota Root para Health Check do Render/Monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

/**
 * Middleware de Tratamento de Erros 404
 */
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Recurso não encontrado.' });
});

/**
 * Middleware de Erro Global (Prevenir crash silencioso)
 */
app.use((err, req, res, next) => {
  console.error('[GLOBAL_ERROR_HANDLER]', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erro inesperado no servidor.',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

module.exports = app;