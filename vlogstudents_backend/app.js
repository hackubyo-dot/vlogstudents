/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER EXPRESS APP v33.0.0 (NUCLEAR SHIELD)
 * SECURITY | STATIC WEB HOSTING | PERFORMANCE | OBSERVABILITY | SPA COMPATIBLE
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Engenharia de Fluxo:
 * - Static Hosting: Engine integrada para servir o frontend 'vlogstudents_web'.
 * - SPA Fallback: Suporte a rotas virtuais (History API) para evitar 404 na Web.
 * - Restricted CORS: Whitelist blindada para os domínios de produção e local.
 * - Deep Sanitize: Motor recursivo de limpeza de dados contra Injeção.
 * - Rate Limiting: Proteção por zonas (Auth vs Global).
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');

// CONFIGURAÇÕES DE INFRAESTRUTURA
const routes = require('./src/routes/index');
const env = require('./src/config/env');
const db = require('./src/config/db');

const app = express();

/**
 * ============================================================================
 * 📂 MAPEAMENTO DE DIRETÓRIO WEB (FRONTEND)
 * Define a localização física da interface web para o servidor estático.
 * ============================================================================
 */
const webPath = path.join(__dirname, '../vlogstudents_web');

/**
 * ============================================================================
 * 🌐 INFRAESTRUTURA DE REDE (TRUST PROXY)
 * Configuração vital para capturar o IP real do usuário através do Render.com.
 * ============================================================================
 */
app.set('trust proxy', 1);

/**
 * ============================================================================
 * 🧠 REQUEST TRACING & AUDIT ENGINE
 * Injeta identificadores únicos para auditoria e monitoramento de falhas.
 * ============================================================================
 */
app.use((req, res, next) => {
    // Gera UUID universal para rastreamento de logs (Traceability)
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    res.setHeader('X-Vlog-Trace-Id', req.id);
    next();
});

/**
 * ============================================================================
 * ☢️ RESTRICTED NUCLEAR CORS ENGINE
 * Resolve erros de Preflight e garante persistência de tráfego entre Web e API.
 * ============================================================================
 */
const corsOptions = {
    origin: [
        'https://vlogstudents.onrender.com',      // URL Principal
        'https://vlogstudents-web.onrender.com',  // URL do Static Site
        'http://localhost:3000',                  // Dev Local
        'http://localhost:5000'                   // Dev Alternativo
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Vlog-Trace-ID', 
        'X-Vlog-Platform', 
        'X-Vlog-App-Version', 
        'X-Requested-With',
        'Accept',
        'X-Vlog-Device-Fingerprint'
    ],
    credentials: true, 
    exposedHeaders: ['X-Request-Id', 'X-Vlog-Trace-Id'],
    preflightContinue: false,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/**
 * ============================================================================
 * 🔐 SECURITY HARDENING (HELMET RELAXED FOR WEB)
 * Proteção ajustada para permitir o carregamento do SPA e mídias do Supabase.
 * ============================================================================
 */
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        contentSecurityPolicy: false, // Permitir recursos externos (Google Fonts/Supabase)
        xssFilter: true,
        noSniff: true,
        hidePoweredBy: true
    })
);

/**
 * ============================================================================
 * 🧼 DATA PARSING & CLEANING
 * ============================================================================
 */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Anti-Injection Recursiva
app.use((req, res, next) => {
    const sanitizeValue = (val) => {
        if (typeof val === 'string') {
            return val.replace(/[<>;]/g, '').trim();
        }
        return val;
    };

    const deepSanitize = (obj) => {
        for (let key in obj) {
            if (obj[key] !== null && typeof obj[key] === 'object') {
                deepSanitize(obj[key]);
            } else {
                obj[key] = sanitizeValue(obj[key]);
            }
        }
    };

    if (req.body) deepSanitize(req.body);
    if (req.query) deepSanitize(req.query);
    next();
});

/**
 * ============================================================================
 * 🧾 LOGGING & PERFORMANCE
 * ============================================================================
 */
if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan((tokens, req, res) => {
        return JSON.stringify({
            timestamp: tokens.date(req, res, 'iso'),
            method: tokens.method(req, res),
            url: tokens.url(req, res),
            status: tokens.status(req, res),
            latency: `${tokens['response-time'](req, res)}ms`,
            requestId: req.id,
            ip: req.ip
        });
    }));
}

/**
 * ============================================================================
 * 🚫 PROTECTION LAYER (RATE LIMITING)
 * ============================================================================
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5000, 
    message: { success: false, message: "Tráfego excessivo detectado." }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, 
    message: { success: false, message: "Tentativas de login excedidas." }
});

app.use('/api/', globalLimiter);
app.use('/api/v1/auth', authLimiter);

/**
 * ============================================================================
 * 📡 SERVIDOR DE ARQUIVOS ESTÁTICOS (FRONTEND WEB)
 * Entrega o HTML/CSS/JS da pasta vlogstudents_web
 * ============================================================================
 */
app.use(express.static(webPath));

/**
 * ============================================================================
 * 📡 API ROUTES GATEWAY
 * ============================================================================
 */
app.use('/api/v1', routes);

/**
 * ============================================================================
 * 🩺 HEALTH MONITORING
 * ============================================================================
 */
app.get('/health', async (req, res) => {
    try {
        const start = Date.now();
        await db.query('SELECT 1');
        const dbLatency = Date.now() - start;

        res.status(200).json({
            status: 'UP',
            version: '33.0.0',
            database: 'CONNECTED',
            latency: `${dbLatency}ms`,
            requestId: req.id
        });
    } catch (err) {
        res.status(500).json({ status: 'DOWN', database: 'DISCONNECTED', requestId: req.id });
    }
});

/**
 * ============================================================================
 * 🔄 SPA ROUTING FALLBACK (HISTORY API SUPPORT)
 * Este é o ponto mais importante: se a rota não for API e não for um arquivo 
 * físico, ele retorna o index.html para que o roteador JS assuma.
 * ============================================================================
 */
app.get('*', (req, res) => {
    // Se for uma requisição de API que chegou aqui, é um 404 de API real
    if (req.path.startsWith('/api/v1')) {
        return res.status(404).json({
            success: false,
            message: `Endpoint ${req.path} não localizado no núcleo.`
        });
    }

    // Caso contrário, serve o index.html da pasta web
    res.sendFile(path.join(webPath, 'index.html'), (err) => {
        if (err) {
            res.status(500).send("Erro ao carregar o Campus Web.");
        }
    });
});

/**
 * ============================================================================
 * 💥 MASTER ERROR HANDLER
 * ============================================================================
 */
app.use((err, req, res, next) => {
    console.error('[CRITICAL_EXCEPTION]', {
        requestId: req.id,
        message: err.message,
        path: req.originalUrl
    });

    res.status(err.status || 500).json({
        success: false,
        message: 'Instabilidade interna no campus acadêmico.',
        requestId: req.id
    });
});

module.exports = app;

/**
 * ============================================================================
 * FIM DO MASTER EXPRESS APP v33.0.0
 * VLOGSTUDENTS ENTERPRISE - BLINDAGEM COMPLETA.
 * ============================================================================
 */
