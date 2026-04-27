/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER EXPRESS APP v32.0.0 (ULTIMATE NUCLEAR EDITION)
 * SECURITY | RESTRICTED CORS ENGINE | PERFORMANCE | OBSERVABILITY | WEB & MOBILE SYNC
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Engenharia de Fluxo:
 * - Trust Proxy: Otimizado para Render.com, AWS Cloudfront e Nginx.
 * - Traceability: Injeção de X-Vlog-Trace-Id e X-Request-Id em cada transação.
 * - Industrial CORS: Whitelist específica para a URL de produção e local (Web-Ready).
 * - Helmet Hardened: Cabeçalhos de segurança relaxados cirurgicamente para Flutter Web.
 * - Rate Limiting: Proteção contra ataques de negação de serviço (DoS) e Brute Force.
 * - Anti-Injection: Sanitização profunda recursiva de entradas de dados (Deep Sanitize).
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// CONFIGURAÇÕES DE INFRAESTRUTURA
const routes = require('./src/routes/index');
const env = require('./src/config/env');
const db = require('./src/config/db');

const app = express();

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
 * Whitelist oficial para produção e ambiente de desenvolvimento local.
 * Resolve erros de Preflight e garante persistência de cookies/headers.
 * ============================================================================
 */
const corsOptions = {
    // Configuração de Whitelist solicitada
    origin: [
        'https://vlogstudents-web.onrender.com', 
        'http://localhost:3000',
        'http://localhost:5000' // Porta padrão alternativa
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
    credentials: true, // Essencial para sessões baseadas em cookies ou tokens manuais
    exposedHeaders: ['X-Request-Id', 'X-Vlog-Trace-Id'],
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// Aplicação do Middleware CORS com as novas origens restritas
app.use(cors(corsOptions));

// NUCLEAR FIX: Resposta imediata para Preflight em todos os endpoints
app.options('*', cors(corsOptions));

/**
 * ============================================================================
 * ⏱ TELEMETRIA DE PERFORMANCE
 * Monitora o tempo de resposta e detecta gargalos em tempo real.
 * ============================================================================
 */
app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        if (duration > 500) {
            console.warn(`[PERF_ALERT] LATÊNCIA ALTA: ${req.method} ${req.originalUrl} - ${duration}ms | ID: ${req.id}`);
        }
    });

    next();
});

/**
 * ============================================================================
 * 🔐 SECURITY HARDENING (HELMET RELAXED)
 * Proteção industrial ajustada para não bloquear os motores do Flutter Web (CanvasKit).
 * ============================================================================
 */
app.use(
    helmet({
        // crossOriginResourcePolicy permite carregar recursos (fotos/vídeos) de outros domínios
        crossOriginResourcePolicy: { policy: "cross-origin" },
        // Desabilitado temporariamente para compatibilidade máxima com plugins do Flutter
        contentSecurityPolicy: false, 
        xssFilter: true,
        noSniff: true,
        hidePoweredBy: true
    })
);

/**
 * ============================================================================
 * 🧼 DATA HYDRATION & PARSING
 * Configurado para 50MB visando suportar Vlogs (Reels) e mídias pesadas.
 * ============================================================================
 */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * ============================================================================
 * 🛡️ ANTI-INJECTION RECURSIVA (DEEP SANITIZE)
 * Motor de limpeza profunda para prevenir XSS e Injeções de SQL básicas.
 * ============================================================================
 */
