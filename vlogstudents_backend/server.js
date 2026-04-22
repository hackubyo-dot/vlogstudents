/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER SERVER ENTRYPOINT
 * Produção Real | Zero Error Policy | High Performance
 * ============================================================================
 */
const app = require('./app');
const env = require('./src/config/env');
const initializeDatabase = require('./src/database/init');
const dns = require('dns');

/**
 * [RENDER_NET_FIX] Força o Node.js a priorizar IPv4 sobre IPv6.
 * Impede o erro ENETUNREACH ao conectar com o Neon/AWS no ambiente do Render.
 */
dns.setDefaultResultOrder('ipv4first');

const startServer = async () => {
    try {
        console.log('----------------------------------------------------');
        console.log('--- VLOGSTUDENTS ENTERPRISE BOOTING ---');
        console.log('----------------------------------------------------');
        
        console.log(`[SYSTEM] Node Version: ${process.version}`);
        console.log(`[SYSTEM] Environment: ${env.NODE_ENV.toUpperCase()}`);

        // 1. SINCRONIZAÇÃO DE INFRAESTRUTURA (NEON POSTGRES)
        // Garante que o banco de dados está atualizado antes de aceitar tráfego
        console.log('[SYSTEM] Auditando integridade do banco de dados...');
        await initializeDatabase();
        
        // 2. INICIALIZAÇÃO DO MOTOR EXPRESS
        const PORT = env.PORT || 3000;
        const server = app.listen(PORT, () => {
            console.log('----------------------------------------------------');
            console.log(`[SERVER] STATUS: OPERATIONAL`);
            console.log(`[SERVER] ENDPOINT: http://localhost:${PORT}/api/v1`);
            console.log(`[SERVER] HEALTH: http://localhost:${PORT}/health`);
            console.log('----------------------------------------------------');
        });

        // 3. GESTÃO DE ENCERRAMENTO (GRACEFUL SHUTDOWN)
        process.on('SIGTERM', () => {
            console.log('[SYSTEM] SIGTERM recebido. Encerrando conexões ativas...');
            server.close(() => {
                console.log('[SYSTEM] Processo finalizado com segurança.');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('----------------------------------------------------');
        console.error('[FATAL_BOOT_ERROR] Falha crítica na ignição do servidor:');
        console.error(`DETALHES: ${error.message}`);
        console.error('----------------------------------------------------');
        process.exit(1);
    }
};

// Captura global de exceções não tratadas para evitar crash silencioso
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
