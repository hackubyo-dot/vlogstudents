/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER KERNEL v8.0.0
 * UBICAÇÃO: /src/server.js (CORE ENGINE)
 * ============================================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const morgan = require('morgan');

/**
 * IMPORTAÇÃO DE ROTAS (DIRECIONAMENTO LOCAL /SRC)
 */
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const reelRoutes = require('./routes/reelRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const server = http.createServer(app);

/**
 * MOTOR REALTIME (SOCKET.IO)
 * Cross-Origin habilitado para Handshake com Flutter Mobile
 */
const io = new Server(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST", "PATCH", "DELETE"],
        credentials: true
    }
});

// Injeção Global do IO para uso nos Controllers
app.set('io', io);

/**
 * MIDDLEWARES DE TRÁFEGO
 */
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

/**
 * INFRAESTRUTURA E MÓDULOS CORE
 */
const { initializeSocket } = require('./socket/socketManager');
const db = require('./config/dbConfig');
const driveService = require('./services/driveService');

// Ativa o Gerenciador de Sockets
initializeSocket(io);

/**
 * ROTA DE SAÚDE (HEALTH CHECK) - MONITORAMENTO RENDER
 */
app.get('/', async (req, res) => {
    res.status(200).json({
        success: true,
        project: 'VlogStudents Enterprise',
        version: '8.0.0',
        node_status: 'OPERATIONAL',
        environment: process.env.NODE_ENV || 'production',
        uptime: process.uptime()
    });
});

/**
 * MAPEAMENTO DO BARRAMENTO DE API /API/V1
 */
app.use('/api/v1/auth', authRoutes);   // Login, Registro, Logout
app.use('/api/v1/users', userRoutes);  // Perfil, Voices, Leaderboard, Streaming
app.use('/api/v1/reels', reelRoutes);  // Feed de Vídeos, Likes, Comentários
app.use('/api/v1/chat', chatRoutes);   // Mensagens e Salas

/**
 * TRATAMENTO DE EXCEÇÕES E 404
 */
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Endpoint não mapeado no Kernel Alpha Omega.',
        path: req.originalUrl 
    });
});

app.use((err, req, res, next) => {
    console.error('[KERNEL_CRITICAL_ERROR]', err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Falha interna no orquestrador central.' 
    });
});

/**
 * EXECUÇÃO DO SERVIDOR
 * Escuta em 0.0.0.0 para garantir visibilidade externa no Render/Heroku
 */
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log('\n+-----------------------------------------------------------+');
    console.log(`| VLOGSTUDENTS MASTER KERNEL v8.0.0 ONLINE                  |`);
    console.log(`| PORTA: ${PORT.toString().padEnd(50)} |`);
    console.log(`| DIRETÓRIO RAIZ: /src/server.js                            |`);
    console.log(`| STATUS: AGUARDANDO REQUISIÇÕES FLUTTER                    |`);
    console.log('+-----------------------------------------------------------+\n');
});

/**
 * PROTOCOLO ANTI-QUEDA (SAFE RUNTIME)
 */
process.on('uncaughtException', (err) => {
    console.error('[SHUTDOWN_PREVENTED] Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[SHUTDOWN_PREVENTED] Unhandled Rejection at:', promise, 'reason:', reason);
});