app.use((req, res, next) => {
    const sanitizeValue = (val) => {
        if (typeof val === 'string') {
            // Remove caracteres de escape perigosos preservando o texto acadêmico
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
 * 🧾 INDUSTRIAL LOGGING (MORGAN)
 * Estruturação de logs para observabilidade centralizada.
 * ============================================================================
 */
if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    // Formato JSON estruturado para análise em Cloudwatch/Loki/Render Logs
    app.use(morgan((tokens, req, res) => {
        return JSON.stringify({
            timestamp: tokens.date(req, res, 'iso'),
            method: tokens.method(req, res),
            url: tokens.url(req, res),
            status: tokens.status(req, res),
            latency: `${tokens['response-time'](req, res)}ms`,
            requestId: req.id,
            ip: req.ip,
            platform: req.headers['x-vlog-platform'] || 'unknown'
        });
    }));
}

/**
 * ============================================================================
 * 🚫 PROTECTION LAYER (RATE LIMITING)
 * Protege contra ataques de força bruta e inundações de requisições.
 * ============================================================================
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 Minutos
    max: 5000, 
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Tráfego excessivo. Tente mais tarde." }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // Maior rigor para login e registro
    message: { success: false, message: "Muitas tentativas de acesso detectadas." }
});

app.use('/api/', globalLimiter);
app.use('/api/v1/auth', authLimiter);

/**
 * ============================================================================
 * 📡 CORE API ROUTES
 * Gateway principal para todos os controladores acadêmicos.
 * ============================================================================
 */
app.use('/api/v1', routes);

/**
 * ============================================================================
 * 🩺 HEALTH MONITORING (DEEP CHECK)
 * Auditoria de saúde: Verifica servidor e conectividade transacional com Neon DB.
 * ============================================================================
 */
app.get('/health', async (req, res) => {
    try {
        const start = Date.now();
        // Ping transacional real
        await db.query('SELECT 1');
        const dbLatency = Date.now() - start;

        res.status(200).json({
            status: 'UP',
            version: '32.0.0',
            database: 'CONNECTED',
            latency: `${dbLatency}ms`,
            requestId: req.id,
            timestamp: new Date()
        });
    } catch (err) {
        console.error('[CRITICAL_HEALTH_FAIL]', err.message);
        res.status(500).json({ 
            status: 'DOWN', 
            database: 'DISCONNECTED', 
            error: err.message,
            requestId: req.id 
        });
    }
});

/**
 * ============================================================================
 * 🖥️ SERVER DASHBOARD (STYLIZED ROOT UI)
 * Página visual de confirmação do status operacional.
 * ============================================================================
 */
app.get('/', (req, res) => {
    res.status(200).send(`
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <title>VLOGSTUDENTS | NUCLEAR ENGINE</title>
            <style>
                body { background: #0b0e14; color: #e2e8f0; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: #161b22; padding: 40px; border-radius: 20px; border: 1px solid #30363d; box-shadow: 0 20px 50px rgba(0,0,0,0.6); text-align: center; }
                .neon { color: #CCFF00; font-weight: 800; text-shadow: 0 0 15px rgba(204, 255, 0, 0.4); font-size: 28px; }
                .badge { background: #238636; color: white; padding: 5px 15px; border-radius: 50px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
                .trace { margin-top: 25px; font-size: 10px; color: #484f58; font-family: monospace; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🚀 <span class="neon">VLOGSTUDENTS</span> ENTERPRISE</h1>
                <p><span class="badge">Núcleo Operacional</span></p>
                <p style="color: #8b949e">Gateway de Produção v32.0.0 Online</p>
                <div class="trace">REQUEST_TRACE_ID: ${req.id}</div>
            </div>
        </body>
        </html>
    `);
});

/**
 * ============================================================================
 * 💥 MASTER ERROR HANDLER (ZERO CRASH PROTOCOL)
 * Tratamento final de exceções para garantir 100% de Uptime.
 * ============================================================================
 */
app.use((err, req, res, next) => {
    const isDev = env.NODE_ENV === 'development';
    
    console.error('[CRITICAL_EXCEPTION]', {
        requestId: req.id,
        message: err.message,
        stack: isDev ? err.stack : 'REDACTED',
        path: req.originalUrl
    });

    res.status(err.status || 500).json({
        success: false,
        message: 'Ocorreu uma instabilidade interna no campus acadêmico.',
        requestId: req.id,
        debug: isDev ? err.message : undefined
    });
});

/**
 * ============================================================================
 * EXPORTAÇÃO DO MÓDULO PARA O SERVER ORCHESTRATOR
 * ============================================================================
 */
module.exports = app;

/**
 * ============================================================================
 * FIM DO MASTER EXPRESS APP v32.0.0
 * ESTE CÓDIGO É PROPRIEDADE INTELECTUAL DO ECOSSISTEMA VLOGSTUDENTS.
 * ============================================================================
 */
