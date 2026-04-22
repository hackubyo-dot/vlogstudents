const http = require('http');
const app = require('./app');
const env = require('./config/env');
const initializeDatabase = require('./database/init');
const socketService = require('./services/socketService');

const server = http.createServer(app);

const startServer = async () => {
    try {
        console.log('[SERVER] Iniciando VlogStudents Master Kernel...');

        // 1. Garantir que o Banco de Dados está pronto (Auto-healing)
        await initializeDatabase();

        // 2. Inicializar Motor Realtime (Socket.io)
        socketService.init(server);
        console.log('[REALTIME] Engine Socket.io pronto para conexões.');

        // 3. Levantar servidor HTTP + WebSockets
        server.listen(env.port, () => {
            console.log(`+-------------------------------------------+`);
            console.log(`| VLOGSTUDENTS ENTERPRISE API IS ONLINE     |`);
            console.log(`| PORTA: ${env.port}                               |`);
            console.log(`| MODO:  ${env.nodeEnv.toUpperCase()}                    |`);
            console.log(`+-------------------------------------------+`);
        });

    } catch (error) {
        console.error('[FATAL ERROR] Falha no boot do servidor:', error);
        process.exit(1);
    }
};

startServer();