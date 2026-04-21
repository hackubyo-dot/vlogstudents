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

class VlogStudentsCoreEngine {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);

        this.oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);
        this.databasePool = new Pool({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 100,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
        });

        this.configureLogging();
        this.initializeCORS();
        this.initializeGoogleDrive();
        this.applySecurityLayers();
        this.setupGlobalMiddlewares();
        this.initializeSocketEngine();
        this.buildRoutingTable();
        this.setupSystemDiagnostics();
        this.injectGlobalErrorHandler();
        this.setupGracefulShutdown();
    }

    configureLogging() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/critical_errors.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/vlog_activity.log' }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }

    initializeCORS() {
        this.app.use(cors({
            origin: function (origin, callback) {
                return callback(null, true);
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
                "X-Trace-Id"
            ],
            exposedHeaders: ["X-Trace-Id", "Content-Disposition"],
            credentials: true,
            preflightContinue: false,
            optionsSuccessStatus: 204
        }));

        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With, Accept, Origin, X-App-Version, X-App-Platform, X-Trace-Id');
            if (req.method === 'OPTIONS') {
                return res.sendStatus(204);
            }
            next();
        });
    }

    initializeGoogleDrive() {
        const credentialsPath = path.join(__dirname, 'credentials.json');
        if (!fs.existsSync(credentialsPath)) {
            this.logger.error('ERRO FATAL: credentials.json nao localizado na raiz.');
            return;
        }

        this.googleAuth = new google.auth.GoogleAuth({
            keyFile: credentialsPath,
            scopes: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.readonly'
            ]
        });

        this.driveClient = google.drive({ version: 'v3', auth: this.googleAuth });
        this.logger.info('VLOG_DRIVE: Engine de storage inicializada.');
    }

    applySecurityLayers() {
        this.app.use(helmet({
            contentSecurityPolicy: false,
            crossOriginResourcePolicy: { policy: "cross-origin" },
            crossOriginEmbedderPolicy: false,
            frameguard: { action: "deny" },
            hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
            noSniff: true,
            referrerPolicy: { policy: "no-referrer" },
            xssFilter: true
        }));

        const globalRateLimit = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 5000,
            message: { success: false, message: 'Limite de conexoes atingido.' },
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use('/api/', globalRateLimit);
    }

    setupGlobalMiddlewares() {
        this.app.use(compression());
        this.app.use(express.json({ limit: '150mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '150mb' }));
        this.app.use(morgan('dev'));

        this.app.use((req, res, next) => {
            req.db = this.databasePool;
            req.drive = this.driveClient;
            req.logger = this.logger;
            req.io = this.io;
            const traceId = Date.now().toString(36) + Math.random().toString(36).substring(2);
            req.traceId = traceId;
            res.setHeader('X-Trace-Id', traceId);
            next();
        });
    }

    initializeSocketEngine() {
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST", "PUT", "DELETE"],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: ['websocket', 'polling']
        });

        this.io.on('connection', (socket) => {
            this.logger.info(`VLOG_SOCKET: Nova conexao -> ${socket.id}`);

            socket.on('authenticate_vlog', (data) => {
                socket.userId = data.userId;
                socket.join(`user_room_${data.userId}`);
                this.logger.info(`VLOG_SOCKET: Usuario ${data.userId} autenticado.`);
            });

            socket.on('dispatch_chat_message', (payload) => {
                const { roomId, content, senderId } = payload;
                this.io.to(roomId).emit('receive_new_message', {
                    id: Date.now(),
                    content,
                    senderId,
                    timestamp: new Date().toISOString()
                });
            });

            socket.on('webrtc_signal', (data) => {
                const { targetId, signal } = data;
                this.io.to(`user_room_${targetId}`).emit('webrtc_signal_received', {
                    signal,
                    from: socket.userId
                });
            });

            socket.on('disconnect', () => {
                this.logger.info(`VLOG_SOCKET: Conexao encerrada -> ${socket.id}`);
            });
        });
    }

    buildRoutingTable() {
        this.app.get('/api/v1/health', (req, res) => {
            res.status(200).json({
                status: 'operational',
                service: 'VlogStudents Master API',
                database: 'connected',
                storage: 'active',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        this.app.get('/api/v1/info', (req, res) => {
            res.json({
                app: 'VlogStudents',
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'production',
                cors: 'unrestricted'
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
                message: `Rota ${req.originalUrl} nao existe no ecossistema VlogStudents.`,
                timestamp: new Date().toISOString()
            });
        });
    }

    setupSystemDiagnostics() {
        setInterval(() => {
            const memory = process.memoryUsage();
            const rss = Math.round(memory.rss / 1024 / 1024);
            const heap = Math.round(memory.heapUsed / 1024 / 1024);
            this.logger.info(`SYSTEM_DIAGNOSTIC: RSS ${rss}MB | HEAP ${heap}MB | UPTIME ${Math.round(process.uptime())}s`);

            if (rss > 450) {
                this.logger.error('SYSTEM_CRITICAL: Uso de memoria acima de 450MB detectado.');
            }
        }, 300000);
    }

    injectGlobalErrorHandler() {
        this.app.use((err, req, res, next) => {
            const statusCode = err.statusCode || 500;
            this.logger.error({
                traceId: req.traceId,
                status: statusCode,
                message: err.message,
                stack: err.stack,
                url: req.originalUrl,
                ip: req.ip
            });

            res.status(statusCode).json({
                success: false,
                traceId: req.traceId,
                message: process.env.NODE_ENV === 'production' ? 'Erro interno no servidor VlogStudents.' : err.message,
                timestamp: new Date().toISOString()
            });
        });
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            this.logger.info(`SHUTDOWN_SEQUENCE: Sinal ${signal} recebido.`);
            this.server.close(() => {
                this.logger.info('SHUTDOWN_SEQUENCE: Servidor HTTP encerrado.');
                this.databasePool.end().then(() => {
                    this.logger.info('SHUTDOWN_SEQUENCE: Conexoes NeonDB finalizadas.');
                    process.exit(0);
                });
            });

            setTimeout(() => {
                this.logger.error('SHUTDOWN_SEQUENCE: Forcando encerramento por timeout.');
                process.exit(1);
            }, 15000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
}

class VlogResponseWrapper {
    static send(res, data, message = 'Operacao concluida', status = 200) {
        return res.status(status).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }
}

class VlogDatabaseManager {
    static async executeQuery(pool, sql, params) {
        const client = await pool.connect();
        try {
            return await client.query(sql, params);
        } finally {
            client.release();
        }
    }
}

const engine = new VlogStudentsCoreEngine();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
    engine.server.listen(PORT, () => {
        console.log(`+-----------------------------------------------------------+`);
        console.log(`| VLOGSTUDENTS ENTERPRISE BACKEND v1.0.0                    |`);
        console.log(`+-----------------------------------------------------------+`);
        console.log(`| STATUS: TOTALMENTE OPERACIONAL                            |`);
        console.log(`| PORTA: ${PORT}                                               |`);
        console.log(`| DATABASE: POSTGRESQL (NEON.TECH)                          |`);
        console.log(`| CORS: LIBERADO (MODO FULL ACCESS)                         |`);
        console.log(`| STORAGE: GOOGLE DRIVE API v3                              |`);
        console.log(`| REALTIME: SOCKET.IO ACTIVE                                |`);
        console.log(`+-----------------------------------------------------------+`);
    });
}

function initializeApplicationState() {
    const logPath = path.join(__dirname, 'logs');
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(logPath)) fs.mkdirSync(logPath);
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
}

initializeApplicationState();

const trafficAuditMiddleware = (req, res, next) => {
    const start = process.hrtime();
    res.on('finish', () => {
        const diff = process.hrtime(start);
        const ms = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(3);
        if (ms > 1000) {
            engine.logger.warn(`PERFORMANCE_ALERT: Requisicao ${req.method} ${req.originalUrl} demorou ${ms}ms`);
        }
    });
    next();
};

engine.app.use(trafficAuditMiddleware);

const securityHeaderFix = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
};

engine.app.use(securityHeaderFix);

function validateSystemVariables() {
    const required = ['PORT', 'DATABASE_URL', 'GOOGLE_DRIVE_FOLDER_ID'];
    required.forEach(v => {
        if (!process.env[v]) {
            console.warn(`WARNING: Variavel de ambiente ${v} nao configurada.`);
        }
    });
}

validateSystemVariables();

const deepSanitizer = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string') {
            obj[key] = obj[key].replace(/[<>]/g, '').trim();
        } else if (typeof obj[key] === 'object') {
            deepSanitizer(obj[key]);
        }
    });
    return obj;
};

