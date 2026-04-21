require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Importação das Rotas Master
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const reelRoutes = require('./src/routes/reelRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const pointRoutes = require('./src/routes/pointRoutes');

/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER KERNEL v2.0.0
 * ORQUESTRADOR CENTRAL DE API, REALTIME E STORAGE
 * ============================================================================
 */

const app = express();
const server = http.createServer(app);

// Configuração do Engine Realtime (Socket.io)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH", "DELETE"]
    }
});

// Middlewares Globais de Segurança e Parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Logger de Auditoria de Requisições
app.use((req, res, next) => {
    console.log(`[MASTER_TRACE] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Endpoint de Health Check (Usado pelo NetworkProvider do Flutter)
app.get('/api/v1/health', (req, res) => {
    res.status(200).json({ 
        status: 'operational', 
        timestamp: new Date().toISOString(),
        version: '2.0.0-PRO'
    });
});

// MONTAGEM DO BARRAMENTO DE API (Sincronizado com Flutter)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/reels', reelRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/points', pointRoutes);

// Tratamento de Erro 404 (Rota não encontrada no Barramento)
app.use((req, res) => {
    console.error(`[404_ERROR] Rota inexistente: ${req.method} ${req.url}`);
    res.status(404).json({ 
        success: false, 
        message: `Endpoint ${req.url} não encontrado no Master Kernel.` 
    });
});

// Tratamento Global de Exceções
app.use((err, req, res, next) => {
    console.error('[CRITICAL_SERVER_ERROR]', err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Instabilidade fatal no processamento interno.',
        error: process.env.NODE_ENV === 'development' ? err.message : null
    });
});

// Inicialização do Servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('+-----------------------------------------------------------+');
    console.log(`| VLOGSTUDENTS MASTER ENGINE v2.0.0 EM EXECUÇÃO             |`);
    console.log(`| PORTA: ${PORT}                                               |`);
    console.log(`| AMBIENTE: ${process.env.NODE_ENV || 'production'}                 |`);
    console.log('+-----------------------------------------------------------+');
});

// Exportação para uso no SocketManager
module.exports = { io };
