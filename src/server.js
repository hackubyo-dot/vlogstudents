/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER ENGINE v4.2.0
 * ORQUESTRADOR CENTRAL - API / REALTIME / CLOUD / GAMIFICATION
 * STATUS: FULL RECONSTRUCTION - ZERO OMISSION
 * ============================================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const morgan = require('morgan');
const path = require('path');

// Importação das Rotas Master
// Nota: Caminhos relativos à pasta 'src' (Root Directory no Render)
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes'); // Inclui Points e Leaderboard
const reelRoutes = require('./routes/reelRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const server = http.createServer(app);

/**
 * CONFIGURAÇÃO DO REALTIME ENGINE (SOCKET.IO)
 * Integrado com CORS global para aceitar conexões Mobile
 */
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
        credentials: true
    },
    allowEIO3: true
});

// Disponibiliza o Socket.io nos controllers sem importações circulares
app.set('io', io);

/**
 * MIDDLEWARES DE INFRAESTRUTURA E SEGURANÇA
 */
app.use(cors());
app.use(express.json({ limit: '100mb' })); // Suporte a payloads grandes (metadados/imagens)
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Logger de Auditoria Alfa Omega (Personalizado)
app.use(morgan((tokens, req, res) => {
    return [
        `[ALFA_OMEGA_TRACE]`,
        new Date().toISOString(),
        '-',
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), 'ms',
        '-',
        tokens['user-agent'](req, res)
    ].join(' ');
}));

/**
 * INICIALIZAÇÃO DO BARRAMENTO REALTIME
 * Nota: Caminho ajustado para a raiz operacional
 */
const { initializeSocket } = require('./socket/socketManager');
initializeSocket(io);

/**
 * ROTA RAIZ (HEALTH CHECK PARA RENDER.COM)
 * Garante que o deploy seja marcado como "Live" e funcional
 */
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'VlogStudents Enterprise Master Engine is Operational.',
        kernel_version: '4.2.0-PRO',
        node_status: 'ALFA_OMEGA_ACTIVE',
        timestamp: new Date().toISOString()
    });
});

/**
 * MONTAGEM DO BARRAMENTO DE API (Sincronizado com Flutter NetworkProvider)
 * Todos os prefixos batem rigorosamente com as chamadas Dio/Http
 */
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes); // Leaderboard e Points integrados aqui
app.use('/api/v1/reels', reelRoutes);
app.use('/api/v1/chat', chatRoutes);

/**
 * HANDLER DE ROTAS INEXISTENTES (DEBUG LOG)
 */
app.use((req, res) => {
    console.warn(`[WARNING] Tentativa de acesso em rota inexistente: ${req.url}`);
    res.status(404).json({
        success: false,
        message: `Endpoint ${req.url} não encontrado no Master Engine.`
    });
});

/**
 * TRATAMENTO GLOBAL DE EXCEÇÕES (ANTI-CRASH)
 */
app.use((err, req, res, next) => {
    console.error('[CRITICAL_KERNEL_ERROR]', err.stack);
    res.status(500).json({
        success: false,
        message: 'Instabilidade interna detectada no Master Kernel.',
        error_context: process.env.NODE_ENV === 'development' ? err.message : 'HIDDEN'
    });
});

/**
 * INICIALIZAÇÃO DO SERVIDOR FÍSICO
 */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('+-----------------------------------------------------------+');
    console.log(`| VLOGSTUDENTS MASTER KERNEL v4.2.0 EM EXECUÇÃO             |`);
    console.log(`| PORTA: ${PORT}                                               |`);
    console.log(`| AMBIENTE: ${process.env.NODE_ENV || 'production'}                 |`);
    console.log(`| STATUS: ALFA OMEGA ACTIVE (FULL RECONSTRUCTION)           |`);
    console.log('+-----------------------------------------------------------+');
});

module.exports = app;
