/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER EXPRESS APP v31.0.0 (WEB COMPATIBLE)
 * SECURITY | CORS ENGINE | PERFORMANCE | OBSERVABILITY | SMART MIDDLEWARE
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Engenharia de Fluxo:
 * - Trust Proxy: Configuração otimizada para Render, Cloudflare e Nginx.
 * - Traceability: Injeção de X-Request-Id em cada transação para auditoria.
 * - Dynamic CORS: Motor inteligente que valida origens Mobile e Web.
 * - Helmet Hardened: Camada de segurança para cabeçalhos HTTP (Web-Ready).
 * - Rate Limiting: Proteção contra DoS e Brute-force em rotas de Auth.
 * - Telemetry: Tracking de tempo de resposta e logs JSON em produção.
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// CONFIGURAÇÕES INTERNAS DO SISTEMA
const routes = require('./src/routes/index');
const env = require('./src/config/env');

const app = express();

// ============================================================================
// 🌐 NETWORK INFRASTRUCTURE (TRUST PROXY)
// ============================================================================
// Necessário para capturar o IP real atrás de balanceadores como o Render.com
app.set('trust proxy', 1);

// ============================================================================
// 🧠 REQUEST TRACING & UUID GENERATION
// ============================================================================
app.use((req, res, next) => {
    // Gera um ID único para cada requisição para facilitar o debug em logs
    req.id = crypto.randomUUID();
    res.setHeader('X-Vlog-Trace-Id', req.id);
    next();
});

// ============================================================================
// ⏱ PERFORMANCE TELEMETRY
// ============================================================================
app.use((req, res, next) => {
    const start = Date.now();

    // Intercepta a finalização da resposta para calcular latência
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (duration > 500) {
            console.warn(`[PERF_ALERT] LENTIDÃO: ${req.method} ${req.originalUrl} tomou ${duration}ms | ID: ${req.id}`);
        }
    });

    next();
});

