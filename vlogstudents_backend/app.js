/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER EXPRESS APP v32.0.0 (ULTIMATE NUCLEAR EDITION)
 * SECURITY | NUCLEAR CORS ENGINE | PERFORMANCE | OBSERVABILITY | WEB & MOBILE SYNC
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Engenharia de Fluxo:
 * - Trust Proxy: Otimizado para Render.com, AWS Cloudfront e Nginx.
 * - Traceability: Injeção de X-Vlog-Trace-Id e X-Request-Id em cada transação.
 * - Nuclear CORS: Configuração agressiva para resolver bloqueios de Preflight na Web.
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
 * ☢️ NUCLEAR CORS ENGINE (WEB & MOBILE COMPATIBILITY)
 * Resolve permanentemente erros de 'CORS Preflight' e 'Method Not Allowed' na Web.
 * ============================================================================
 */
const corsOptions = {
    // origin: true reflete a origem da requisição, ideal para múltiplos domínios
    origin: true, 
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

// Aplica o Middleware de CORS globalmente
app.use(cors(corsOptions));

// NUCLEAR FIX: Responder imediatamente a requisições OPTIONS (Preflight) em todas as rotas
app.options('*', cors(corsOptions));

/**
 * ============================================================================
 * 🧠 REQUEST TRACING & AUDIT ENGINE
 * Injeta identificadores únicos para auditoria e monitoramento.
 * ============================================================================
 */
app.use((req, res, next) => {
    // Gera UUID para rastreamento de logs (Traceability)
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    res.setHeader('X-Vlog-Trace-Id', req.id);
    next();
});

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
 * Proteção industrial ajustada para não bloquear mídias e scripts do Flutter Web.
 * ============================================================================
 */
app.use(
    helmet({
        // crossOriginResourcePolicy permite carregar fotos do Supabase/Firebase no Flutter
        crossOriginResourcePolicy: { policy: "cross-origin" },
        // contentSecurityPolicy desabilitado para compatibilidade com o motor CanvasKit do Flutter
        contentSecurityPolicy: false, 
        xssFilter: true,
        noSniff: true,
        hidePoweredBy: true
    })
);

/**
 * ============================================================================
 * 🧼 DATA HYDRATION (PARSING)
 * Limite de 50MB para suportar uploads de vídeo (Reels) e Status.
 * ============================================================================
 */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * ============================================================================
 * 🛡️ ANTI-INJECTION RECURSIVA (DEEP SANITIZE)
 * Sanitização automática de entradas para prevenir injeções básicas e XSS.
 * ============================================================================
 */
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
 * 🧾 INDUSTRIAL LOGGING (MORGAN)
 * Estruturação de logs para observabilidade.
 * ============================================================================
 */
if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    // Log estruturado JSON para produção
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
 * Protege contra spam de requisições e ataques de força bruta.
 * ============================================================================
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5000, 
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Tráfego excessivo. Tente novamente mais tarde." }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // Limite para rotas críticas de login/registro
    message: { success: false, message: "Muitas tentativas de acesso. Bloqueio preventivo ativado." }
});

app.use('/api/', globalLimiter);
app.use('/api/v1/auth', authLimiter);

/**
 * ============================================================================
 * 📡 CORE API ROUTES
 * Ponto de entrada master para a v1 da API.
 * ============================================================================
 */
app.use('/api/v1', routes);

/**
 * ============================================================================
 * 🩺 HEALTH MONITORING (DEEP CHECK)
 * Monitora a saúde do servidor e a conectividade real com o Neon DB.
 * ============================================================================
 */
app.get('/health', async (req, res) => {
    try {
        const start = Date.now();
        // Ping transacional no banco de dados
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
 * Página de confirmação visual do status operacional.
 * ============================================================================
 */
app.get('/', (req, res) => {
    res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>VLOGSTUDENTS | NUCLEAR ENGINE</title>
            <style>
                body { background: #0b0e14; color: #e2e8f0; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: #161b22; padding: 40px; border-radius: 20px; border: 1px solid #30363d; box-shadow: 0 20px 50px rgba(0,0,0,0.6); text-align: center; }
                .neon { color: #CCFF00; font-weight: 800; text-shadow: 0 0 15px rgba(204, 255, 0, 0.4); font-size: 28px; }
                .badge { background: #238636; color: white; padding: 5px 15px; border-radius: 50px; font-size: 12px; font-weight: bold; }
                .footer { margin-top: 20px; font-size: 10px; color: #484f58; font-family: monospace; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🚀 <span class="neon">VLOGSTUDENTS</span> ENTERPRISE</h1>
                <p><span class="badge">OPERACIONAL</span></p>
                <p style="color: #8b949e">Núcleo Node.js v32.0.0 Online</p>
                <div class="footer">TRACE_ID: ${req.id}</div>
            </div>
        </body>
        </html>
    `);
});

/**
 * ============================================================================
 * 💥 GLOBAL ERROR HANDLER (ZERO CRASH PROTOCOL)
 * Tratamento centralizado de exceções para evitar interrupções no serviço.
 * ============================================================================
 */
app.use((err, req, res, next) => {
    const isDev = env.NODE_ENV === 'development';
    
    // Log detalhado para o engenheiro
    console.error('[CRITICAL_EXCEPTION]', {
        requestId: req.id,
        message: err.message,
        stack: isDev ? err.stack : 'PROTECTED',
        path: req.originalUrl
    });

    res.status(err.status || 500).json({
        success: false,
        message: 'Instabilidade detectada no núcleo acadêmico.',
        requestId: req.id,
        // Exponencializa o erro apenas em desenvolvimento
        debug: isDev ? err.message : undefined
    });
});

/**
 * ============================================================================
 * EXPORTAÇÃO DO MÓDULO
 * ============================================================================
 */
module.exports = app;

/**
 * ============================================================================
 * FIM DO MASTER EXPRESS APP v32.0.0
 * ESTE CÓDIGO É PROPRIEDADE INTELECTUAL DO ECOSSISTEMA VLOGSTUDENTS.
 * PRODUZIDO POR MASTER SOFTWARE ENGINEER.
 * ============================================================================
 */
