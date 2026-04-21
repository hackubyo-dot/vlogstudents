/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER KERNEL v8.0.0
 * ORQUESTRADOR DE NÓ CENTRAL - ALFA OMEGA SYSTEM
 * ============================================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const morgan = require('morgan');

// Importação das Rotas Master (Sincronizadas com o Flutter Provider)
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const reelRoutes = require('./src/routes/reelRoutes');
const chatRoutes = require('./src/routes/chatRoutes');

const app = express();
const server = http.createServer(app);

/**
 * INJEÇÃO DO MOTOR REALTIME (SOCKET.IO)
 * Configurado para Cross-Origin total para permitir conexões Mobile/Web.
 */
const io = new Server(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST", "PATCH", "DELETE"],
        credentials: true
    }
});

// Configuração de Contexto Global: Disponibiliza o 'io' em todos os controllers via req.app.get('io')
app.set('io', io);

/**
 * MIDDLEWARES DE INFRAESTRUTURA
 */
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Suporte para Base64 pesado se necessário
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev')); // Log de requisições no console

/**
 * INICIALIZAÇÃO DOS MÓDULOS CORE (BACKGROUND)
 * Estes módulos rodam de forma assíncrona para não travar o boot.
 */
const { initializeSocket } = require('./src/socket/socketManager');
const db = require('./src/config/dbConfig');
const driveService = require('./src/services/driveService');

// Acopla a lógica de eventos ao Socket.io
initializeSocket(io);

/**
 * ROTA DE SAÚDE (VITAL PARA MONITORAMENTO & RENDER)
 * Usada pelo Render.com para confirmar que o container está vivo.
 */
app.get('/', async (req, res) => {
    res.status(200).json({
        success: true,
        project: 'VlogStudents Enterprise',
        version: '8.0.0',
        status: 'ALFA_OMEGA_ACTIVE',
        timestamp: new Date().toISOString(),
        engine: 'Node.js ' + process.version
    });
});

/**
 * MONTAGEM DO BARRAMENTO DE API /API/V1
 */
app.use('/api/v1/auth', authRoutes);   // Autenticação e Registro
app.use('/api/v1/users', userRoutes);  // Perfil, Voices, Leaderboard e Stream
app.use('/api/v1/reels', reelRoutes);  // Vídeos, Curtidas e Comentários
app.use('/api/v1/chat', chatRoutes);   // Mensageria Privada

/**
 * GESTÃO DE EXCEÇÕES E ROTAS INEXISTENTES
 */

// Handler de Erro 404 (Endpoint não mapeado)
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Endpoint não encontrado no Cluster VlogStudents.',
        path: req.originalUrl 
    });
});

// Central de Erros Internos (Previne que o servidor caia por erro de lógica)
app.use((err, req, res, next) => {
    console.error('[KERNEL_INTERNAL_ERROR]', err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Falha crítica no processamento do Kernel.' 
    });
});

/**
 * BOOT SEQUENCE
 * A escuta começa IMEDIATAMENTE para evitar o erro de 'Port Timeout' no Render.
 */
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log('\n+-----------------------------------------------------------+');
    console.log(`| VLOGSTUDENTS MASTER KERNEL v8.0.0 EM EXECUÇÃO             |`);
    console.log(`| PORTA: ${PORT.toString().padEnd(50)} |`);
    console.log(`| AMBIENTE: ${(process.env.NODE_ENV || 'production').toUpperCase().padEnd(46)} |`);
    console.log(`| STATUS: SISTEMAS ONLINE & HANDSHAKE RSA INICIADO          |`);
    console.log('+-----------------------------------------------------------+\n');
});

/**
 * PROTOCOLO ANTI-CRASH (SEGURANÇA MÁXIMA)
 * Captura erros que normalmente matariam o processo do Node.js.
 */
process.on('uncaughtException', (err) => {
    console.error('[FATAL_CRASH] Uncaught Exception detectada:', err.message);
    // Logar o erro, mas manter o processo vivo se possível
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL_CRASH] Unhandled Rejection em:', promise, 'razão:', reason);
});
