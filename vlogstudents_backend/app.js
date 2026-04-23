/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER EXPRESS APP v30.0.0 (ULTRA CORE)
 * SECURITY | PERFORMANCE | OBSERVABILITY | SMART MIDDLEWARE
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// CONFIG
const routes = require('./src/routes/index');
const env = require('./src/config/env');

const app = express();

// ============================================================================
// 🌐 TRUST PROXY (RENDER / NGINX / CLOUDFLARE)
// ============================================================================
app.set('trust proxy', 1);

// ============================================================================
// 🧠 REQUEST ID (DEBUG PROFISSIONAL)
// ============================================================================
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// ============================================================================
// ⏱ PERFORMANCE TRACKING
// ============================================================================
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    console.log(
      `[REQ] ${req.method} ${req.originalUrl} | ${res.statusCode} | ${duration}ms | ID=${req.id}`
    );
  });

  next();
});

// ============================================================================
// 🔐 SECURITY (HELMET HARDENED)
// ============================================================================
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false, // evita bloqueios em frontend externo
  })
);

// ============================================================================
// 🌍 CORS (INTELIGENTE)
// ============================================================================
app.use(
  cors({
    origin: '*', // 🔥 restringe em produção real
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ============================================================================
// 🧼 BODY PARSER (SAFE LIMIT)
// ============================================================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================================
// 🧾 LOGGER (DEV + PROD)
// ============================================================================
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan((tokens, req, res) => {
      return JSON.stringify({
        time: new Date().toISOString(),
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: tokens.status(req, res),
        response_time: tokens['response-time'](req, res),
        request_id: req.id,
      });
    })
  );
}

// ============================================================================
// 🚫 RATE LIMIT (INTELIGENTE POR ZONA)
// ============================================================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 🔐 mais restrito
  message: { success: false, message: 'Muitas tentativas de login.' },
});

app.use('/api/', globalLimiter);
app.use('/api/v1/auth', authLimiter);

// ============================================================================
// 🛡 SANITIZE (ANTI-INJECTION BÁSICO)
// ============================================================================
app.use((req, res, next) => {
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(/[$<>;]/g, '');
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);

  next();
});

// ============================================================================
// 🖥 ROOT DASHBOARD
// ============================================================================
app.get('/', (req, res) => {
  res.status(200).send(`
    <html>
    <head>
        <title>VLOGSTUDENTS</title>
        <style>
            body {
                background:#0f172a;
                color:#e2e8f0;
                font-family:sans-serif;
                display:flex;
                flex-direction:column;
                justify-content:center;
                align-items:center;
                height:100vh;
            }
            .card {
                background:#1e293b;
                padding:20px;
                border-radius:10px;
                box-shadow:0 0 20px rgba(0,0,0,0.5);
            }
            .ok { color:#22c55e; }
        </style>
    </head>
    <body>
        <h1>🚀 VLOGSTUDENTS ENTERPRISE</h1>
        <div class="card">
            <p>Status: <span class="ok">ONLINE</span></p>
            <p>Environment: ${env.NODE_ENV}</p>
            <p>Uptime: ${Math.floor(process.uptime())}s</p>
            <p>Request ID Ready ✔</p>
        </div>
    </body>
    </html>
  `);
});

// ============================================================================
// ❤️ HEALTH CHECK (AVANÇADO)
// ============================================================================
app.get('/health', async (req, res) => {
  try {
    const start = Date.now();
    await require('./src/config/db').query('SELECT 1');
    const dbTime = Date.now() - start;

    res.json({
      status: 'OK',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      db: 'connected',
      dbResponse: `${dbTime}ms`,
      requestId: req.id,
      timestamp: new Date(),
    });

  } catch (err) {
    res.status(500).json({
      status: 'FAIL',
      db: 'down',
      error: err.message,
    });
  }
});

// ============================================================================
// 📡 API ROUTES
// ============================================================================
app.use('/api/v1', routes);

// ============================================================================
// 🚫 404 HANDLER (INTELIGENTE)
// ============================================================================
app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.url}`);

  res.status(404).json({
    success: false,
    message: `Endpoint não encontrado.`,
    method: req.method,
    path: req.originalUrl,
    requestId: req.id,
    suggestion: 'Verifique /api/v1',
  });
});

// ============================================================================
// 💥 GLOBAL ERROR HANDLER (PRO)
// ============================================================================
app.use((err, req, res, next) => {
  console.error('[ERROR]', {
    id: req.id,
    message: err.message,
    stack: err.stack,
  });

  res.status(err.status || 500).json({
    success: false,
    message: 'Erro interno do servidor.',
    requestId: req.id,
    error: env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ============================================================================
// EXPORT
// ============================================================================
module.exports = app;
