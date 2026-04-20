const express = require('express');
const authRoutes = require('./auth_routes');
const userRoutes = require('./user_routes');
const reelRoutes = require('./reel_routes');
const chatRoutes = require('./chat_routes');
const pointRoutes = require('./point_routes');
const mediaRoutes = require('./media_routes');
const logger = require('../config/logger');

const rootRouter = express.Router();

rootRouter.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.debug(`API Access: ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`);
    });
    next();
});

rootRouter.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'VlogStudents Professional Fullstack API v1.0.0',
        documentation: 'https://vlogstudents.onrender.com/api-docs',
        status: 'Operational'
    });
});

rootRouter.use('/auth', authRoutes);
rootRouter.use('/users', userRoutes);
rootRouter.use('/reels', reelRoutes);
rootRouter.use('/chat', chatRoutes);
rootRouter.use('/points', pointRoutes);
rootRouter.use('/media', mediaRoutes);

rootRouter.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `A rota ${req.originalUrl} nao existe nesta API.`,
        available_endpoints: [
            '/api/v1/auth',
            '/api/v1/users',
            '/api/v1/reels',
            '/api/v1/chat',
            '/api/v1/points',
            '/api/v1/media'
        ]
    });
});

module.exports = rootRouter;