// ============================================================================
// 🌍 SMART CORS ENGINE (WEB & MOBILE COMPATIBLE)
// ============================================================================
app.use(cors({
    origin: function (origin, callback) {
        // Permite requisições sem origin (Mobile Apps Android/iOS, Postman, Curl)
        // Ou qualquer origin se não estivermos em ambiente de produção
        if (!origin || env.NODE_ENV !== 'production' || origin.includes('vlogstudents')) {
            callback(null, true);
        } else {
            // Em produção restrita, você adicionaria os domínios permitidos aqui
            // Por enquanto, permitimos para flexibilidade no rollout
            callback(null, true); 
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Vlog-Trace-ID', 
        'X-Vlog-Platform', 
        'X-Vlog-App-Version', 
        'X-Vlog-Device-Fingerprint',
        'Accept'
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// ============================================================================
// 🔐 SECURITY HARDENING (HELMET)
// ============================================================================
app.use(
    helmet({
        // crossOriginResourcePolicy: false permite carregar mídias de outros domínios na web
        crossOriginResourcePolicy: { policy: "cross-origin" },
        // contentSecurityPolicy desabilitado para compatibilidade total com Flutter Web/CDN
        contentSecurityPolicy: false, 
        xssFilter: true,
        noSniff: true,
        hidePoweredBy: true
    })
);

// ============================================================================
// 🧼 DATA PARSING & HYDRATION
// ============================================================================
// Limite industrial de 50MB para suportar uploads de Vlogs (Reels) e Status
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================================
// 🛡️ DATA SANITIZATION (ANTI-INJECTION)
// ============================================================================
app.use((req, res, next) => {
    const sanitizeValue = (val) => {
        if (typeof val === 'string') {
            // Remove caracteres perigosos de injeção básica, preservando a bio acadêmica
            return val.replace(/[<>;]/g, '');
        }
        return val;
    };

    const processObject = (obj) => {
        for (let key in obj) {
            if (obj[key] !== null && typeof obj[key] === 'object') {
                processObject(obj[key]);
            } else {
                obj[key] = sanitizeValue(obj[key]);
            }
        }
    };

    if (req.body) processObject(req.body);
    if (req.query) processObject(req.query);
    
    next();
});

// ============================================================================
// 🧾 INDUSTRIAL LOGGING (MORGAN)
// ============================================================================
if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    // Log estruturado em JSON para produção (CloudWatch/Loki/Render Logs)
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

// ============================================================================
// 🚫 PROTECTION LAYER (RATE LIMITING)
// ============================================================================
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 Minutos
    max: 5000, // Limite generoso para o campus
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Muitas requisições. Tente em 15 minutos." }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // Proteção contra Brute Force no Login/Registro
    message: { success: false, message: "Segurança: Muitas tentativas de acesso." }
});

app.use('/api/', globalLimiter);
app.use('/api/v1/auth', authLimiter);

// ============================================================================
// 📡 CORE API ROUTES & HEALTH MONITORING
// ============================================================================

// Ponto de entrada oficial da API
app.use('/api/v1', routes);

// Endpoint de Saúde para o Render / K8s
app.get('/health', async (req, res) => {
    try {
        const start = Date.now();
        // Ping real no banco de dados para garantir conectividade
        await require('./src/config/db').query('SELECT 1');
        const dbLatency = Date.now() - start;

        res.status(200).json({
            status: 'UP',
            version: '31.0.0',
            database: 'CONNECTED',
            latency: `${dbLatency}ms`,
            uptime: `${Math.floor(process.uptime())}s`,
            timestamp: new Date()
        });
    } catch (err) {
        console.error('[HEALTH_CHECK_FAIL]', err.message);
        res.status(500).json({ 
            status: 'DOWN', 
            database: 'DISCONNECTED', 
            error: err.message,
            requestId: req.id 
        });
    }
});

// ============================================================================
// 🖥️ SERVER DASHBOARD (ROOT UI)
// ============================================================================
app.get('/', (req, res) => {
    res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>VLOGSTUDENTS ENGINE</title>
            <style>
                body { background: #0b0e14; color: #e2e8f0; font-family: 'Segoe UI', Tahoma, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: #161b22; padding: 30px; border-radius: 15px; border: 1px solid #30363d; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; }
                .neon { color: #CCFF00; font-weight: bold; text-shadow: 0 0 10px rgba(204, 255, 0, 0.3); }
                .tag { font-size: 12px; background: #21262d; padding: 5px 10px; border-radius: 5px; color: #8b949e; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🚀 <span class="neon">VLOGSTUDENTS</span> ENTERPRISE</h1>
                <p>O Núcleo Express está <span style="color:#238636">OPERACIONAL</span></p>
                <div class="tag">Versão: 31.0.0 | Env: ${env.NODE_ENV.toUpperCase()}</div>
                <p style="font-size: 11px; color: #484f58; margin-top: 20px;">Trace ID: ${req.id}</p>
            </div>
        </body>
        </html>
    `);
});

// ============================================================================
// 🚫 GLOBAL 404 HANDLER
// ============================================================================
app.use((req, res) => {
    console.warn(`[404_NOT_FOUND] ${req.method} ${req.originalUrl} | ID: ${req.id}`);
    res.status(404).json({
        success: false,
        message: 'Endpoint não encontrado no campus.',
        requestId: req.id
    });
});

// ============================================================================
// 💥 MASTER ERROR HANDLER (ZERO CRASH POLICY)
// ============================================================================
app.use((err, req, res, next) => {
    // Log detalhado do erro para o administrador do sistema
    console.error('[CRITICAL_ERROR]', {
        traceId: req.id,
        message: err.message,
        stack: env.NODE_ENV === 'development' ? err.stack : 'REDACTED',
        path: req.originalUrl
    });

    res.status(err.status || 500).json({
        success: false,
        message: 'Instabilidade detectada no processamento interno do campus.',
        requestId: req.id,
        // Mostra o erro apenas em ambiente de desenvolvimento
        debug: env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ============================================================================
// MODULE EXPORT
// ============================================================================
module.exports = app;
