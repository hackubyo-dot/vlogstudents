const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middlewares/error');

// Importar Rotas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const reelRoutes = require('./routes/reelRoutes');
const socialRoutes = require('./routes/socialRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();

// Segurança e Logs
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Rate Limiting (Proteção contra Brute Force/DDoS)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Muitas requisições vindas deste IP, tente novamente em 15 minutos."
});
app.use('/api/', limiter);

// Endpoints Base
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/chat', chatRoutes);

// Health Check
app.get('/health', (req, res) => res.status(200).json({ status: 'UP', timestamp: new Date() }));

// Global Error Handler
app.use(errorHandler);

module.exports = app;