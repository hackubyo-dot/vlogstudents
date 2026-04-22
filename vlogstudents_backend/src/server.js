const app = require('./app');
const env = require('./config/env');
const initializeDatabase = require('./database/init');

const PORT = env.PORT || 3000;

const startServer = async () => {
    try {
        console.log('--- INICIANDO VLOGSTUDENTS ENTERPRISE ---');

        // 1. Garante que o Banco de Dados está pronto (Auto-healing)
        await initializeDatabase();

        // 2. Sobe o servidor
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