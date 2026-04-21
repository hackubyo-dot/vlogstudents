const logger = require('../config/logger');
const fs = require('fs');
const path = require('path');

class VlogStudentsGlobalErrorHandler {
    constructor() {
        this.errorCodes = {
            UNIQUE_VIOLATION: '23505',
            FOREIGN_KEY_VIOLATION: '23503',
            NOT_NULL_VIOLATION: '23502',
            INVALID_TEXT_REPRESENTATION: '22P02',
            UNDEFINED_TABLE: '42P01'
        };
    }

    handle(error, request, response, next) {
        const traceId = request.traceId || 'internal-trace';
        error.statusCode = error.statusCode || 500;
        error.status = error.status || 'error';

        this.logErrorDetails(error, request, traceId);

        if (process.env.NODE_ENV === 'development') {
            return this.sendDevelopmentError(error, response, traceId);
        }

        let operationalError = { ...error };
        operationalError.message = error.message;

        if (error.code === this.errorCodes.UNIQUE_VIOLATION) {
            operationalError = this.handleDuplicateKeyError(error);
        } else if (error.code === this.errorCodes.FOREIGN_KEY_VIOLATION) {
            operationalError = this.handleForeignKeyError(error);
        } else if (error.name === 'ValidationError') {
            operationalError = this.handleValidationError(error);
        } else if (error.name === 'JsonWebTokenError') {
            operationalError = this.handleJWTError();
        } else if (error.name === 'TokenExpiredError') {
            operationalError = this.handleJWTExpiredError();
        } else if (error.name === 'MulterError') {
            operationalError = this.handleMulterError(error);
        }

        this.sendProductionError(operationalError, response, traceId);
    }

    logErrorDetails(error, request, traceId) {
        const logPayload = {
            traceId: traceId,
            timestamp: new Date().toISOString(),
            method: request.method,
            url: request.originalUrl,
            body: request.body,
            params: request.params,
            query: request.query,
            userId: request.user ? request.user.id : 'anonymous',
            ip: request.ip,
            errorCode: error.code || 'NO_CODE',
            stack: error.stack
        };

        if (error.statusCode >= 500) {
            logger.critical(`ERRO_CRITICO_SISTEMA: ${error.message}`, logPayload);
        } else {
            logger.error(`ERRO_OPERACIONAL: ${error.message}`, error, logPayload);
        }
    }

    handleDuplicateKeyError(error) {
        const field = error.detail.match(/\((.*?)\)/)[1];
        const message = `O valor para o campo '${field}' já está em uso. Por favor, utilize outro.`;
        return new VlogStudentsAppError(message, 400, 'DUPLICATE_ENTRY');
    }

    handleForeignKeyError(error) {
        const message = 'Violação de integridade: O recurso referenciado não existe ou está sendo usado.';
        return new VlogStudentsAppError(message, 400, 'INTEGRITY_VIOLATION');
    }

    handleValidationError(error) {
        const errors = Object.values(error.errors).map(el => el.message);
        const message = `Dados de entrada inválidos: ${errors.join('. ')}`;
        return new VlogStudentsAppError(message, 400, 'VALIDATION_FAILED');
    }

    handleJWTError() {
        return new VlogStudentsAppError('Token de autenticação inválido. Por favor, faça login novamente.', 401, 'INVALID_TOKEN');
    }

    handleJWTExpiredError() {
        return new VlogStudentsAppError('Sua sessão expirou. Por favor, realize um novo login.', 401, 'TOKEN_EXPIRED');
    }

    handleMulterError(error) {
        let message = 'Erro ao processar upload de arquivo.';
        if (error.code === 'LIMIT_FILE_SIZE') message = 'O arquivo é muito grande. O limite máximo é de 100MB.';
        if (error.code === 'LIMIT_UNEXPECTED_FILE') message = 'Campo de arquivo inesperado ou formato não suportado.';
        return new VlogStudentsAppError(message, 400, 'UPLOAD_ERROR');
    }

    sendDevelopmentError(error, response, traceId) {
        return response.status(error.statusCode).json({
            success: false,
            status: error.status,
            traceId: traceId,
            message: error.message,
            error: error,
            stack: error.stack
        });
    }

