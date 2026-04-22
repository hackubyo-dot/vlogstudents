// FILE: src/server.js
const app = require('./app');
const http = require('http');
const env = require('./config/env');
const dbInit = require('./database/init');
const socketService = require('./services/socketService');

/**
 * VlogStudents Master Server Entrypoint
 */
const server = http.createServer(app);

const startServer = async () => {
  try {
    console.log('--- VLOGSTUDENTS ENTERPRISE BOOT ---');

    // 1. Inicializa esquema do Banco de Dados
    await dbInit();

    // 2. Inicializa o motor WebSocket
    socketService.init(server);

    // 3. Inicia o escuta na porta definida
    server.listen(env.PORT, () => {
      console.log(`[SERVER] API rodando na porta: ${env.PORT}`);
      console.log(`[SERVER] Ambiente: ${env.NODE_ENV.toUpperCase()}`);
      console.log(`[SERVER] Endpoint Health: http://localhost:${env.PORT}/health`);
    });

  } catch (error) {
    console.error('[BOOT_ERROR] Falha crítica ao iniciar servidor:', error.message);
    process.exit(1); // Encerra com erro para reinicialização do container
  }
};

// Tratamento de sinais de encerramento para Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM recebido. Encerrando conexões...');
  server.close(() => {
    console.log('[SERVER] Servidor encerrado.');
    process.exit(0);
  });
});

startServer();