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
        this.io = socketIo(this.server, {
            cors: {
                origin: ["http://localhost:3000", "https://vlogstudents.onrender.com"],
                methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
                allowedHeaders: ["Authorization", "Content-Type"],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });

        this.oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);
        this.databasePool = new Pool({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 50,
            idleTimeoutMillis: 30000
        });

        this.configureLogging();
        this.initializeGoogleDrive();
        this.applySecurityLayers();
        this.setupGlobalMiddlewares();
        this.registerRealtimeEvents();
        this.buildRoutingTable();
        this.injectGlobalErrorHandler();
    }

    configureLogging() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/system_activity.log' }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }

    initializeGoogleDrive() {
        const credentialsPath = path.join(__dirname, 'credentials.json');
        if (!fs.existsSync(credentialsPath)) {
            throw new Error('Arquivo credentials.json obrigatorio nao encontrado na raiz do backend.');
        }

        this.googleAuth = new google.auth.GoogleAuth({
            keyFile: credentialsPath,
            scopes: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.readonly',
                'https://www.googleapis.com/auth/drive.metadata.readonly'
            ]
        });

        this.driveClient = google.drive({ version: 'v3', auth: this.googleAuth });
        this.logger.info('Google Drive Service Provider inicializado com sucesso.');
    }

    applySecurityLayers() {
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    connectSrc: ["'self'", "https://vlogstudents.onrender.com", "wss://vlogstudents.onrender.com"],
                    imgSrc: ["'self'", "data:", "https://*.googleusercontent.com", "https://*.googleapis.com"],
                    mediaSrc: ["'self'", "blob:", "https://*.googleapis.com"],
                    scriptSrc: ["'self'", "https://accounts.google.com"]
                }
            },
            crossOriginResourcePolicy: { policy: "cross-origin" }
        }));

        this.app.use(cors({
            origin: ["http://localhost:3000", "https://vlogstudents.onrender.com"],
            methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
            credentials: true,
            optionsSuccessStatus: 204
        }));

        const globalRateLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 2000,
            message: { error: 'Limite de trafego atingido para este IP. Protecao anti-DDoS ativa.' },
            standardHeaders: true,
            legacyHeaders: false,
        });
        this.app.use('/api/', globalRateLimiter);
    }

    setupGlobalMiddlewares() {
        this.app.use(compression());
        this.app.use(express.json({ limit: '100mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '100mb' }));
        this.app.use(morgan('combined', {
            stream: { write: message => this.logger.info(message.trim()) },
            skip: (req) => req.url === '/health'
        }));

        this.app.use((req, res, next) => {
            req.db = this.databasePool;
            req.drive = this.driveClient;
            req.logger = this.logger;
            req.io = this.io;
            next();
        });
    }

    registerRealtimeEvents() {
        this.io.on('connection', (socket) => {
            this.logger.info(`Conexao estabelecida no barramento Socket: ${socket.id}`);

            socket.on('authenticate_session', (userData) => {
                socket.userId = userData.userId;
                socket.join(`user_room_${userData.userId}`);
                this.logger.info(`Usuario ${userData.userId} autenticado no WebSocket`);
            });

            socket.on('join_vlog_chat', (payload) => {
                const { roomId } = payload;
                socket.join(roomId);
                this.logger.info(`Socket ${socket.id} entrou na sala de chat ${roomId}`);
            });

            socket.on('dispatch_chat_message', async (data) => {
                const { roomId, message, senderId, type } = data;
                this.io.to(roomId).emit('receive_vlog_message', {
                    messageId: Date.now().toString(),
                    senderId,
                    content: message,
                    type: type || 'text',
                    timestamp: new Date().toISOString()
                });
            });

            socket.on('webrtc_video_offer', (data) => {
                const { targetUserId, offer, callerName } = data;
                this.io.to(`user_room_${targetUserId}`).emit('incoming_video_call', {
                    offer,
                    callerId: socket.userId,
                    callerName
                });
            });

            socket.on('webrtc_video_answer', (data) => {
                const { targetUserId, answer } = data;
                this.io.to(`user_room_${targetUserId}`).emit('video_call_accepted', {
                    answer,
                    responderId: socket.userId
                });
            });

            socket.on('webrtc_ice_candidate', (data) => {
                const { targetUserId, candidate } = data;
                this.io.to(`user_room_${targetUserId}`).emit('remote_ice_candidate', {
                    candidate
                });
            });

            socket.on('track_reel_interaction', async (interaction) => {
                const { userId, reelId, action } = interaction;
                this.logger.info(`Interacao Realtime: Usuario ${userId} executou ${action} no reel ${reelId}`);
            });

            socket.on('disconnect', () => {
                this.logger.info(`Conexao encerrada no barramento Socket: ${socket.id}`);
            });
        });
    }

    buildRoutingTable() {
        this.app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'operational',
                service: 'VlogStudents-API',
                db_status: 'connected',
                storage_provider: 'Google Drive',
                theme_context: 'Neon Lime Dark Mode',
                uptime: process.uptime()
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
                message: 'Recurso de API nao localizado',
                path: req.originalUrl
            });
        });
    }

    injectGlobalErrorHandler() {
        this.app.use((err, req, res, next) => {
            const statusCode = err.statusCode || 500;
            const logId = Date.now().toString(36) + Math.random().toString(36).substr(2);

            this.logger.error({
                logId: logId,
                status: statusCode,
                message: err.message,
                stack: err.stack,
                url: req.originalUrl,
                method: req.method,
                ip: req.ip
            });

            res.status(statusCode).json({
                success: false,
                error_id: logId,
                message: this.isProduction() ? 'Ocorreu um erro interno no servidor VlogStudents' : err.message,
                timestamp: new Date().toISOString()
            });
        });
    }

    isProduction() {
        return process.env.NODE_ENV === 'production';
    }

    startHeartbeatMonitor() {
        setInterval(() => {
            const memory = process.memoryUsage();
            this.logger.info(`Monitoramento de Recursos: RSS ${Math.round(memory.rss / 1024 / 1024)}MB | Heap ${Math.round(memory.heapUsed / 1024 / 1024)}MB`);
        }, 300000);
    }
}

