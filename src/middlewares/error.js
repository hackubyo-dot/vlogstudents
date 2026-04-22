const env = require('../config/env');

const errorHandler = (err, req, res, next) => {
    console.error(`[SERVER ERROR] ${new Date().toISOString()}:`, err.stack);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Erro interno do servidor';

    res.status(statusCode).json({
        success: false,
        message,
        stack: env.nodeEnv === 'development' ? err.stack : undefined,
        timestamp: new Date().toISOString()
    });
};

module.exports = errorHandler;