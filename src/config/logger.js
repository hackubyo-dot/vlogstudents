const winston = require('winston');
const dailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const os = require('os');

class VlogStudentsLoggerSystem {
    constructor() {
        this.logDirectory = path.join(process.cwd(), 'logs');
        this.ensureLogDirectoryExists();
        this.setupFormats();
        this.setupTransports();
        this.initializeLogger();
        this.setupEventHandlers();
        this.logMetrics = {
            infoCount: 0,
            errorCount: 0,
            warnCount: 0,
            debugCount: 0,
            criticalCount: 0,
            securityCount: 0,
            lastReset: new Date()
        };
    }

    ensureLogDirectoryExists() {
        if (!fs.existsSync(this.logDirectory)) {
            fs.mkdirSync(this.logDirectory, { recursive: true });
        }

        const subDirectories = ['error', 'activity', 'security', 'database', 'socket', 'media', 'points'];
        subDirectories.forEach(dir => {
            const fullPath = path.join(this.logDirectory, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
    }

    setupFormats() {
        this.baseFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
            winston.format.errors({ stack: true }),
            winston.format.json()
        );

        this.consoleFormat = winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf((info) => {
                const { timestamp, level, message, stack, ...meta } = info;
                const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
                return `[${timestamp}] ${level}: ${message} ${stack || ''} ${metaString}`;
            })
        );
    }

    setupTransports() {
        this.transports = [
            new winston.transports.Console({
                level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
                format: this.consoleFormat
            }),
            new dailyRotateFile({
                filename: path.join(this.logDirectory, 'error', 'error-%DATE%.log'),
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxSize: '50m',
                maxFiles: '30d',
                level: 'error',
                format: this.baseFormat
            }),
            new dailyRotateFile({
                filename: path.join(this.logDirectory, 'activity', 'combined-%DATE%.log'),
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxSize: '100m',
                maxFiles: '14d',
                level: 'info',
                format: this.baseFormat
            }),
            new dailyRotateFile({
                filename: path.join(this.logDirectory, 'security', 'security-%DATE%.log'),
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxSize: '20m',
                maxFiles: '60d',
                level: 'warn',
                format: this.baseFormat
            }),
            new dailyRotateFile({
                filename: path.join(this.logDirectory, 'database', 'db-%DATE%.log'),
                datePattern: 'YYYY-MM-DD',
                zippedArchive: true,
                maxSize: '50m',
                maxFiles: '7d',
                level: 'debug',
                format: this.baseFormat
            })
        ];
    }

    initializeLogger() {
        this.logger = winston.createLogger({
            level: 'debug',
            levels: {
                critical: 0,
                error: 1,
                warn: 2,
                security: 3,
                info: 4,
                audit: 5,
                debug: 6
            },
            format: this.baseFormat,
            transports: this.transports,
            exitOnError: false,
            handleExceptions: true,
            handleRejections: true
        });

        winston.addColors({
            critical: 'red bold',
            error: 'red',
            warn: 'yellow',
            security: 'magenta',
            info: 'green',
            audit: 'cyan',
            debug: 'blue'
        });
    }

    setupEventHandlers() {
        this.logger.on('error', (error) => {
            console.error('Falha critica no sistema de logs:', error);
        });
    }

    info(message, metadata = {}) {
        this.logMetrics.infoCount++;
        this.logger.info(message, { ...this.getSystemContext(), ...metadata });
    }

    error(message, errorObject = null, metadata = {}) {
        this.logMetrics.errorCount++;
        const logData = { ...this.getSystemContext(), ...metadata };
        if (errorObject instanceof Error) {
            logData.stack = errorObject.stack;
            logData.errorCode = errorObject.code;
        }
        this.logger.error(message, logData);
    }

    warn(message, metadata = {}) {
        this.logMetrics.warnCount++;
        this.logger.warn(message, { ...this.getSystemContext(), ...metadata });
    }

    debug(message, metadata = {}) {
        this.logMetrics.debugCount++;
        this.logger.debug(message, { ...this.getSystemContext(), ...metadata });
    }

    critical(message, metadata = {}) {
        this.logMetrics.criticalCount++;
        this.logger.log('critical', message, { ...this.getSystemContext(), ...metadata });
    }

    security(message, metadata = {}) {
        this.logMetrics.securityCount++;
        this.logger.log('security', message, { ...this.getSystemContext(), ...metadata });
    }

    audit(action, userId, resourceId, details = {}) {
        this.logger.log('audit', `AUDIT_TRAIL: ${action}`, {
            userId,
            resourceId,
            details,
            ...this.getSystemContext()
        });
    }

    logHttpRequest(req, res, responseTime) {
        const metadata = {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            traceId: req.traceId || 'no-trace-id'
        };

        if (res.statusCode >= 500) {
            this.error(`HTTP_FAILURE_${res.statusCode}: ${req.method} ${req.url}`, null, metadata);
        } else if (res.statusCode >= 400) {
            this.warn(`HTTP_WARNING_${res.statusCode}: ${req.method} ${req.url}`, metadata);
        } else {
            this.info(`HTTP_SUCCESS: ${req.method} ${req.url}`, metadata);
        }
    }

    logDatabaseQuery(query, duration, params = []) {
        const metadata = {
            duration: `${duration}ms`,
            parameters: params,
            service: 'neon-postgresql'
        };

        if (duration > 1000) {
            this.warn(`SLOW_QUERY_DETECTED: ${query.substring(0, 100)}...`, metadata);
        } else {
            this.logger.log('debug', `DB_QUERY: ${query.substring(0, 50)}...`, metadata);
        }
    }

    logAuthenticationAttempt(email, success, reason = null) {
        const metadata = {
            email,
            success,
            reason,
            service: 'google-oauth-jwt'
        };

        if (success) {
            this.info(`AUTH_SUCCESS: Usuario ${email} logado.`, metadata);
        } else {
            this.security(`AUTH_FAILURE: Tentativa negada para ${email}. Motivo: ${reason}`, metadata);
        }
    }

    logMediaEvent(action, fileId, duration, success, error = null) {
        const metadata = {
            fileId,
            duration: `${duration}ms`,
            success,
            error: error ? error.message : null,
            service: 'google-drive-api'
        };

        if (success) {
            this.info(`MEDIA_UPLOAD_SUCCESS: Arquivo ${fileId} processado.`, metadata);
        } else {
            this.error(`MEDIA_UPLOAD_FAILURE: Erro ao processar arquivo ${fileId}`, error, metadata);
        }
    }

    logSocketConnection(socketId, userId, action) {
        const metadata = {
            socketId,
            userId,
            action,
            service: 'socket-io-realtime'
        };
        this.logger.log('info', `SOCKET_EVENT: ${action} - User ${userId}`, metadata);
    }

    logPointTransaction(userId, amount, reason) {
        const metadata = {
            userId,
            amount,
            reason,
            service: 'gamification-engine'
        };
        this.info(`POINTS_EARNED: User ${userId} recebeu ${amount} pontos. Motivo: ${reason}`, metadata);
    }

    logSystemResourceUsage() {
        const memoryUsage = process.memoryUsage();
        const cpuLoad = os.loadavg();
        const metadata = {
            memory: {
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
            },
            cpu: cpuLoad,
            uptime: `${Math.round(process.uptime())}s`
        };
        this.info('SYSTEM_RESOURCE_SNAPSHOT', metadata);
    }

    getSystemContext() {
        return {
            processId: process.pid,
            platform: os.platform(),
            nodeVersion: process.version,
            hostname: os.hostname(),
            environment: process.env.NODE_ENV || 'production'
        };
    }

    getMetrics() {
        return {
            ...this.logMetrics,
            currentTimestamp: new Date(),
            activeTransports: this.transports.length
        };
    }

    resetMetrics() {
        this.logMetrics = {
            infoCount: 0,
            errorCount: 0,
            warnCount: 0,
            debugCount: 0,
            criticalCount: 0,
            securityCount: 0,
            lastReset: new Date()
        };
        return true;
    }

    async cleanupOldLogs() {
        this.info('Iniciando limpeza programada de logs antigos...');
        const retentionPeriod = 60 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        const walk = (dir) => {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    walk(filePath);
                } else if (now - stats.mtimeMs > retentionPeriod) {
                    fs.unlinkSync(filePath);
                    this.info(`Log removido por expiração: ${file}`);
                }
            });
        };

        try {
            walk(this.logDirectory);
            this.info('Limpeza de logs finalizada com sucesso.');
        } catch (error) {
            this.error('Erro durante a limpeza de logs:', error);
        }
    }

    getMorganStream() {
        return {
            write: (message) => {
                this.info(message.trim(), { source: 'morgan-http-stream' });
            }
        };
    }

    createTraceLogger(traceId) {
        return {
            info: (msg, meta = {}) => this.info(msg, { ...meta, traceId }),
            error: (msg, err, meta = {}) => this.error(msg, err, { ...meta, traceId }),
            warn: (msg, meta = {}) => this.warn(msg, { ...meta, traceId }),
            debug: (msg, meta = {}) => this.debug(msg, { ...meta, traceId })
        };
    }

    logVideoCallSession(roomId, participants, status, duration = 0) {
        const metadata = {
            roomId,
            participants,
            status,
            duration: `${duration}s`,
            service: 'webrtc-call-service'
        };
        this.info(`VIDEO_CALL_EVENT: Sala ${roomId} status ${status}`, metadata);
    }

    logReferralActivation(referrerId, invitedId, code) {
        const metadata = {
            referrerId,
            invitedId,
            code,
            service: 'referral-system'
        };
        this.info(`REFERRAL_ACTIVATED: Codigo ${code} usado por ${invitedId}`, metadata);
    }

    logDatabaseConnectionStatus(status, details = {}) {
        const metadata = {
            status,
            ...details,
            service: 'database-monitor'
        };
        if (status === 'connected') {
            this.info('NEON_DB_CONNECTION_ESTABLISHED', metadata);
        } else {
            this.critical('NEON_DB_CONNECTION_FAILURE', metadata);
        }
    }

    logMiddlewareExecution(middlewareName, duration) {
        if (duration > 500) {
            this.warn(`SLOW_MIDDLEWARE: ${middlewareName} levou ${duration}ms`, { middlewareName, duration });
        }
    }

    logSystemShutdown(signal) {
        this.critical(`SYSTEM_SHUTDOWN_INITIATED: Recebido sinal ${signal}`, { signal });
    }

    logConfigurationLoad(configName, success) {
        const metadata = { configName, success };
        if (success) {
            this.debug(`CONFIG_LOADED: ${configName}`, metadata);
        } else {
            this.error(`CONFIG_LOAD_FAILURE: ${configName}`, null, metadata);
        }
    }

    logUserSessionInvalidation(userId, reason) {
        this.security(`SESSION_INVALIDATED: Usuario ${userId}. Motivo: ${reason}`, { userId, reason });
    }

    logRateLimitReached(ip, endpoint) {
        this.security(`RATE_LIMIT_EXCEEDED: IP ${ip} no endpoint ${endpoint}`, { ip, endpoint });
    }

    logFileProcessing(fileName, size, format) {
        this.info(`FILE_PROCESSING: ${fileName}`, { fileName, size, format });
    }

    logMemorySpike(rssBefore, rssAfter) {
        const spike = rssAfter - rssBefore;
        this.warn(`MEMORY_SPIKE_DETECTED: Aumento de ${Math.round(spike / 1024 / 1024)}MB`, { rssBefore, rssAfter, spike });
    }

    logThreadHealth(threadId, status) {
        this.debug(`THREAD_HEALTH: Thread ${threadId} is ${status}`, { threadId, status });
    }

    logInternalRedirect(from, to) {
        this.info(`INTERNAL_REDIRECT: From ${from} to ${to}`, { from, to });
    }

    logThirdPartyApiCall(serviceName, endpoint, statusCode, duration) {
        const metadata = { serviceName, endpoint, statusCode, duration: `${duration}ms` };
        if (statusCode >= 400) {
            this.error(`THIRD_PARTY_API_ERROR: ${serviceName}`, null, metadata);
        } else {
            this.info(`THIRD_PARTY_API_SUCCESS: ${serviceName}`, metadata);
        }
    }

    logWebhookReceived(source, payload) {
        this.info(`WEBHOOK_RECEIVED: Source ${source}`, { source, payloadLength: JSON.stringify(payload).length });
    }

    logCacheHit(key, success) {
        this.logger.log('debug', `CACHE_EVENT: Key ${key} | Hit: ${success}`, { key, success });
    }

    logBatchJobExecution(jobName, itemsProcessed, duration) {
        this.info(`BATCH_JOB_COMPLETED: ${jobName}`, { jobName, itemsProcessed, duration: `${duration}ms` });
    }

    logAppBoot(config) {
        this.info('VLOGSTUDENTS_APP_BOOT_START', { ...config, timestamp: new Date().toISOString() });
    }

    logIntegrityCheck(module, passed) {
        const metadata = { module, passed };
        if (passed) {
            this.debug(`INTEGRITY_PASSED: ${module}`, metadata);
        } else {
            this.critical(`INTEGRITY_FAILED: ${module}`, metadata);
        }
    }

    logEnvironmentMismatch(expected, found) {
        this.warn(`ENVIRONMENT_MISMATCH: Esperado ${expected}, encontrado ${found}`, { expected, found });
    }

    logAsyncOperationTimeout(operationName, timeoutValue) {
        this.error(`ASYNC_OPERATION_TIMEOUT: ${operationName} excedeu ${timeoutValue}ms`, null, { operationName, timeoutValue });
    }

    logSensitiveDataAccess(userId, dataCategory) {
        this.security(`SENSITIVE_DATA_ACCESS: Usuario ${userId} acessou ${dataCategory}`, { userId, dataCategory });
    }

    logClusterWorkerEvent(workerId, event) {
        this.info(`CLUSTER_WORKER_EVENT: Worker ${workerId} -> ${event}`, { workerId, event });
    }

    logPerformanceMetric(metricName, value, unit) {
        this.info(`PERFORMANCE_METRIC: ${metricName} = ${value}${unit}`, { metricName, value, unit });
    }

    logUncaughtException(error) {
        this.critical('FATAL_UNCAUGHT_EXCEPTION', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }

    logUnhandledRejection(reason, promise) {
        this.critical('FATAL_UNHANDLED_REJECTION', {
            reason: reason ? reason.stack || reason : 'Desconhecido',
            promiseDetails: promise,
            timestamp: new Date().toISOString()
        });
    }

    getTransportByLevel(level) {
        return this.transports.find(t => t.level === level);
    }

    updateLogLevel(level) {
        this.logger.level = level;
        this.info(`LOG_LEVEL_UPDATED: O sistema agora esta operando em modo ${level}`);
    }

    flushLogs() {
        return new Promise((resolve) => {
            this.logger.on('finish', resolve);
            this.logger.end();
        });
    }
}