class VlogStudentsErrorHandler extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

class DatabaseIntegrityManager {
    static async checkConnectivity(pool) {
        try {
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            return true;
        } catch (error) {
            return false;
        }
    }
}

const vlogEngine = new VlogStudentsCoreEngine();
const serverInstance = vlogEngine.server;

function ensureUploadDirectories() {
    const rootDir = __dirname;
    const paths = [
        path.join(rootDir, 'logs'),
        path.join(rootDir, 'uploads'),
        path.join(rootDir, 'uploads/temp')
    ];

    paths.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

ensureUploadDirectories();

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
    serverInstance.listen(PORT, async () => {
        const dbOnline = await DatabaseIntegrityManager.checkConnectivity(vlogEngine.databasePool);

        console.log(`+-----------------------------------------------------------+`);
        console.log(`| VLOGSTUDENTS PROFESSIONAL BACKEND v1.0.0                  |`);
        console.log(`+-----------------------------------------------------------+`);
        console.log(`| STATUS: OPERACIONAL                                       |`);
        console.log(`| PORTA: ${PORT}                                               |`);
        console.log(`| DATABASE: ${dbOnline ? 'CONECTADO (NEONDB)' : 'FALHA NA CONEXAO'}        |`);
        console.log(`| DRIVE ID: ${GOOGLE_DRIVE_FOLDER_ID.substring(0, 8)}...           |`);
        console.log(`| AMBIENTE: ${process.env.NODE_ENV || 'development'}                     |`);
        console.log(`| UI THEME: DARK / NEON LIME (#CCFF00)                      |`);
        console.log(`+-----------------------------------------------------------+`);

        vlogEngine.startHeartbeatMonitor();
    });
}

