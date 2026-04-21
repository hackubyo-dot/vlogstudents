const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { google } = require('googleapis');
const { Pool } = require('pg');
const { OAuth2Client } = require('google-auth-library');

const DATABASE_URL = 'postgresql://neondb_owner:npg_tzKG1cYOg2JV@ep-billowing-scene-amoqz4x7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const GOOGLE_DRIVE_FOLDER_ID = '1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ';
const GOOGLE_CLIENT_ID = '435332250244-vh9rravt3cmf1vmng29rbbs4vj3iccle.apps.googleusercontent.com';

const authRoutes = require('./src/routes/auth_routes');
const userRoutes = require('./src/routes/user_routes');
const reel_routes = require('./src/routes/reel_routes');
const chat_routes = require('./src/routes/chat_routes');
const point_routes = require('./src/routes/point_routes');
const media_routes = require('./src/routes/media_routes');

class VlogStudentsGlobalServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        
        this.oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID);
        this.neonDatabasePool = new Pool({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 100,
            min: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            maxUses: 10000
        });

        this.configureWinstonLogger();
        this.initializeCorsProtocol();
        this.initializeCloudStorage();
        this.applySecurityOrchestration();
        this.setupCoreMiddlewares();
        this.bootstrapRealtimeEngine();
        this.mapInfrastructureRoutes();
        this.initializeHardwareMonitor();
        this.injectGlobalErrorInterceptors();
        this.configureLifecycleHooks();
    }

    configureWinstonLogger() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/system_error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/server_traffic.log' }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }

    initializeCorsProtocol() {
        const corsOptions = {
            origin: function (origin, callback) {
                callback(null, true);
            },
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allowedHeaders: [
                "Authorization",
                "Content-Type",
                "X-Requested-With",
                "Accept",
                "Origin",
                "X-App-Version",
                "X-App-Platform",
                "X-Trace-Id",
                "Access-Control-Allow-Origin"
            ],
            exposedHeaders: ["X-Trace-Id", "Content-Disposition", "X-Vlog-Status"],
            credentials: true,
            preflightContinue: false,
            optionsSuccessStatus: 204
        };

        this.app.use(cors(corsOptions));

        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With, Accept, Origin, X-App-Version, X-App-Platform, X-Trace-Id');
            res.header('Access-Control-Allow-Credentials', 'true');
            if (req.method === 'OPTIONS') {
                return res.sendStatus(204);
            }
            next();
        });
    }

    initializeCloudStorage() {
        const keyPath = path.join(__dirname, 'credentials.json');
        if (!fs.existsSync(keyPath)) {
            this.logger.error('VLOG_STORAGE_ERROR: credentials.json is missing in root.');
            return;
        }

        this.googleCredentials = new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.readonly',
                'https://www.googleapis.com/auth/drive.metadata'
            ]
        });

        this.googleDriveInstance = google.drive({ version: 'v3', auth: this.googleCredentials });
        this.logger.info('VLOG_STORAGE_STABLE: Google Drive engine connected.');
    }

    applySecurityOrchestration() {
        this.app.use(helmet({
            contentSecurityPolicy: false,
            crossOriginResourcePolicy: { policy: "cross-origin" },
            crossOriginEmbedderPolicy: false,
            crossOriginOpenerPolicy: false,
            frameguard: { action: "deny" },
            hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
            noSniff: true,
            referrerPolicy: { policy: "no-referrer" },
            xssFilter: true
        }));

        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 10000,
            message: { success: false, message: 'Excessive requests from this IP.' },
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use('/api/', limiter);
    }

    setupCoreMiddlewares() {
        this.app.use(compression());
        this.app.use(express.json({ limit: '200mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '200mb' }));
        this.app.use(morgan('combined', { stream: { write: message => this.logger.info(message.trim()) } }));

        this.app.use((req, res, next) => {
            req.database = this.neonDatabasePool;
            req.storage = this.googleDriveInstance;
            req.systemLogger = this.logger;
            req.realtime = this.socketServer;
            const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);
            req.vlogTraceId = requestId;
            res.setHeader('X-Trace-Id', requestId);
            next();
        });
    }

    bootstrapRealtimeEngine() {
        this.socketServer = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST", "PUT", "DELETE"],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            connectTimeout: 60000,
            transports: ['websocket', 'polling']
        });

        this.socketServer.on('connection', (socket) => {
            this.logger.info(`VLOG_REALTIME_SESSION: New link established -> ${socket.id}`);

            socket.on('vlog_auth_handshake', (payload) => {
                socket.studentId = payload.userId;
                socket.join(`student_node_${payload.userId}`);
                this.logger.info(`VLOG_REALTIME_SESSION: Student ${payload.userId} mapped to socket.`);
            });

            socket.on('vlog_message_broadcast', (data) => {
                const { destinationRoom, messageObject } = data;
                this.socketServer.to(destinationRoom).emit('vlog_receive_message', {
                    ...messageObject,
                    serverTime: new Date().toISOString()
                });
            });

            socket.on('vlog_call_signal', (payload) => {
                const { targetStudentId, rtcOffer } = payload;
                this.socketServer.to(`student_node_${targetStudentId}`).emit('vlog_incoming_signal', {
                    rtcOffer,
                    originatorId: socket.studentId
                });
            });

            socket.on('vlog_typing_event', (event) => {
                socket.to(event.roomId).emit('vlog_remote_typing', {
                    studentId: socket.studentId,
                    status: event.isTyping
                });
            });

            socket.on('disconnect', (reason) => {
                this.logger.info(`VLOG_REALTIME_SESSION: Link closed -> ${socket.id} | Reason: ${reason}`);
            });
        });
    }

    mapInfrastructureRoutes() {
        this.app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'operational',
                engine: 'NodeJS V8 Runtime',
                database: 'Neon PostgreSQL Linked',
                storage: 'Google Cloud Drive Connected',
                realtime: 'Socket.io Core Active',
                cors: 'Universal Open',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        this.app.get('/api/v1/system/info', (req, res) => {
            res.json({
                systemName: 'VlogStudents Enterprise',
                version: '1.0.0-Stable',
                environment: process.env.NODE_ENV || 'production',
                corsPolicy: 'Full Cross-Origin Access',
                buildDate: '2025-01-21'
            });
        });

        this.app.use('/api/v1/auth', authRoutes);
        this.app.use('/api/v1/users', userRoutes);
        this.app.use('/api/v1/reels', reel_routes);
        this.app.use('/api/v1/chat', chat_routes);
        this.app.use('/api/v1/points', point_routes);
        this.app.use('/api/v1/media', media_routes);

        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: `The resource ${req.originalUrl} does not exist in VlogStudents domain.`,
                errorCode: 'RESOURCE_NOT_FOUND',
                traceId: req.vlogTraceId
            });
        });
    }

    initializeHardwareMonitor() {
        setInterval(() => {
            const memoryStats = process.memoryUsage();
            const cpuStats = os.loadavg();
            const rssUsage = Math.round(memoryStats.rss / 1024 / 1024);
            const heapTotal = Math.round(memoryStats.heapTotal / 1024 / 1024);
            const heapUsed = Math.round(memoryStats.heapUsed / 1024 / 1024);
            
            this.logger.info(`VLOG_DIAGNOSTIC: RAM RSS ${rssUsage}MB | HEAP ${heapUsed}/${heapTotal}MB | CPU ${cpuStats[0].toFixed(2)}`);
            
            if (rssUsage > 480) {
                this.logger.error('VLOG_DIAGNOSTIC_ALERT: Memory utilization critical. Threshold 480MB exceeded.');
            }
        }, 600000);
    }

    injectGlobalErrorInterceptors() {
        this.app.use((error, req, res, next) => {
            const code = error.statusCode || 500;
            this.logger.error({
                traceId: req.vlogTraceId,
                httpCode: code,
                internalMessage: error.message,
                stackTrace: error.stack,
                originPath: req.originalUrl,
                remoteIp: req.ip
            });

            res.status(code).json({
                success: false,
                traceId: req.vlogTraceId,
                message: process.env.NODE_ENV === 'production' ? 'Internal gateway error in VlogStudents engine.' : error.message,
                timestamp: new Date().toISOString(),
                protocol: 'V1-MASTER'
            });
        });
    }

    configureLifecycleHooks() {
        const terminate = async (signal) => {
            this.logger.info(`LIFECYCLE_SIGNAL: ${signal} detected. Initiating clean exit.`);
            this.server.close(() => {
                this.logger.info('LIFECYCLE_EXIT: Express server closed.');
                this.neonDatabasePool.end().then(() => {
                    this.logger.info('LIFECYCLE_EXIT: NeonDB pool drained successfully.');
                    process.exit(0);
                });
            });

            setTimeout(() => {
                this.logger.error('LIFECYCLE_FATAL: Forced shutdown triggered due to process hang.');
                process.exit(1);
            }, 20000);
        };

        process.on('SIGTERM', () => terminate('SIGTERM'));
        process.on('SIGINT', () => terminate('SIGINT'));
        
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('CORE_UNHANDLED_REJECTION: Exception at promise level.', { reason, promise });
        });

        process.on('uncaughtException', (err) => {
            this.logger.error('CORE_UNCAUGHT_EXCEPTION: Critical process failure.', { err: err.message, stack: err.stack });
            terminate('CRITICAL_EXCEPTION');
        });
    }
}