const vlogLoggerInstance = new VlogStudentsLoggerSystem();

setInterval(() => {
    vlogLoggerInstance.logSystemResourceUsage();
}, 600000);

setInterval(() => {
    vlogLoggerInstance.cleanupOldLogs();
}, 86400000);

process.on('uncaughtException', (error) => {
    vlogLoggerInstance.logUncaughtException(error);
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    vlogLoggerInstance.logUnhandledRejection(reason, promise);
});

module.exports = vlogLoggerInstance;

function initializeLogAudit() {
    vlogLoggerInstance.info('Auditando integridade do sistema de logs...');
    const metrics = vlogLoggerInstance.getMetrics();
    if (metrics.activeTransports > 0) {
        vlogLoggerInstance.info('Sistema de logs operando com redundancia ativa.', { transports: metrics.activeTransports });
    } else {
        console.error('ERRO CRITICO: Nenhum transporte de log ativo no VlogStudentsLoggerSystem');
    }
}

initializeLogAudit();

const monitorLogVolume = () => {
    const metrics = vlogLoggerInstance.getMetrics();
    if (metrics.errorCount > 100) {
        vlogLoggerInstance.critical('VOLUME_DE_ERROS_ANORMAL: Mais de 100 erros detectados desde o ultimo reset.');
    }
};

setInterval(monitorLogVolume, 300000);

vlogLoggerInstance.info('VlogStudents Logger Core Engine carregado com sucesso.');