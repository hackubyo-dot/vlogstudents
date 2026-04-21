/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER ENGINE v2.0.2
 * ORQUESTRADOR CENTRAL DE API, REALTIME E STORAGE
 * ============================================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const morgan = require('morgan');

// Importação das Rotas
// Nota: Caminhos relativos à raiz definida no Render (pasta src)
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const reelRoutes = require('./routes/reelRoutes');
const chatRoutes = require('./routes/chatRoutes');
const pointRoutes = require('./routes/pointRoutes');

const app = express();
const server = http.createServer(app);

// Configuração Realtime
const io = new Server(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    }
});

// Middleware de Injeção de Socket (Resolve MODULE_NOT_FOUND em controladores)
app.set('io', io);

// Middlewares Globais
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Inicialização do Socket Manager
// Nota: Caminho ajustado para funcionar dentro da pasta src
const { initializeSocket } = require('./socket/socketManager');
initializeSocket(io);

// Barramento de API (Endpoints v1)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/reels', reelRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/points', pointRoutes);

// Endpoint de Health Check (Monitoramento)
app.get('/api/v1/health', (req, res) => {
    res.json({ 
        status: 'operational', 
        timestamp: new Date(),
        version: '2.0.2-MASTER'
    });
});

// Tratamento de Rotas Não Encontradas (404)
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: `Endpoint ${req.url} não encontrado no Master Engine.` 
    });
});

// Inicialização do Servidor na Porta Definida
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('+-----------------------------------------------------------+');
    console.log(`| VLOGSTUDENTS MASTER KERNEL v2.0.2 EM EXECUÇÃO             |`);
    console.log(`| PORTA: ${PORT}                                               |`);
    console.log(`| DATA: ${new Date().toLocaleString()}                         |`);
    console.log('+-----------------------------------------------------------+');
});
