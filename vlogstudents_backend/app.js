/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER EXPRESS APPLICATION (FINAL ROOT VERSION)
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// ✅ CAMINHOS CORRETOS (APP NA RAIZ)
const routes = require('./src/routes/index');
const env = require('./src/config/env');

const app = express();

// ===============================
// 🔥 FIX CRÍTICO PARA RENDER
// ===============================
// Permite que o Express reconheça IP real (X-Forwarded-For)
app.set('trust proxy', 1);

// ===============================
// 1. SEGURANÇA (HELMET + CORS)
// ===============================
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Permite imagens externas (Supabase)
  })
);

app.use(
  cors({
    origin: '*', // 🔒 Em produção restringe
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ===============================
// 2. BODY PARSER
// ===============================
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ===============================
// 3. LOGGING
// ===============================
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ===============================
// 4. RATE LIMIT (ANTI-DDOS)
// ===============================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 2000, // aumentado para evitar bloqueio em testes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Limite de tráfego excedido.',
  },
});

app.use('/api/', limiter);

// ===============================
// 5. ROOT (EVITA 404)
// ===============================
app.get('/', (req, res) => {
  res.status(200).send(`
    <div style="background:#000;color:#CCFF00;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:sans-serif">
        <h1 style="font-size:48px;margin-bottom:0;">VLOGSTUDENTS</h1>
        <p style="color:#fff;letter-spacing:4px;">ENTERPRISE BACKEND ONLINE</p>
        <div style="border:1px solid #333;padding:20px;border-radius:10px;background:#111;">
            <code style="color:#888;">Status: Operational | Version: 2.0.0</code>
        </div>
    </div>
  `);
});

// ===============================
// 6. HEALTH CHECK
// ===============================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    engine: 'Operational',
    timestamp: new Date(),
    environment: env.NODE_ENV,
  });
});

// ===============================
// 7. ROTAS API
// ===============================
app.use('/api/v1', routes);

// ===============================
// 8. 404 HANDLER
// ===============================
app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `O endpoint ${req.method} ${req.url} não existe.`,
    hint:
      'Verifique o método HTTP (GET/POST) e inclua o token JWT nas rotas protegidas.',
  });
});

// ===============================
// 9. ERROR HANDLER GLOBAL
// ===============================
app.use((err, req, res, next) => {
  console.error('[FATAL_ERROR]', err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: 'Erro interno no servidor.',
    error: env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ===============================
// EXPORT
// ===============================
module.exports = app;
