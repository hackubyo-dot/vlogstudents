/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER ENGINE v2.0.7
 * ORQUESTRADOR DE NÓ CENTRAL - ALFA OMEGA SYSTEM
 * ============================================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const morgan = require('morgan');

// Importação das Rotas Master
// Nota: Caminhos relativos à pasta 'src' definida como Root no Render
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const reelRoutes = require('./routes/reelRoutes');
const chatRoutes = require('./routes/chatRoutes');
const pointRoutes = require('./routes/pointRoutes');

const app = express();
const server = http.createServer(app);

// Injeção de Realtime Engine (Socket.io)
const io = new Server(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST", "PATCH", "DELETE"] 
    }
});

// Disponibiliza IO para os controllers sem importação circular
app.set('io', io);

// Middlewares de Infraestrutura e Performance
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Logger de Monitoramento em Tempo Real
app.use((req, res, next) => {
    console.log(`[ALFA_OMEGA_TRACE] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Inicialização do Socket Manager
const { initializeSocket } = require('./socket/socketManager');
initializeSocket(io);

// ROTA RAIZ (Ponto de entrada e Health Check do Render)
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'VlogStudents Master Engine is Live.',
        node_status: 'operational',
        kernel_version: '2.0.7',
        timestamp: new Date()
    });
});

// BARRAMENTO DE API MASTER (Prefixado v1)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/reels', reelRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/points', pointRoutes);

// Handler de Rota Inexistente (404)
app.use((req, res) => {
    console.warn(`[WARNING] Tentativa de acesso em rota inexistente: ${req.url}`);
    res.status(404).json({ 
        success: false, 
        message: 'Endpoint Master não encontrado no Alfa Omega System.' 
    });
});

// Tratamento Global de Erros Críticos
app.use((err, req, res, next) => {
    console.error('[KERNEL_CRITICAL_ERROR]', err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Falha crítica no processamento do nó central.',
        error: process.env.NODE_ENV === 'development' ? err.message : null
    });
});

// Inicialização Final do Nó
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('+-----------------------------------------------------------+');
    console.log(`| VLOGSTUDENTS MASTER KERNEL v2.0.7 EM EXECUÇÃO             |`);
    console.log(`| PORTA: ${PORT}                                               |`);
    console.log(`| AMBIENTE: ${process.env.NODE_ENV || 'production'}                 |`);
    console.log(`| STATUS: ALFA OMEGA ACTIVE                                 |`);
    console.log('+-----------------------------------------------------------+');
});