class VlogEngineDiagnostics {
    static async checkLatency(pool) {
        const start = Date.now();
        const client = await pool.connect();
        try {
            await client.query('SELECT 1');
            return Date.now() - start;
        } finally {
            client.release();
        }
    }
}

class VlogResponseFactory {
    static build(res, content, msg = 'Request processed', status = 200) {
        return res.status(status).json({
            success: true,
            message: msg,
            data: content,
            timestamp: new Date().toISOString()
        });
    }
}

const masterServer = new VlogStudentsGlobalServer();
const APP_PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'testing') {
    masterServer.server.listen(APP_PORT, () => {
        console.log(`+-----------------------------------------------------------+`);
        console.log(`| VLOGSTUDENTS ENTERPRISE ECOSYSTEM v1.0.0                  |`);
        console.log(`+-----------------------------------------------------------+`);
        console.log(`| ENGINE STATUS: FULLY OPERATIONAL                          |`);
        console.log(`| NETWORK PORT: ${APP_PORT}                                        |`);
        console.log(`| DATABASE: POSTGRESQL (NEON.TECH)                          |`);
        console.log(`| CORS: GLOBAL ACCESS GRANTED (0.0.0.0/0)                   |`);
        console.log(`| CLOUD STORAGE: GOOGLE DRIVE V3                            |`);
        console.log(`| REALTIME: SOCKET.IO BARRIER ACTIVE                        |`);
        console.log(`| SYSTEM THEME: NEON LIME DARK MODE                         |`);
        console.log(`+-----------------------------------------------------------+`);
    });
}

