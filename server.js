const http = require('http');
const app = require('./app');
const env = require('./config/env');
const initializeDatabase = require('./database/init');
const socketService = require('./services/socketService');

const server = http.createServer(app);

const startServer = async () => {
    try {
        console.log('[SYSTEM] Iniciando VlogStudents Master Kernel...');

        // 1. Auto-Healing Database
        await initializeDatabase();
        console.log('[DATABASE] Sistema de banco de dados verificado e pronto.');

        // 2. Realtime Engine (Socket.io)
        socketService.init(server);
        console.log('[REALTIME] Engine Socket.io pronto para conexões.');

        // 3. Start HTTP + WebSocket Server
        const PORT = env.port || 3000;

        server.listen(PORT, () => {
            console.log(`+-------------------------------------------+`);
            console.log(`| VLOGSTUDENTS ENTERPRISE ONLINE            |`);
            console.log(`| PORTA: ${PORT}                               |`);
            console.log(`| MODO:  ${env.nodeEnv.toUpperCase()}                    |`);
            console.log(`+-------------------------------------------+`);
        });

    } catch (error) {
        console.error('[FATAL ERROR] Falha no boot do servidor:', error);
        process.exit(1);
    }
};

startServer();