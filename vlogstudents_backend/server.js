/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER SERVER v16.0.0 (FINAL STABLE)
 * HTTP + EXPRESS + SOCKET.IO + DATABASE INIT
 * ============================================================================
 */

const http = require('http');

// ✅ APP ESTÁ NA RAIZ
const app = require('./app');

// ✅ CONFIGS E CORE (DENTRO DE /src)
const env = require('./src/config/env');
const initializeDatabase = require('./src/database/init');

// SOCKET.IO
const { Server } = require('socket.io');

// NETWORK FIX
const dns = require('dns');

// ============================================================================
// 🔧 FIX RENDER (IPv6 → IPv4)
// ============================================================================
dns.setDefaultResultOrder('ipv4first');

// ============================================================================
// 🌐 CRIA SERVIDOR HTTP (OBRIGATÓRIO PARA SOCKET.IO)
// ============================================================================
const server = http.createServer(app);

// ============================================================================
// ⚡ SOCKET.IO ENGINE (REALTIME)
// ============================================================================
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ============================================================================
// 🔌 INICIALIZA SOCKET MANAGER
// ============================================================================
const { initializeSocket } = require('./src/socket/socketManager');
initializeSocket(io);

// ============================================================================
// 🚀 START SERVER
// ============================================================================
const startServer = async () => {
    try {
        console.log('----------------------------------------------------');
        console.log('--- VLOGSTUDENTS ENTERPRISE BOOTING ---');
        console.log('----------------------------------------------------');

        console.log(`[SYSTEM] Node: ${process.version}`);
        console.log(`[SYSTEM] ENV: ${env.NODE_ENV.toUpperCase()}`);

        // ===============================
        // 🧠 DATABASE INIT (AUTO-HEALING)
        // ===============================
        console.log('[DATABASE] Verificando integridade...');
        await initializeDatabase();

        // ===============================
        // 🌍 START SERVER
        // ===============================
        const PORT = env.PORT || 3000;

        server.listen(PORT, () => {
            console.log('----------------------------------------------------');
            console.log(`[SERVER] STATUS: ONLINE`);
            console.log(`[SERVER] PORT: ${PORT}`);
            console.log(`[API] http://localhost:${PORT}/api/v1`);
            console.log(`[HEALTH] http://localhost:${PORT}/health`);
            console.log(`[SOCKET] READY`);
            console.log('----------------------------------------------------');
        });

        // ===============================
        // 🛑 GRACEFUL SHUTDOWN
        // ===============================
        process.on('SIGTERM', () => {
            console.log('[SYSTEM] Encerrando servidor...');
            server.close(() => {
                console.log('[SYSTEM] Shutdown completo.');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('----------------------------------------------------');
        console.error('[FATAL ERROR] Falha ao iniciar servidor:');
        console.error(error);
        console.error('----------------------------------------------------');
        process.exit(1);
    }
};

// ============================================================================
// 🧨 GLOBAL ERROR HANDLING
// ============================================================================
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection:', reason);
});

// ============================================================================
// 🚀 EXECUÇÃO
// ============================================================================
startServer();
