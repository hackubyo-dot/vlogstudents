// FILE: server.js
const app = require('./src/app');
const env = require('./src/config/env');
const initializeDatabase = require('./src/database/init');
const dns = require('dns');

/**
 * FIX CRÍTICO PARA RENDER/ENETUNREACH: 
 * O Node.js tenta usar IPv6 por padrão, o que causa erro no Render.
 * Esta linha força o uso de IPv4 (padrão de rede estável).
 */
dns.setDefaultResultOrder('ipv4first');

const startServer = async () => {
    try {
        console.log('----------------------------------------------------');
        console.log('--- VLOGSTUDENTS ENTERPRISE BOOTING ---');
        console.log('----------------------------------------------------');
        
        // 1. Sincroniza tabelas no banco de dados Neon
        console.log('[SYSTEM] Verificando integridade das tabelas (Neon)...');
        await initializeDatabase();
        
        // 2. Levanta o servidor Express
        const PORT = env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`[SERVER] STATUS: ONLINE`);
            console.log(`[SERVER] PORTA: ${PORT}`);
            console.log(`[SERVER] MODO: ${env.NODE_ENV.toUpperCase()}`);
            console.log(`[SERVER] ENDPOINT: http://localhost:${PORT}/api/v1`);
            console.log('----------------------------------------------------');
        });
        
    } catch (error) {
        console.error('[FATAL ERROR] Falha catastrófica ao iniciar servidor:');
        console.error(error.message);
        process.exit(1);
    }
};

startServer();