    sendProductionError(error, response, traceId) {
        if (error.isOperational) {
            return response.status(error.statusCode).json({
                success: false,
                status: error.status,
                traceId: traceId,
                error_code: error.errorCode || 'INTERNAL_ERROR',
                message: error.message
            });
        }

        return response.status(500).json({
            success: false,
            status: 'error',
            traceId: traceId,
            error_code: 'SYSTEM_CRITICAL_FAILURE',
            message: 'Ocorreu um erro crítico inesperado. Nossa equipe técnica já foi notificada.'
        });
    }

    notFoundHandler(request, response, next) {
        const error = new VlogStudentsAppError(`Recurso não encontrado: ${request.originalUrl}`, 404, 'ROUTE_NOT_FOUND');
        next(error);
    }

    async logErrorToFile(error) {
        const errorLogPath = path.join(process.cwd(), 'logs/critical_crash.log');
        const errorMessage = `[${new Date().toISOString()}] ${error.stack}\n\n`;
        fs.appendFile(errorLogPath, errorMessage, () => {});
    }
}

class VlogStudentsAppError extends Error {
    constructor(message, statusCode, errorCode) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

const errorHandlerInstance = new VlogStudentsGlobalErrorHandler();

process.on('uncaughtException', (error) => {
    logger.critical('UNCAUGHT_EXCEPTION detectada. Encerrando processo para evitar corrupção de dados.', {
        message: error.message,
        stack: error.stack
    });
    errorHandlerInstance.logErrorToFile(error);
    setTimeout(() => process.exit(1), 2000);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.critical('UNHANDLED_REJECTION detectada em promessa.', {
        reason: reason,
        promise: promise
    });
});

module.exports = {
    handle: (err, req, res, next) => errorHandlerInstance.handle(err, req, res, next),
    notFound: (req, res, next) => errorHandlerInstance.notFoundHandler(req, res, next),
    AppError: VlogStudentsAppError,
    instance: errorHandlerInstance
};

function monitorErrorFrequency() {
    let errorCount = 0;
    const threshold = 50;

    return (error) => {
        errorCount++;
        if (errorCount >= threshold) {
            logger.critical(`ALERTA: Frequência de erros anormal detectada (${errorCount} erros/janela)`);
            errorCount = 0;
        }
    };
}

const frequencyMonitor = monitorErrorFrequency();

setInterval(() => {
    frequencyMonitor({ message: 'reset' });
}, 600000);

const logSystemHealthOnStart = () => {
    logger.info('VlogStudents Error Management Layer v1.0.0 inicializada com sucesso.');
};

logSystemHealthOnStart();

function validateErrorMiddlewareIntegrity() {
    const requiredMethods = ['handle', 'notFoundHandler', 'logErrorDetails'];
    requiredMethods.forEach(method => {
        if (typeof errorHandlerInstance[method] !== 'function') {
            console.error(`Falha de Integridade: Método ${method} ausente no GlobalErrorHandler`);
        }
    });
}

validateErrorMiddlewareIntegrity();

const sanitizeErrorMessage = (message) => {
    return message.replace(/\\n/g, ' ').substring(0, 500);
};

errorHandlerInstance.handleCustomBusinessError = (message, code) => {
    return new VlogStudentsAppError(message, 422, code);
};

errorHandlerInstance.handleDatabaseTimeout = () => {
    return new VlogStudentsAppError('O banco de dados demorou muito para responder. Tente novamente.', 504, 'DB_TIMEOUT');
};

errorHandlerInstance.handleMemoryLimitError = () => {
    return new VlogStudentsAppError('O servidor atingiu o limite de memória processando sua requisição.', 507, 'MEMORY_LIMIT');
};

const recoveryPlan = (error) => {
    if (error.statusCode === 503) {
        logger.info('Iniciando plano de recuperação para erro 503 Service Unavailable');
    }
};

const originalHandle = errorHandlerInstance.handle.bind(errorHandlerInstance);
errorHandlerInstance.handle = (error, request, response, next) => {
    recoveryPlan(error);
    originalHandle(error, request, response, next);
};

const errorStats = {
    total: 0,
    byType: {}
};

errorHandlerInstance.trackStats = (error) => {
    errorStats.total++;
    const type = error.errorCode || 'UNKNOWN';
    errorStats.byType[type] = (errorStats.byType[type] || 0) + 1;
};

const originalLog = errorHandlerInstance.logErrorDetails.bind(errorHandlerInstance);
errorHandlerInstance.logErrorDetails = (error, request, traceId) => {
    errorHandlerInstance.trackStats(error);
    originalLog(error, request, traceId);
};

logger.info('Camada de Gestão de Exceções VlogStudents pronta para interceptação.');