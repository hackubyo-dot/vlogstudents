/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER SERVER v21.0.0 (ULTIMATE MASTER)
 * HTTP | EXPRESS | SOCKET.IO SIGNALING | PRO MONITORING | ZERO ERROR
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Engenharia de Infraestrutura:
 * - Anti-Latency: Fix de DNS para priorizar IPv4 (Conexão acelerada com Neon).
 * - Realtime Core: Engine Socket.io preparada para Handshake WebRTC (Video Calls).
 * - industrial Monitoring: Health Check avançado com latência de banco de dados.
 * - Route Scanner: Mapeamento automático de endpoints na inicialização.
 * - Dashboard 2.0: Interface web industrial para status do servidor em tempo real.
 * ============================================================================
 */

const http = require('http');
const os = require('os');
const dns = require('dns');

const app = require('./app');
const env = require('./src/config/env');
const initializeDatabase = require('./src/database/init');
const db = require('./src/config/db');

const { Server } = require('socket.io');

// ============================================================================
// ⚡ NETWORK & PERFORMANCE OPTIMIZATION
// ============================================================================
// Prioriza IPv4 para evitar "stalls" na resolução de nomes com o Neon DB
dns.setDefaultResultOrder('ipv4first');

// ============================================================================
// 📡 SERVER & SOCKET ORCHESTRATION
// ============================================================================
const server = http.createServer(app);

// Inicializa Socket.io com suporte a Signaling (WebRTC) e CORS Industrial
const io = new Server(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true // Compatibilidade retroativa
});

// Injeção do Gerenciador de Sockets (Chat + Call Signaling)
const { initializeSocket } = require('./src/socket/socketManager');
initializeSocket(io);

// ============================================================================
// 🎨 DASHBOARD HTML (VISUAL MASTER NEON)
// ============================================================================
const dashboardHTML = () => `
<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <title>VLOGSTUDENTS | MASTER CONTROL</title>
    <style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0b0e14; color: #e2e8f0; text-align: center; padding: 40px; margin: 0; }
        .container { max-width: 1200px; margin: 0 auto; }
        .card { background: #161b22; padding: 25px; border-radius: 16px; margin: 10px; display: inline-block; width: 200px; border: 1px solid #30363d; transition: 0.3s; vertical-align: top; }
        .card:hover { border-color: #CCFF00; transform: translateY(-5px); box-shadow: 0 10px 20px rgba(204, 255, 0, 0.1); }
        .status { font-size: 22px; font-weight: bold; margin-bottom: 8px; }
        .label { font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: 1px; }
        .ok { color: #CCFF00; }
        h1 { color: #CCFF00; font-size: 3.5rem; margin-bottom: 5px; letter-spacing: -3px; }
        p.subtitle { font-size: 1.2rem; color: #8b949e; margin-bottom: 40px; }
        .endpoint-bar { color: #8b949e; font-family: 'Cascadia Code', monospace; background: #0d1117; padding: 15px; border-radius: 12px; margin-top: 50px; border: 1px dashed #30363d; }
        .pulse { animation: pulse-animation 2s infinite; }
        @keyframes pulse-animation { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 VLOGSTUDENTS</h1>
        <p class="subtitle">Enterprise Infrastructure v21.0.0</p>

        <div class="card">
            <div class="status ok pulse">ONLINE</div>
            <div class="label">System Engine</div>
        </div>

        <div class="card">
            <div class="status">${env.NODE_ENV.toUpperCase()}</div>
            <div class="label">Environment</div>
        </div>

        <div class="card">
            <div class="status">${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB</div>
            <div class="label">Memory usage</div>
        </div>

        <div class="card">
            <div class="status">${os.cpus().length} CORES</div>
            <div class="label">CPU Architecture</div>
        </div>

        <div class="card">
            <div class="status">v${process.version}</div>
            <div class="label">Node Runtime</div>
        </div>

        <div class="card">
            <div class="status">${Math.floor(process.uptime() / 60)} MIN</div>
            <div class="label">Active Uptime</div>
        </div>

        <div class="endpoint-bar">
            CORE: /api/v1 | SOCKETS: SIGNALING_ACTIVE | DB: NEON_CLOUD_CONNECTED | REGION: ${os.hostname()}
        </div>
    </div>
</body>
</html>
`;

