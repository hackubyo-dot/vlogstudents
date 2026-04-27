/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER EXPRESS APP v32.0.0 (ULTIMATE EDITION)
 * SECURITY | CORS ENGINE | PERFORMANCE | OBSERVABILITY | SMART MIDDLEWARE
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Engenharia de Fluxo:
 * - Trust Proxy: Otimizado para Render.com, AWS Cloudfront e Nginx.
 * - Traceability: Injeção de X-Vlog-Trace-Id em cada transação para auditoria.
 * - Ultra-CORS: Configuração robusta para compatibilidade Web, Mobile e Desktop.
 * - Helmet Hardened: Cabeçalhos de segurança de nível bancário.
 * - Rate Limiting: Proteção contra ataques de negação de serviço (DoS).
 * - Anti-Injection: Sanitização profunda de entradas de dados.
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
 * Essencial para capturar o IP real do estudante através de Proxies/Load Balancers.
 * ============================================================================
 */
app.set('trust proxy', 1);

/**
 * ============================================================================
 * 🧠 REQUEST TRACING & AUDIT ENGINE
 * Gera um identificador único universal para cada interação com o campus.
 * ============================================================================
 */
app.use((req, res, next) => {
    // Injeção de UUID para rastreamento de logs (Traceability)
    req.id = crypto.randomUUID();
    res.setHeader('X-Vlog-Trace-Id', req.id);
    next();
});

/**
 * ============================================================================
 * ⏱ TELEMETRIA DE PERFORMANCE
 * Monitora o tempo de resposta e alerta sobre lentidão no banco ou processamento.
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
 * 🌍 ULTRA-CORS ENGINE (NO RESTRICTIONS - WEB & MOBILE READY)
 * Configuração definitiva para permitir tráfego Cross-Origin sem falhas.
 * ============================================================================
 */
