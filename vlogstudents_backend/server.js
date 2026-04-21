const express = require('express');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { Pool } = require('pg');
const multer = require('multer');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const stream = require('stream');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const os = require('os');
const buildEngine = require('./build');

dotenv.config();

const DATABASE_URL = 'postgresql://neondb_owner:npg_tzKG1cYOg2JV@ep-billowing-scene-amoqz4x7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const GOOGLE_DRIVE_FOLDER_ID = '1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ';
const GOOGLE_CLIENT_ID = '435332250244-vh9rravt3cmf1vmng29rbbs4vj3iccle.apps.googleusercontent.com';
const JWT_SECRET = process.env.JWT_SECRET || 'VLOG_MASTER_CORE_ULTIMATE_SYSTEM_2025_SECURE_TOKEN_STABLE_ALFA_OMEGA';

class VlogStudentsEnterpriseKernel {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.appPort = process.env.PORT || 3000;
        
        this.bootstrapInitialization();
    }

    async bootstrapInitialization() {
        this.initializeLoggingAndFolders();
        this.initializeNeonDatabase();
        this.initializeMulterEngine();
        this.initializeSecurityMiddleware();
        this.initializeGoogleCloudServices();
        this.initializeRealtimeArchitecture();
        this.initializeCoreApplicationRoutes();
        this.initializeDatabaseAutoMigration();
        this.initializeSystemMonitoring();
        this.initializeProcessLifespan();
        this.finalizeServerDeployment();
    }

    initializeLoggingAndFolders() {
        const rootPath = process.cwd();
        const essentialPaths = [
            path.join(rootPath, 'logs'),
            path.join(rootPath, 'uploads'),
            path.join(rootPath, 'uploads/temp'),
            path.join(rootPath, 'uploads/reels'),
            path.join(rootPath, 'uploads/profiles')
        ];

        essentialPaths.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
        console.log('KERNEL_INIT: File system hierarchy secured.');
    }

    initializeNeonDatabase() {
        this.dbPool = new Pool({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 100,
            min: 10,
            idleTimeoutMillis: 40000,
            connectionTimeoutMillis: 20000,
            maxUses: 10000
        });

        this.dbPool.on('connect', (client) => {
            client.query('SET client_encoding = "UTF8"');
        });

        this.dbPool.on('error', (fatalError) => {
            console.error('KERNEL_DB_FATAL: NeonDB connection pool lost integrity.', fatalError.message);
        });
    }

    initializeMulterEngine() {
        this.uploadStorage = multer.memoryStorage();
        this.multerUploader = multer({
            storage: this.uploadStorage,
            limits: {
                fileSize: 200 * 1024 * 1024,
                files: 1
            },
            fileFilter: (req, file, cb) => {
                const allowedMimes = ['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp'];
                if (allowedMimes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Formato de arquivo nao suportado pelo ecossistema VlogStudents.'), false);
                }
            }
        });
        console.log('KERNEL_INIT: Multer upload stream active.');
    }

    initializeSecurityMiddleware() {
        this.app.use(cors({
            origin: function (origin, callback) {
                callback(null, true);
            },
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-App-Version", "X-App-Platform", "X-Vlog-Trace"],
            exposedHeaders: ["Content-Range", "X-Content-Range", "X-Vlog-Trace", "Content-Disposition"],
            credentials: true,
            maxAge: 86400,
            preflightContinue: false,
            optionsSuccessStatus: 204
        }));

        this.app.use(helmet({
            contentSecurityPolicy: false,
            crossOriginResourcePolicy: { policy: "cross-origin" },
            crossOriginEmbedderPolicy: false,
            crossOriginOpenerPolicy: false,
            frameguard: { action: "deny" },
            hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
            noSniff: true,
            xssFilter: true
        }));

        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-App-Version, X-App-Platform');
            res.header('Access-Control-Allow-Credentials', 'true');
            if (req.method === 'OPTIONS') {
                return res.sendStatus(204);
            }
            next();
        });

        this.app.use(compression());
        this.app.use(express.json({ limit: '150mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '150mb' }));
        this.app.use(morgan('combined'));
    }

    initializeGoogleCloudServices() {
        const keyFile = path.join(__dirname, 'credentials.json');
        if (!fs.existsSync(keyFile)) {
            console.error('KERNEL_STORAGE_FATAL: credentials.json missing. Google Drive API link disabled.');
            return;
        }

        try {
            this.googleAuthManager = new google.auth.GoogleAuth({
                keyFile: keyFile,
                scopes: [
                    'https://www.googleapis.com/auth/drive.file',
                    'https://www.googleapis.com/auth/drive.readonly',
                    'https://www.googleapis.com/auth/drive.metadata'
                ]
            });
            this.driveEngine = google.drive({ version: 'v3', auth: this.googleAuthManager });
            this.googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);
            console.log('KERNEL_STORAGE: Cloud Drive link established.');
        } catch (storageError) {
            console.error('KERNEL_STORAGE_FAIL: Failed to initialize Google API stack.', storageError.message);
        }
    }

    initializeRealtimeArchitecture() {
        this.realtimeBus = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: ['websocket', 'polling']
        });

        this.realtimeBus.on('connection', (node) => {
            console.log(`KERNEL_REALTIME: Link established on node ${node.id}`);

            node.on('vlog_handshake', (authPayload) => {
                node.studentId = authPayload.userId;
                node.join(`student_node_${authPayload.userId}`);
            });

            node.on('vlog_message_broadcast', (msg) => {
                this.realtimeBus.to(`student_node_${msg.targetId}`).emit('vlog_message_receive', {
                    content: msg.content,
                    senderId: node.studentId,
                    timestamp: new Date().toISOString()
                });
            });

            node.on('vlog_typing_signal', (ev) => {
                node.to(`student_node_${ev.targetId}`).emit('vlog_remote_typing', {
                    status: ev.status,
                    from: node.studentId
                });
            });

            node.on('disconnect', () => {
                console.log(`KERNEL_REALTIME: Node ${node.id} disconnected.`);
            });
        });
    }

    async initializeDatabaseAutoMigration() {
        console.log('KERNEL_DB: Executing self-healing audit...');
        const masterMigrationSql = `
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
                    CREATE TABLE users (
                        user_identification SERIAL PRIMARY KEY,
                        google_id_reference VARCHAR(255) UNIQUE,
                        user_email_address VARCHAR(255) UNIQUE NOT NULL,
                        user_full_name VARCHAR(255) NOT NULL,
                        user_avatar_link TEXT,
                        user_university_name VARCHAR(255),
                        user_points_total INTEGER DEFAULT 0,
                        user_theme_pref VARCHAR(10) DEFAULT 'dark',
                        user_referral_code VARCHAR(20) UNIQUE,
                        user_phone_number VARCHAR(30),
                        user_biography_text TEXT,
                        user_account_status BOOLEAN DEFAULT TRUE,
                        user_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        user_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reels') THEN
                    CREATE TABLE reels (
                        reel_identification SERIAL PRIMARY KEY,
                        author_user_id INTEGER REFERENCES users(user_identification) ON DELETE CASCADE,
                        reel_title_text VARCHAR(255),
                        reel_description_content TEXT,
                        reel_drive_key VARCHAR(255) NOT NULL,
                        reel_thumbnail_key VARCHAR(255),
                        reel_views_count INTEGER DEFAULT 0,
                        reel_likes_count INTEGER DEFAULT 0,
                        reel_comments_count INTEGER DEFAULT 0,
                        reel_is_active BOOLEAN DEFAULT TRUE,
                        reel_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_history') THEN
                    CREATE TABLE wallet_history (
                        transaction_id SERIAL PRIMARY KEY,
                        owner_user_id INTEGER REFERENCES users(user_identification) ON DELETE CASCADE,
                        points_amount INTEGER NOT NULL,
                        transaction_reason VARCHAR(255),
                        transaction_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_links') THEN
                    CREATE TABLE referral_links (
                        referral_id SERIAL PRIMARY KEY,
                        referrer_user_id INTEGER REFERENCES users(user_identification) ON DELETE CASCADE,
                        invited_user_id INTEGER REFERENCES users(user_identification) ON DELETE CASCADE,
                        applied_code VARCHAR(20),
                        referral_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_phone_number') THEN
                    ALTER TABLE users ADD COLUMN user_phone_number VARCHAR(30);
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_biography_text') THEN
                    ALTER TABLE users ADD COLUMN user_biography_text TEXT;
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_updated_at') THEN
                    ALTER TABLE users ADD COLUMN user_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END $$;
        `;
        try {
            const runner = await this.dbPool.connect();
            await runner.query(masterMigrationSql);
            runner.release();
            console.log('KERNEL_DB: Self-healing sequence successful. All relations verified.');
        } catch (migrationError) {
            console.error('KERNEL_DB_FAIL: Integrity sequence collapsed.', migrationError.message);
        }
    }

    initializeCoreApplicationRoutes() {
        this.app.get('/', (req, res) => {
            const apiInventory = [
                { path: '/api/v1/auth/identity', method: 'POST', scope: 'Security', status: 'Active' },
                { path: '/api/v1/auth/onboarding', method: 'POST', scope: 'Security', status: 'Active' },
                { path: '/api/v1/reels/stream', method: 'GET', scope: 'Content', status: 'Active' },
                { path: '/api/v1/reels/publish', method: 'POST', scope: 'Content', status: 'Active' },
                { path: '/api/v1/wallet/balance', method: 'GET', scope: 'Finance', status: 'Active' },
                { path: '/api/v1/chat/history', method: 'GET', scope: 'Realtime', status: 'Active' },
                { path: '/api/v1/users/profile', method: 'GET', scope: 'Profile', status: 'Active' },
                { path: '/api/v1/system/heartbeat', method: 'GET', scope: 'Admin', status: 'Active' }
            ];
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(buildEngine.generateSuccessTemplate(apiInventory));
        });

        this.app.get('/health', (req, res) => {
            res.status(200).json({
                success: true,
                kernel_status: 'operational',
                uptime: process.uptime(),
                neon_db: 'active_link',
                drive_storage: this.driveEngine ? 'active_link' : 'disconnected',
                node_version: process.version,
                timestamp: new Date().toISOString()
            });
        });

        this.app.post('/api/v1/auth/identity', async (req, res) => {
            const { email } = req.body;
            try {
                const searchSql = 'SELECT * FROM users WHERE user_email_address = $1';
                const result = await this.dbPool.query(searchSql, [email.toLowerCase()]);
                if (result.rows.length === 0) {
                    return res.status(404).json({ success: false, message: 'Conta nao localizada no ecossistema.' });
                }
                const user = result.rows[0];
                const sessionToken = jwt.sign({ id: user.user_identification, email: user.user_email_address }, JWT_SECRET, { expiresIn: '7d' });
                res.status(200).json({ success: true, data: { user, token: sessionToken } });
            } catch (authError) {
                res.status(500).json({ success: false, message: 'Kernel Identity Error: Falha no processamento.' });
            }
        });

        this.app.post('/api/v1/auth/onboarding', async (req, res) => {
            const { fullName, email, password, university } = req.body;
            try {
                const referral = 'VLOG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                const sqlInsert = `
                    INSERT INTO users (user_full_name, user_email_address, user_university_name, user_referral_code)
                    VALUES ($1, $2, $3, $4) RETURNING *
                `;
                const result = await this.dbPool.query(sqlInsert, [fullName, email.toLowerCase(), university, referral]);
                const newUser = result.rows[0];
                const sessionToken = jwt.sign({ id: newUser.user_identification, email: newUser.user_email_address }, JWT_SECRET, { expiresIn: '7d' });
                res.status(201).json({ success: true, data: { user: newUser, token: sessionToken } });
            } catch (regError) {
                res.status(500).json({ success: false, message: 'Kernel Onboarding Error: Falha na persistencia.' });
            }
        });

        this.app.post('/api/v1/reels/publish', this.multerUploader.single('file'), async (req, res) => {
            if (!this.driveEngine) return res.status(503).json({ success: false, message: 'Cloud Drive Engine not active.' });
            
            try {
                const { userId, title, description } = req.body;
                const fileBuffer = req.file;
                if (!fileBuffer) throw new Error('Binary stream missing from request.');

                const passStream = new stream.PassThrough();
                passStream.end(fileBuffer.buffer);

                const cloudRes = await this.driveEngine.files.create({
                    requestBody: { name: `vlog_asset_${Date.now()}`, parents: [GOOGLE_DRIVE_FOLDER_ID] },
                    media: { mimeType: fileBuffer.mimetype, body: passStream },
                    fields: 'id'
                });

                const cloudKey = cloudRes.data.id;
                await this.driveEngine.permissions.create({ fileId: cloudKey, requestBody: { role: 'reader', type: 'anyone' } });

                const insertSql = `
                    INSERT INTO reels (author_user_id, reel_title_text, reel_description_content, reel_drive_key)
                    VALUES ($1, $2, $3, $4) RETURNING *
                `;
                const dbResult = await this.dbPool.query(insertSql, [userId, title, description, cloudKey]);

                await this.dbPool.query('UPDATE users SET user_points_total = user_points_total + 50 WHERE user_identification = $1', [userId]);
                await this.dbPool.query('INSERT INTO wallet_history (owner_user_id, points_amount, transaction_reason) VALUES ($1, 50, $2)', [userId, 'NEW_REEL_PUBLISH']);

                res.status(201).json({ success: true, data: dbResult.rows[0] });
            } catch (publishError) {
                res.status(500).json({ success: false, message: publishError.message });
            }
        });

        this.app.get('/api/v1/reels/stream/:key', async (req, res) => {
            if (!this.driveEngine) return res.status(503).end();
            try {
                const fileStream = await this.driveEngine.files.get(
                    { fileId: req.params.key, alt: 'media' },
                    { responseType: 'stream' }
                );
                res.setHeader('Content-Type', fileStream.headers['content-type']);
                fileStream.data.on('error', () => res.status(404).end()).pipe(res);
            } catch (e) {
                res.status(404).end();
            }
        });

        this.app.get('/api/v1/reels/feed', async (req, res) => {
            try {
                const query = `
                    SELECT r.*, u.user_full_name as author_name, u.user_avatar_link as author_avatar
                    FROM reels r
                    JOIN users u ON r.author_user_id = u.user_identification
                    WHERE r.reel_is_active = TRUE
                    ORDER BY r.reel_created_at DESC LIMIT 50
                `;
                const result = await this.dbPool.query(query);
                res.status(200).json({ success: true, data: result.rows });
            } catch (e) {
                res.status(500).json({ success: false, message: 'Kernel Content Error: Feed unavailable.' });
            }
        });

        this.app.get('/api/v1/wallet/balance/:userId', async (req, res) => {
            try {
                const result = await this.dbPool.query('SELECT user_points_total FROM users WHERE user_identification = $1', [req.params.userId]);
                res.status(200).json({ success: true, balance: result.rows[0]?.user_points_total || 0 });
            } catch (e) {
                res.status(500).json({ success: false });
            }
        });

        this.app.patch('/api/v1/users/profile/update', async (req, res) => {
            const { userId, name, university, bio, phone } = req.body;
            try {
                const sql = `
                    UPDATE users 
                    SET user_full_name = COALESCE($1, user_full_name),
                        user_university_name = COALESCE($2, user_university_name),
                        user_biography_text = COALESCE($3, user_biography_text),
                        user_phone_number = COALESCE($4, user_phone_number),
                        user_updated_at = NOW()
                    WHERE user_identification = $5 RETURNING *
                `;
                const result = await this.dbPool.query(sql, [name, university, bio, phone, userId]);
                res.status(200).json({ success: true, data: result.rows[0] });
            } catch (e) {
                res.status(500).json({ success: false, message: 'Kernel Profile Error.' });
            }
        });

        this.app.get('/api/v1/system/heartbeat', (req, res) => {
            res.status(200).json({
                memory_usage: process.memoryUsage(),
                cpu_usage: os.loadavg(),
                system_platform: os.platform(),
                realtime_nodes: this.realtimeBus.sockets.size
            });
        });

        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                message: 'VlogStudents Gateway: Endpoint or path does not exist.',
                requested_url: req.originalUrl
            });
        });
    }

    initializeSystemMonitoring() {
        setInterval(() => {
            const memoryStats = process.memoryUsage();
            const cpuStats = os.loadavg();
            const rssMb = Math.round(memoryStats.rss / 1024 / 1024);
            const heapUsedMb = Math.round(memoryStats.heapUsed / 1024 / 1024);
            
            console.log(`HEARTBEAT: Memory RSS ${rssMb}MB | Heap ${heapUsedMb}MB | CPU ${cpuStats[0].toFixed(2)}`);
            
            if (rssMb > 470) {
                console.error('SYSTEM_CRITICAL_RESOURCES: High memory threshold breach. Cache cleaning required.');
            }
        }, 120000);

        setInterval(async () => {
            try {
                const client = await this.dbPool.connect();
                await client.query('SELECT 1');
                client.release();
            } catch (e) {
                console.error('DIAGNOSTIC_FAILURE: NeonDB link lost.');
            }
        }, 300000);
    }

    initializeProcessLifespan() {
        this.app.use((err, req, res, next) => {
            console.error('SYSTEM_GLOBAL_FAILURE:', err.stack);
            res.status(500).json({ 
                success: false, 
                message: 'Kernel exception occurred.', 
                trace_id: req.vlogTrace 
            });
        });

        process.on('uncaughtException', (fatalError) => {
            console.error('PROCESS_TERMINATION: Uncaught exception.', fatalError);
            this.handleGracefulShutdown('CRITICAL_EXCEPTION');
        });

        process.on('unhandledRejection', (promiseReason) => {
            console.error('PROCESS_TERMINATION: Unhandled promise rejection.', promiseReason);
        });

        process.on('SIGINT', () => this.handleGracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => this.handleGracefulShutdown('SIGTERM'));
    }

    async handleGracefulShutdown(signal) {
        console.log(`KERNEL_SHUTDOWN: Signal ${signal} detected. Draining resources...`);
        this.server.close(() => {
            console.log('KERNEL_SHUTDOWN: HTTP stack closed.');
            this.dbPool.end().then(() => {
                console.log('KERNEL_SHUTDOWN: Database pool released. Deployment complete.');
                process.exit(0);
            });
        });

        setTimeout(() => {
            console.error('KERNEL_SHUTDOWN: Forced exit due to timeout.');
            process.exit(1);
        }, 15000);
    }

    finalizeServerDeployment() {
        this.server.listen(this.appPort, () => {
            console.log(`+-----------------------------------------------------------+`);
            console.log(`| VLOGSTUDENTS ENTERPRISE KERNEL LIVE                       |`);
            console.log(`| DEPLOYMENT MODE: STABLE PRODUCTION                        |`);
            console.log(`| NETWORK PORT: ${this.appPort}                                        |`);
            console.log(`| DATABASE CLUSTER: NEON POSTGRESQL (SYNCED)                |`);
            console.log(`| REALTIME BUS: SOCKET.IO WSS ACTIVE                        |`);
            console.log(`| CORS PROTOCOL: UNIVERSAL PERMISSIVE                       |`);
            console.log(`| CLOUD INFRASTRUCTURE: GOOGLE DRIVE V3                     |`);
            console.log(`+-----------------------------------------------------------+`);
        });
    }
}

const masterKernel = new VlogStudentsEnterpriseKernel();

async function systemIntegrityJob() {
    try {
        const checkClient = await masterKernel.dbPool.connect();
        const res = await checkClient.query('SELECT COUNT(*) FROM users');
        checkClient.release();
        console.log(`AUDIT: Current user database size: ${res.rows[0].count} students.`);
    } catch (e) {
        console.error('AUDIT: Integrity check failed.');
    }
}

setTimeout(systemIntegrityJob, 20000);

async function cloudConnectivityAudit() {
    if (masterKernel.driveEngine) {
        try {
            await masterKernel.driveEngine.about.get({ fields: 'user' });
            console.log('AUDIT: Google Cloud link verified.');
        } catch (e) {
            console.error('AUDIT: Google Cloud link error.');
        }
    }
}

setTimeout(cloudConnectivityAudit, 30000);

process.on('warning', (warning) => {
    console.warn('KERNEL_WARNING:', warning.name, warning.message);
});

async function logSystemUptime() {
    console.log(`SYSTEM_TELEMETRY: Stable uptime ${Math.round(process.uptime())}s`);
}

setInterval(logSystemUptime, 600000);

// Fim do arquivo server.js Master Enterprise Full.
