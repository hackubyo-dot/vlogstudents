require('dotenv').config();

const app = require('./app'); // ✅ corrigido
const env = require('./src/config/env');
const initializeDatabase = require('./src/database/init');

const PORT = env.PORT || 3000;

const startServer = async () => {
    try {
        console.log('--- INICIANDO VLOGSTUDENTS ENTERPRISE ---');

        await initializeDatabase();

        app.listen(PORT, () => {
            console.log(`[SERVER] Rodando com sucesso na porta ${PORT}`);
            console.log(`[SERVER] Ambiente: ${env.NODE_ENV}`);
            console.log(`[SERVER] API Base: /api/v1`);
        });

    } catch (error) {
        console.error('[FATAL ERROR] Falha ao iniciar aplicação:', error);
        process.exit(1);
    }
};

startServer();