process.on('SIGTERM', () => {
    console.log('Sinal SIGTERM recebido. Encerrando servidor VlogStudents...');
    serverInstance.close(() => {
        vlogEngine.databasePool.end();
        console.log('Processos encerrados com sucesso.');
        process.exit(0);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    vlogEngine.logger.error('Unhandled Rejection detectada:', reason);
});

module.exports = {
    app: vlogEngine.app,
    server: serverInstance,
    io: vlogEngine.io,
    drive: vlogEngine.driveClient,
    db: vlogEngine.databasePool,
    VlogStudentsErrorHandler
};

function extendServerProtocols() {
    express.response.sendSuccess = function(data, message = 'Operacao concluida', code = 200) {
        return this.status(code).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    };

    express.response.sendFailure = function(message = 'Falha na operacao', code = 400) {
        return this.status(code).json({
            success: false,
            message,
            timestamp: new Date().toISOString()
        });
    };
}

extendServerProtocols();

const systemTrafficInterceptor = (req, res, next) => {
    const startTime = process.hrtime();
    res.on('finish', () => {
        const elapsedTime = process.hrtime(startTime);
        const durationInMs = (elapsedTime[0] * 1000 + elapsedTime[1] / 1e6).toFixed(3);
        if (durationInMs > 1500) {
            vlogEngine.logger.warn(`Performance Degradada: ${req.method} ${req.originalUrl} demorou ${durationInMs}ms`);
        }
    });
    next();
};

vlogEngine.app.use(systemTrafficInterceptor);

const securityHeadersAudit = (req, res, next) => {
    res.setHeader('X-VlogStudents-Node', 'V1-Alpha');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('X-Download-Options', 'noopen');
    next();
};

vlogEngine.app.use(securityHeadersAudit);

function validateEnvConfig() {
    const criticalVars = ['PORT', 'NODE_ENV'];
    criticalVars.forEach(v => {
        if (!process.env[v]) {
            vlogEngine.logger.warn(`Configuracao de ambiente ausente: ${v}. Usando valores default.`);
        }
    });
}

validateEnvConfig();

const analyticsEngineStub = {
    trackRequest: (req) => {
        if (req.url.includes('/api/v1/reels')) {
            vlogEngine.logger.info(`Analytics: Acesso ao feed de Reels detectado.`);
        }
    }
};

vlogEngine.app.use((req, res, next) => {
    analyticsEngineStub.trackRequest(req);
    next();
});

const corsOptionDelegate = function (req, callback) {
    let corsOptions;
    if (allowedOrigins.indexOf(req.header('Origin')) !== -1) {
      corsOptions = { origin: true };
    } else {
      corsOptions = { origin: false };
    }
    callback(null, corsOptions);
};

vlogEngine.app.options('*', cors(corsOptionDelegate));

const payloadSanitizer = (req, res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key].trim().replace(/[<>]/g, '');
            }
        });
    }
    next();
};

vlogEngine.app.use(payloadSanitizer);

const requestTracer = (req, res, next) => {
    const traceId = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    req.traceId = traceId;
    res.setHeader('X-Trace-Id', traceId);
    next();
};

vlogEngine.app.use(requestTracer);

const logRotationPolicy = () => {
    const logFile = path.join(__dirname, 'logs/system_activity.log');
    if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        const fileSizeInBytes = stats.size;
        const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);
        if (fileSizeInMegabytes > 50) {
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            fs.renameSync(logFile, path.join(__dirname, `logs/system_activity_${timestamp}.log`));
        }
    }
};

setInterval(logRotationPolicy, 86400000);

vlogEngine.app.get('/api/v1/info', (req, res) => {
    res.sendSuccess({
        app_name: 'VlogStudents',
        version: '1.0.0',
        neon_db: 'Active',
        storage: 'Google Drive API v3',
        realtime_engine: 'Socket.io',
        auth_mode: 'JWT + Google OAuth'
    });
});

vlogEngine.app.use((req, res, next) => {
    const memoryUsage = process.memoryUsage().rss / 1024 / 1024;
    if (memoryUsage > 450) {
        vlogEngine.logger.error(`MEMORIA CRITICA NO WORKER: ${memoryUsage.toFixed(2)} MB`);
    }
    next();
});

const systemInfoSnapshot = () => {
    const info = {
        platform: process.platform,
        arch: process.arch,
        node_version: process.version,
        pid: process.pid,
        cwd: process.cwd()
    };
    vlogEngine.logger.info(`System Snapshot: ${JSON.stringify(info)}`);
};

systemInfoSnapshot();

const lifecycleAudit = (req, res, next) => {
    const auditInfo = `[AUDIT] ${new Date().toISOString()} | ${req.method} | ${req.url} | UA: ${req.get('User-Agent')}\n`;
    fs.appendFile(path.join(__dirname, 'logs/access.log'), auditInfo, () => {});
    next();
};

vlogEngine.app.use(lifecycleAudit);

function shutdownSequence() {
    vlogEngine.logger.info('Iniciando sequencia de encerramento controlado...');
    serverInstance.close(() => {
        vlogEngine.databasePool.end().then(() => {
            vlogEngine.logger.info('Conexoes de banco encerradas.');
            process.exit(0);
        });
    });
}

process.on('SIGINT', shutdownSequence);

vlogEngine.logger.info('Core Engine VlogStudents carregado com sucesso.');