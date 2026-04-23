/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER SERVER v20.0.0 (ULTRA DASHBOARD EDITION)
 * HTTP | EXPRESS | SOCKET.IO | HEALTH UI | ROUTE SCANNER | PRO LOGS
 * ============================================================================
 */

const http = require('http');
const os = require('os');
const dns = require('dns');

const app = require('./app');
const env = require('./src/config/env');
const initializeDatabase = require('./src/database/init');

const { Server } = require('socket.io');

// FIX NETWORK
dns.setDefaultResultOrder('ipv4first');

// CREATE SERVER
const server = http.createServer(app);

// SOCKET.IO
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const { initializeSocket } = require('./src/socket/socketManager');
initializeSocket(io);

// ============================================================================
// 🎨 DASHBOARD HTML (VISUAL PROFISSIONAL)
// ============================================================================
const dashboardHTML = () => `
<!DOCTYPE html>
<html>
<head>
<title>VLOGSTUDENTS SERVER</title>
<style>
body {
    font-family: Arial;
    background: #0f172a;
    color: #e2e8f0;
    text-align: center;
    padding: 40px;
}
.card {
    background: #1e293b;
    padding: 20px;
    border-radius: 12px;
    margin: 15px;
    display: inline-block;
    width: 250px;
    box-shadow: 0 0 20px rgba(0,0,0,0.4);
}
.status {
    font-size: 18px;
    font-weight: bold;
}
.ok { color: #22c55e; }
</style>
</head>
<body>
<h1>🚀 VLOGSTUDENTS ENTERPRISE</h1>
<p>Sistema operacional</p>

<div class="card">
    <div>Status</div>
    <div class="status ok">ONLINE</div>
</div>

<div class="card">
    <div>Environment</div>
    <div>${env.NODE_ENV}</div>
</div>

<div class="card">
    <div>Uptime</div>
    <div>${Math.floor(process.uptime())}s</div>
</div>

<div class="card">
    <div>Memory</div>
    <div>${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB</div>
</div>

<div class="card">
    <div>Platform</div>
    <div>${os.platform()}</div>
</div>

<div class="card">
    <div>CPU</div>
    <div>${os.cpus().length} cores</div>
</div>

<p style="margin-top:40px;">API: /api/v1</p>
<p>Health: /health</p>
</body>
</html>
`;

// ============================================================================
// 📡 HEALTH CHECK AVANÇADO
// ============================================================================
app.get('/health', async (req, res) => {
    try {
        const start = Date.now();
        await require('./src/config/db').query('SELECT 1');
        const dbTime = Date.now() - start;

        res.json({
            status: 'ok',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            database: 'connected',
            dbResponseTime: `${dbTime}ms`,
            timestamp: new Date()
        });

    } catch (err) {
        res.status(500).json({
            status: 'error',
            database: 'down',
            error: err.message
        });
    }
});

// ============================================================================
// 🖥 DASHBOARD WEB
// ============================================================================
app.get('/', (req, res) => {
    res.send(dashboardHTML());
});

// ============================================================================
// 🔍 ROUTE SCANNER (DEBUG)
// ============================================================================
const listRoutes = (app) => {
    const routes = [];

    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            routes.push({
                method: Object.keys(middleware.route.methods)[0].toUpperCase(),
                path: middleware.route.path
            });
        }
    });

    return routes;
};

// ============================================================================
// 🚀 START SERVER
// ============================================================================
const startServer = async () => {
    try {
        console.log('====================================================');
        console.log('🚀 VLOGSTUDENTS ENTERPRISE BOOT');
        console.log('====================================================');

        console.log(`[SYSTEM] Node: ${process.version}`);
        console.log(`[SYSTEM] ENV: ${env.NODE_ENV}`);

        // DATABASE
        console.log('[DATABASE] Inicializando...');
        await initializeDatabase();
        console.log('[DATABASE] OK');

        const PORT = env.PORT || 3000;

        server.listen(PORT, () => {
            console.log('----------------------------------------------------');
            console.log(`✅ SERVER ONLINE`);
            console.log(`🌍 http://localhost:${PORT}`);
            console.log(`📡 API: http://localhost:${PORT}/api/v1`);
            console.log(`❤️ HEALTH: http://localhost:${PORT}/health`);
            console.log(`⚡ SOCKET.IO READY`);
            console.log('----------------------------------------------------');

            // LIST ROUTES
            try {
                const routes = listRoutes(app);
                console.log(`📚 ROTAS REGISTADAS: ${routes.length}`);
                routes.forEach(r => {
                    console.log(`→ ${r.method} ${r.path}`);
                });
            } catch {
                console.log('⚠️ Não foi possível listar rotas.');
            }
        });

        // SHUTDOWN
        process.on('SIGTERM', () => {
            console.log('[SYSTEM] Shutdown...');
            server.close(() => {
                console.log('[SYSTEM] OFFLINE');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('❌ ERRO FATAL:', error);
        process.exit(1);
    }
};

// ============================================================================
// 🧨 GLOBAL ERRORS
// ============================================================================
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL]', err);
});

process.on('unhandledRejection', (err) => {
    console.error('[PROMISE ERROR]', err);
});

// START
startServer();