// ============================================================================
// 📡 ADVANCED MONITORING ENDPOINTS
// ============================================================================

// 📊 HEALTH CHECK (Latência de Banco + Métricas de Sistema)
app.get('/health', async (req, res) => {
    try {
        const start = Date.now();
        await db.query('SELECT 1'); // Ping no Neon DB
        const dbLatency = Date.now() - start;

        res.json({
            status: 'Operational',
            version: '21.0.0',
            uptime: `${Math.floor(process.uptime())}s`,
            database: {
                status: 'Connected',
                latency: `${dbLatency}ms`
            },
            system: {
                load: os.loadavg(),
                freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`
            },
            timestamp: new Date()
        });
    } catch (err) {
        res.status(500).json({
            status: 'Degraded',
            database: 'Disconnected',
            error: err.message
        });
    }
});

// 🖥 DASHBOARD WEB
app.get('/', (req, res) => res.send(dashboardHTML()));

// ============================================================================
// 🔍 ROUTE SCANNER LOGIC (DEBUG & AUDIT)
// ============================================================================
const scanAndPrintRoutes = (app) => {
    console.log('[SCANNER] 📚 Mapeando malha de rotas...');
    const routes = [];

    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            routes.push({
                method: Object.keys(middleware.route.methods)[0].toUpperCase(),
                path: middleware.route.path
            });
        } else if (middleware.name === 'router') {
            middleware.handle.stack.forEach((handler) => {
                if (handler.route) {
                    routes.push({
                        method: Object.keys(handler.route.methods)[0].toUpperCase(),
                        path: '/api/v1' + handler.route.path
                    });
                }
            });
        }
    });

    console.log(`[SCANNER] ✅ ${routes.length} endpoints registrados.`);
    return routes;
};

// ============================================================================
// 🚀 MASTER BOOTSTRAP SEQUENCE
// ============================================================================
const startServer = async () => {
    try {
        console.log('\n====================================================');
        console.log('🚀 VLOGSTUDENTS ENTERPRISE MASTER BOOT');
        console.log('====================================================');

        // 1. DATABASE AUDIT & INITIALIZATION
        console.log('[DATABASE] 🔍 Executando Auto-Healing...');
        await initializeDatabase();
        console.log('[DATABASE] ✅ Schema Sincronizado.');

        // 2. PORT SELECTION
        const PORT = env.PORT || 3000;

        // 3. LISTEN PROTOCOL
        server.listen(PORT, () => {
            console.log('----------------------------------------------------');
            console.log(`✅ SERVER: http://localhost:${PORT}`);
            console.log(`📡 REALTIME: Handshake Signaling pronto`);
            console.log(`❤️ HEALTH: http://localhost:${PORT}/health`);
            console.log('----------------------------------------------------');

            // Mapeamento visual das rotas para o log industrial
            if (env.NODE_ENV !== 'production') {
                const routes = scanAndPrintRoutes(app);
                routes.forEach(r => console.log(`  → [${r.method}] ${r.path}`));
            }
        });

        // ============================================================================
        // 🧨 GRACEFUL SHUTDOWN & ERROR HANDLING
        // ============================================================================
        process.on('SIGTERM', () => {
            console.log('[SYSTEM] ⚠️ SIGTERM Recebido. Encerrando conexões...');
            server.close(() => {
                console.log('[SYSTEM] 💀 Nuclear Shutdown Complete.');
                process.exit(0);
            });
        });

        process.on('uncaughtException', (err) => {
            console.error('[CRITICAL_EXCEPTION] 🧨', err);
            // Em produção, aqui dispararíamos um alerta (Sentry/DataDog)
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('[UNHANDLED_REJECTION] ⚠️ em:', promise, 'motivo:', reason);
        });

    } catch (error) {
        console.error('\n❌ [BOOT_ERROR] Falha catastrófica no arranque:', error);
        process.exit(1);
    }
};

// INITIALIZE
startServer();