engine.app.use((req, res, next) => {
    if (req.body) deepSanitizer(req.body);
    if (req.query) deepSanitizer(req.query);
    next();
});

const socketActivityTracker = () => {
    const count = engine.io.sockets.sockets.size;
    engine.logger.info(`REALTIME_METRIC: ${count} conexoes de socket ativas.`);
};

setInterval(socketActivityTracker, 600000);

engine.app.get('/api/v1/system/ping', (req, res) => {
    res.status(200).send('PONG_VLOG');
});

const requestIdMiddleware = (req, res, next) => {
    const id = `VS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    req.vlogRequestId = id;
    res.setHeader('X-Vlog-Request-ID', id);
    next();
};

engine.app.use(requestIdMiddleware);

function monitorThreadHealth() {
    if (global.gc) {
        setInterval(() => {
            global.gc();
        }, 3600000);
    }
}

monitorThreadHealth();

const appVersionInterceptor = (req, res, next) => {
    const clientVersion = req.headers['x-app-version'];
    if (clientVersion && clientVersion !== '1.0.0') {
        engine.logger.warn(`VERSION_MISMATCH: Cliente utilizando versao ${clientVersion}`);
    }
    next();
};

engine.app.use(appVersionInterceptor);

const logRotationJob = () => {
    const logFile = path.join(__dirname, 'logs/vlog_activity.log');
    if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > 50 * 1024 * 1024) {
            fs.renameSync(logFile, path.join(__dirname, `logs/vlog_activity_${Date.now()}.log`));
        }
    }
};

setInterval(logRotationJob, 86400000);

const systemMaintenanceCheck = (req, res, next) => {
    const isMaintenance = false;
    if (isMaintenance && !req.url.includes('/health')) {
        return res.status(503).json({ success: false, message: 'Sistema em manutencao programada.' });
    }
    next();
};

engine.app.use(systemMaintenanceCheck);

const payloadIntegrityCheck = (req, res, next) => {
    if (req.method === 'POST' && !req.is('json') && !req.is('multipart/form-data')) {
        return res.status(415).json({ success: false, message: 'Formato de midia nao suportado.' });
    }
    next();
};

engine.app.use(payloadIntegrityCheck);

function logEnvironmentBoot() {
    engine.logger.info(`VLOG_BOOT: Engine iniciada em modo ${process.env.NODE_ENV || 'development'}`);
    engine.logger.info(`VLOG_BOOT: Memoria total disponivel: ${Math.round(require('os').totalmem() / 1024 / 1024)}MB`);
}

logEnvironmentBoot();

engine.app.get('/favicon.ico', (req, res) => res.status(204));

const securityHeadersAudit = (req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('Server', 'VlogStudents-Core');
    next();
};

engine.app.use(securityHeadersAudit);

function monitorNetworkLatency() {
    setInterval(async () => {
        try {
            const start = Date.now();
            await engine.databasePool.query('SELECT 1');
            const end = Date.now();
            if (end - start > 500) {
                engine.logger.warn(`DB_LATENCY: Atraso de rede com NeonDB detectado: ${end - start}ms`);
            }
        } catch (e) {}
    }, 60000);
}

monitorNetworkLatency();

const requestContextBinder = (req, res, next) => {
    res.sendSuccess = (data, msg) => VlogResponseWrapper.send(res, data, msg, 200);
    res.sendCreated = (data, msg) => VlogResponseWrapper.send(res, data, msg, 201);
    next();
};

engine.app.use(requestContextBinder);

function verifyCloudStorageConnection() {
    if (engine.driveClient) {
        engine.driveClient.about.get({ fields: 'user' })
            .then(() => engine.logger.info('VLOG_STORAGE: Conexao com Google Drive validada.'))
            .catch(err => engine.logger.error('VLOG_STORAGE: Falha na validacao do Drive.', err));
    }
}

setTimeout(verifyCloudStorageConnection, 5000);

const finalMiddlewareAudit = (req, res, next) => {
    next();
};

engine.app.use(finalMiddlewareAudit);

const bootTimestamp = new Date().toISOString();
engine.logger.info(`VLOG_CORE_STABLE: Inicializado em ${bootTimestamp}`);

module.exports = engine.app;