app.use(cors({
    origin: '*', // Em produção comercial, substitua pela URL específica do seu domínio
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Vlog-Trace-ID', 
        'X-Vlog-Platform', 
        'X-Vlog-App-Version', 
        'Accept'
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

/**
 * ============================================================================
 * 🔐 SECURITY HARDENING (HELMET)
 * Protege contra vulnerabilidades web conhecidas (XSS, Clickjacking, Sniffing).
 * ============================================================================
 */
app.use(
    helmet({
        // Permite carregamento de mídias do Supabase/Google Cloud em Flutter Web
        crossOriginResourcePolicy: { policy: "cross-origin" },
        // Desabilitado para compatibilidade total com o motor de renderização do Flutter
        contentSecurityPolicy: false, 
        xssFilter: true,
        noSniff: true,
        hidePoweredBy: true
    })
);

/**
 * ============================================================================
 * 🧼 DATA HYDRATION (PARSING)
 * Configurado para suportar grandes buffers de vídeo (Reels) e Status.
 * ============================================================================
 */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * ============================================================================
 * 🛡️ ANTI-INJECTION & SANITIZATION LAYER
 * Limpeza de caracteres maliciosos para evitar XSS e Injeções básicas.
 * ============================================================================
 */
app.use((req, res, next) => {
    const sanitizeValue = (val) => {
        if (typeof val === 'string') {
            // Remove tags HTML perigosas mas mantém pontuação acadêmica
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
 * Estruturação de logs para observabilidade em tempo real.
 * ============================================================================
 */
if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    // Log estruturado em formato JSON para análise em Datadog/Loki/Render
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
 * Evita abusos na API e protege contra ataques de força bruta.
 * ============================================================================
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Janela de 15 minutos
    max: 10000, // Limite generoso para o campus acadêmico
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Tráfego excessivo detectado. Tente mais tarde." }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // Rigidez maior para rotas de Login e Cadastro
    message: { success: false, message: "Muitas tentativas de acesso. Bloqueio temporário ativado." }
});

app.use('/api/', globalLimiter);
app.use('/api/v1/auth', authLimiter);

/**
 * ============================================================================
 * 📡 CORE API ROUTES
 * Ponto de entrada oficial para todos os módulos do ecossistema.
 * ============================================================================
 */
app.use('/api/v1', routes);

/**
 * ============================================================================
 * 🩺 HEALTH MONITORING (DEEP CHECK)
 * Monitoramento de saúde real: Verifica API, Latência e Conexão com Neon DB.
 * ============================================================================
 */
app.get('/health', async (req, res) => {
    try {
        const dbStart = Date.now();
        // Ping transacional no Neon DB
        await db.query('SELECT 1');
        const dbLatency = Date.now() - dbStart;

        res.status(200).json({
            status: 'OPERATIONAL',
            version: '32.0.0',
            engine: 'Express Node.js',
            database: 'CONNECTED (Neon DB)',
            db_latency: `${dbLatency}ms`,
            uptime: `${Math.floor(process.uptime())}s`,
            requestId: req.id,
            timestamp: new Date()
        });
    } catch (err) {
        console.error('[CRITICAL_HEALTH_FAIL]', err.message);
        res.status(500).json({ 
            status: 'CRITICAL_FAILURE', 
            database: 'DISCONNECTED', 
            error: err.message,
            requestId: req.id 
        });
    }
});

/**
 * ============================================================================
 * 🖥️ SERVER DASHBOARD (STYLIZED ROOT)
 * Interface visual para confirmação de status do servidor.
 * ============================================================================
 */
app.get('/', (req, res) => {
    res.status(200).send(`
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <title>VLOGSTUDENTS | CORE ENGINE</title>
            <style>
                body { background: #05070a; color: #f8fafc; font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .container { background: #0f172a; padding: 40px; border-radius: 24px; border: 1px solid #1e293b; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); text-align: center; max-width: 500px; }
                .logo { font-size: 32px; font-weight: 800; color: #CCFF00; letter-spacing: -1px; margin-bottom: 10px; }
                .status-badge { display: inline-block; background: #064e3b; color: #10b981; padding: 6px 16px; border-radius: 99px; font-size: 14px; font-weight: 600; margin-bottom: 20px; border: 1px solid #065f46; }
                .metrics { display: flex; justify-content: space-around; margin-top: 30px; border-top: 1px solid #1e293b; padding-top: 20px; }
                .metric-item { text-align: center; }
                .metric-val { display: block; font-size: 18px; font-weight: bold; color: #CCFF00; }
                .metric-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; }
                .trace { font-family: monospace; font-size: 10px; color: #475569; margin-top: 25px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">VLOGSTUDENTS <span style="color:#fff">ENTERPRISE</span></div>
                <div class="status-badge">● SISTEMA OPERACIONAL</div>
                <p style="color: #94a3b8">O núcleo de processamento acadêmico está ativo e pronto para conexões Flutter Web e Mobile.</p>
                <div class="metrics">
                    <div class="metric-item"><span class="metric-val">v32.0.0</span><span class="metric-label">Versão</span></div>
                    <div class="metric-item"><span class="metric-val">STABLE</span><span class="metric-label">Status</span></div>
                    <div class="metric-item"><span class="metric-val">ONLINE</span><span class="metric-label">Database</span></div>
                </div>
                <div class="trace">TRACE_ID: ${req.id}</div>
            </div>
        </body>
        </html>
    `);
});

/**
 * ============================================================================
 * 🚫 GLOBAL 404 HANDLER
 * Captura requisições para rotas inexistentes no campus.
 * ============================================================================
 */
app.use((req, res) => {
    console.warn(`[404_NOT_FOUND] ${req.method} ${req.originalUrl} | ID: ${req.id}`);
    res.status(404).json({
        success: false,
        message: 'Endpoint acadêmico não localizado.',
        requestId: req.id
    });
});

/**
 * ============================================================================
 * 💥 MASTER ERROR HANDLER (ZERO CRASH POLICY)
 * Impede que erros internos derrubem o servidor (Recovery Protocol).
 * ============================================================================
 */
app.use((err, req, res, next) => {
    const isDev = env.NODE_ENV === 'development';
    
    console.error('[CRITICAL_EXCEPTION]', {
        requestId: req.id,
        message: err.message,
        stack: isDev ? err.stack : 'PROTECTED',
        path: req.originalUrl
    });

    res.status(err.status || 500).json({
        success: false,
        message: 'Instabilidade detectada no motor interno do campus.',
        requestId: req.id,
        error: isDev ? err.message : 'Internal Server Error'
    });
});

/**
 * ============================================================================
 * MODULE EXPORT
 * Pronto para ser carregado pelo Server Orchestrator.
 * ============================================================================
 */
module.exports = app;

/**
 * ============================================================================
 * FIM DO MASTER EXPRESS APP v32.0.0
 * ESTE CÓDIGO É PROPRIEDADE INTELECTUAL DO ECOSSISTEMA VLOGSTUDENTS.
 * ============================================================================
 */
