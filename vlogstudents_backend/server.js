/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER SERVER v22.0.0 (GOLD EDITION)
 * HTTP | EXPRESS | SOCKET.IO SIGNALING | STATIC WEB HOSTING | ZERO ERROR
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Engenharia de Infraestrutura e Roteamento:
 * - Web Frontend Mapping: Aponta a raiz (/) para o diretório vlogstudents_web.
 * - SPA Route Support: Fallback para index.html em rotas não-API.
 * - Signaling Core: Orquestração WebRTC para Chamadas de Voz/Vídeo ativa.
 * - Industrial Monitoring: Dashboard de sistema movido para /system/status.
 * - Anti-Latency: Priorização de IPv4 para comunicação ultra-rápida com Neon.
 * ============================================================================
 */

const http = require('http');
const os = require('os');
const dns = require('dns');
const path = require('path');
const express = require('express');

const app = require('./app');
const env = require('./src/config/env');
const initializeDatabase = require('./src/database/init');
const db = require('./src/config/db');

const { Server } = require('socket.io');

// ============================================================================
// ⚡ NETWORK & PERFORMANCE OPTIMIZATION
// ============================================================================
// Prioriza IPv4 para evitar latência na resolução de DNS do Render/Neon
dns.setDefaultResultOrder('ipv4first');

// ============================================================================
// 📡 SERVER & SOCKET ORCHESTRATION
// ============================================================================
const server = http.createServer(app);

// Inicializa Socket.io com suporte a Signaling (WebRTC) Industrial
const io = new Server(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
});

// Injeção do Gerenciador de Sockets (Chat + Call Signaling)
const { initializeSocket } = require('./src/socket/socketManager');
initializeSocket(io);

// ============================================================================
// 📂 WEB FRONTEND CONFIGURATION (STATIC HOSTING)
// ============================================================================
/**
 * Localização do diretório Web em relação ao Backend.
 * No Render, os diretórios vlogstudents_backend e vlogstudents_web são irmãos.
 */
const webPath = path.join(__dirname, '../vlogstudents_web');

// 1. Servir ficheiros estáticos (CSS, JS, Imagens)
app.use(express.static(webPath));

// ============================================================================
// 🎨 MONITORING DASHBOARD (RELOCATED TO /system/status)
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
        <p class="subtitle">Enterprise Backend Dashboard v22.0.0</p>

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
            FRONTEND: / | API: /api/v1 | MONITOR: /system/status | REGION: ${os.hostname()}
        </div>
    </div>
</body>
</html>
`;

// ============================================================================
// 📡 ROUTING HIERARCHY
// ============================================================================

// 1. Health Check avançado
app.get('/health', async (req, res) => {
    try {
        const start = Date.now();
        await db.query('SELECT 1');
        const dbLatency = Date.now() - start;

        res.json({
            status: 'Operational',
            version: '22.0.0',
            database: { status: 'Connected', latency: `${dbLatency}ms` },
            uptime: `${Math.floor(process.uptime())}s`,
            timestamp: new Date()
        });
    } catch (err) {
        res.status(500).json({ status: 'Degraded', error: err.message });
    }
});

// 2. Dashboard Administrativo
app.get('/system/status', (req, res) => res.send(dashboardHTML()));

// 3. SPA Fallback (Serve o Frontend para qualquer rota não mapeada)
// Isso permite que o usuário atualize a página na Web (#/perfil) sem dar 404
app.get('*', (req, res) => {
    // Se a requisição for para API, deixa o roteador de API tratar (já feito no app.js)
    if (req.path.startsWith('/api/v1')) return;
    
    // Caso contrário, entrega o index.html da web
    res.sendFile(path.join(webPath, 'index.html'));
});

// ============================================================================
// 🚀 MASTER BOOTSTRAP SEQUENCE
// ============================================================================
const startServer = async () => {
    try {
        console.log('\n====================================================');
        console.log('🚀 VLOGSTUDENTS ENTERPRISE MASTER BOOT');
        console.log('====================================================');

        // 1. DATABASE AUDIT & INITIALIZATION
        console.log('[DATABASE] 🔍 Executando Auditoria...');
        await initializeDatabase();
        console.log('[DATABASE] ✅ Pronto.');

        // 2. PORT SELECTION
        const PORT = env.PORT || 3000;

        // 3. LISTEN PROTOCOL
        server.listen(PORT, () => {
            console.log('----------------------------------------------------');
            console.log(`✅ WEB APP: ${env.APP_URL || 'http://localhost:' + PORT}`);
            console.log(`📡 API BASE: http://localhost:${PORT}/api/v1`);
            console.log(`🧠 REALTIME: Signaling Engine Active`);
            console.log(`📊 MONITOR: http://localhost:${PORT}/system/status`);
            console.log('----------------------------------------------------');
        });

        // GRACEFUL SHUTDOWN
        process.on('SIGTERM', () => {
            console.log('[SYSTEM] 💀 Nuclear Shutdown Complete.');
            process.exit(0);
        });

    } catch (error) {
        console.error('\n❌ [BOOT_ERROR] Falha catastrófica:', error);
        process.exit(1);
    }
};

// INITIALIZE
startServer();