function initializeDirectorySafety() {
    const logsDir = path.join(__dirname, 'logs');
    const storageDir = path.join(__dirname, 'uploads');
    const tempDir = path.join(__dirname, 'uploads/temp');
    
    [logsDir, storageDir, tempDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

initializeDirectorySafety();

const performanceAuditor = (req, res, next) => {
    const startMark = process.hrtime();
    res.on('finish', () => {
        const delta = process.hrtime(startMark);
        const ms = (delta[0] * 1000 + delta[1] / 1000000).toFixed(3);
        if (ms > 1500) {
            masterServer.logger.warn(`LATENCY_WARNING: ${req.method} ${req.originalUrl} - ${ms}ms`);
        }
    });
    next();
};

masterServer.app.use(performanceAuditor);

const metadataInjector = (req, res, next) => {
    res.setHeader('Server', 'VlogStudents-Master-Node');
    res.setHeader('X-Vlog-Status', 'Stable');
    next();
};

masterServer.app.use(metadataInjector);

function runSanitization(object) {
    if (!object || typeof object !== 'object') return object;
    Object.keys(object).forEach(key => {
        if (typeof object[key] === 'string') {
            object[key] = object[key].trim().replace(/[<>]/g, '');
        } else if (typeof object[key] === 'object') {
            runSanitization(object[key]);
        }
    });
    return object;
}

masterServer.app.use((req, res, next) => {
    if (req.body) runSanitization(req.body);
    if (req.query) runSanitization(req.query);
    next();
});

const activeConnectionMonitor = () => {
    const activeSockets = masterServer.socketServer.sockets.size;
    masterServer.logger.info(`TELEMETRY: ${activeSockets} students currently in realtime sync.`);
};

setInterval(activeConnectionMonitor, 300000);

masterServer.app.get('/api/v1/ping', (req, res) => {
    res.status(200).send('VLOG_MASTER_PONG');
});

const tracingHeaderMiddleware = (req, res, next) => {
    const traceId = `VLOG-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    req.internalTraceId = traceId;
    res.setHeader('X-Vlog-Request-ID', traceId);
    next();
};

masterServer.app.use(tracingHeaderMiddleware);

function cleanupMemoryThreads() {
    if (global.gc) {
        setInterval(() => {
            global.gc();
        }, 1800000);
    }
}

cleanupMemoryThreads();

const clientComplianceCheck = (req, res, next) => {
    const version = req.headers['x-app-version'];
    if (version && version !== '1.0.0') {
        masterServer.logger.warn(`COMPLIANCE: Legacy client detected: ${version}`);
    }
    next();
};

masterServer.app.use(clientComplianceCheck);

const nightlyCleanupTask = () => {
    const logPath = path.join(__dirname, 'logs/server_traffic.log');
    if (fs.existsSync(logPath)) {
        const stats = fs.statSync(logPath);
        if (stats.size > 80 * 1024 * 1024) {
            fs.renameSync(logPath, path.join(__dirname, `logs/archive_traffic_${Date.now()}.log`));
        }
    }
};

setInterval(nightlyCleanupTask, 86400000);

const cloudIntegrityAudit = () => {
    if (masterServer.googleDriveInstance) {
        masterServer.googleDriveInstance.about.get({ fields: 'storageQuota' })
            .then(() => masterServer.logger.info('INTEGRITY_CHECK: Google Drive Cloud communication verified.'))
            .catch(e => masterServer.logger.error('INTEGRITY_CHECK: Google Drive Cloud communication failure.', e));
    }
};

setTimeout(cloudIntegrityAudit, 10000);

masterServer.app.get('/api/v1/auth/origin-test', (req, res) => {
    res.status(200).json({
        receivedOrigin: req.get('origin'),
        receivedHost: req.get('host'),
        protocol: req.protocol
    });
});

const protocolValidationMiddleware = (req, res, next) => {
    if (req.method === 'POST' && !req.is('json') && !req.is('multipart/form-data')) {
        return res.status(415).json({ success: false, message: 'Unsupported media protocol.' });
    }
    next();
};

masterServer.app.use(protocolValidationMiddleware);

function logEngineStatus() {
    masterServer.logger.info(`VLOG_CORE: Environment is ${process.env.NODE_ENV || 'production'}`);
    masterServer.logger.info(`VLOG_CORE: Platform ${os.platform()} Architecture ${os.arch()}`);
}

logEngineStatus();

const responseBindingMiddleware = (req, res, next) => {
    res.vlogSuccess = (data, message) => VlogResponseFactory.build(res, data, message, 200);
    res.vlogCreated = (data, message) => VlogResponseFactory.build(res, data, message, 201);
    next();
};

masterServer.app.use(responseBindingMiddleware);

const securityAuditPass = (req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    next();
};

masterServer.app.use(securityAuditPass);

const latencyTracker = async (req, res, next) => {
    try {
        const latency = await VlogEngineDiagnostics.checkLatency(masterServer.neonDatabasePool);
        if (latency > 600) {
            masterServer.logger.warn(`CLOUD_DB_LATENCY: Connection to NeonDB is slow (${latency}ms).`);
        }
    } catch (e) {}
    next();
};

masterServer.app.use(latencyTracker);

const masterBootTimestamp = new Date().toISOString();
masterServer.logger.info(`VLOG_CORE_ENGINE_READY: Initialized on ${masterBootTimestamp}`);

module.exports = masterServer.app;
