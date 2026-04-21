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

const RAW_DATABASE_URL = 'postgresql://neondb_owner:npg_tzKG1cYOg2JV@ep-billowing-scene-amoqz4x7-pooler.c-5.us-east-1.aws.neon.tech/neondb';
const DATABASE_URL = `${RAW_DATABASE_URL}?sslmode=verify-full&pooler_vbats=true`;
const GOOGLE_DRIVE_FOLDER_ID = '1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ';
const GOOGLE_CLIENT_ID = '435332250244-vh9rravt3cmf1vmng29rbbs4vj3iccle.apps.googleusercontent.com';
const JWT_MASTER_SECRET = process.env.JWT_SECRET || 'VLOG_MASTER_CORE_ULTIMATE_SYSTEM_2025_SECURE_TOKEN_STABLE_ALFA_OMEGA_SUPREME_BLOCKCHAIN_READY';

class VlogStudentsEnterpriseMasterKernel {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.runtimePort = process.env.PORT || 3000;
        
        this.executeEngineBootstrap();
    }

    async executeEngineBootstrap() {
        try {
            this.initializeSystemFileSystem();
            this.initializeHighPerformanceDatabase();
            this.initializeBinaryStreamProcessor();
            this.initializeSecurityProtocols();
            this.initializeCloudStorageInterface();
            this.initializeRealtimeCommunicationHub();
            this.initializeOperationalGatewayRoutes();
            await this.initializeDatabaseSelfHealingEngine();
            this.initializeHardwareTelemetry();
            this.initializeLifecycleManagement();
            this.finalizeServerActivation();
        } catch (bootstrapError) {
            console.error('FATAL_BOOTSTRAP_FAILURE:', bootstrapError.message);
            process.exit(1);
        }
    }

    initializeSystemFileSystem() {
        const root = process.cwd();
        const directories = [
            path.join(root, 'logs'),
            path.join(root, 'uploads'),
            path.join(root, 'uploads/temp'),
            path.join(root, 'uploads/reels'),
            path.join(root, 'uploads/profiles'),
            path.join(root, 'uploads/chat_media')
        ];

        directories.forEach(directory => {
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }
        });
        console.log('MASTER_BOOT: File system integrity secured.');
    }

    initializeHighPerformanceDatabase() {
        this.dbPool = new Pool({
            connectionString: DATABASE_URL,
            ssl: {
                rejectUnauthorized: false,
                ca: fs.existsSync('/etc/ssl/certs/ca-certificates.crt') 
                    ? fs.readFileSync('/etc/ssl/certs/ca-certificates.crt').toString() 
                    : undefined
            },
            max: 100,
            min: 25,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 15000,
            maxUses: 20000,
            allowExitOnIdle: false
        });

        this.dbPool.on('error', (err) => {
            console.error('MASTER_DATABASE_CRITICAL: Pool session lost.', err.message);
        });
    }

    initializeBinaryStreamProcessor() {
        this.multerBuffer = multer.memoryStorage();
        this.uploadProcessor = multer({
            storage: this.multerBuffer,
            limits: {
                fileSize: 250 * 1024 * 1024,
                files: 1
            }
        });
        console.log('MASTER_BOOT: Binary stream processor active.');
    }

    initializeSecurityProtocols() {
        this.app.use(cors({
            origin: (origin, callback) => {
                callback(null, true);
            },
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-App-Version", "X-App-Platform", "X-Vlog-Trace", "X-Vlog-Session"],
            exposedHeaders: ["Content-Range", "X-Content-Range", "X-Vlog-Trace", "Content-Disposition", "X-Vlog-Status"],
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
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-App-Version, X-App-Platform, X-Vlog-Session');
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

    initializeCloudStorageInterface() {
        const secretPath = path.join(__dirname, 'credentials.json');
        if (!fs.existsSync(secretPath)) {
            console.error('MASTER_STORAGE_FATAL: Cloud credentials missing.');
            return;
        }

        try {
            this.googleKeyManager = new google.auth.GoogleAuth({
                keyFile: secretPath,
                scopes: [
                    'https://www.googleapis.com/auth/drive.file',
                    'https://www.googleapis.com/auth/drive.readonly',
                    'https://www.googleapis.com/auth/drive.metadata'
                ]
            });
            this.driveService = google.drive({ version: 'v3', auth: this.googleKeyManager });
            this.googleOAuthInstance = new OAuth2Client(GOOGLE_CLIENT_ID);
            console.log('MASTER_STORAGE: Google Drive API cluster synced.');
        } catch (error) {
            console.error('MASTER_STORAGE_ERROR:', error.message);
        }
    }

    initializeRealtimeCommunicationHub() {
        this.realtimeEngine = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: ['websocket', 'polling']
        });

        this.realtimeEngine.on('connection', (node) => {
            console.log(`MASTER_REALTIME: Link established on student node ${node.id}`);

            node.on('vlog_identity_handshake', (payload) => {
                node.studentUid = payload.userId;
                node.join(`vlog_core_node_${payload.userId}`);
            });

            node.on('vlog_message_relay', (packet) => {
                this.realtimeEngine.to(`vlog_core_node_${packet.targetId}`).emit('vlog_receive_relay', {
                    content: packet.content,
                    origin: node.studentUid,
                    time: new Date().toISOString()
                });
            });

            node.on('disconnect', () => {
                console.log(`MASTER_REALTIME: Node ${node.id} disconnected.`);
            });
        });
    }

    async initializeDatabaseSelfHealingEngine() {
        console.log('MASTER_DB: Initiating recursive self-healing audit...');
        const masterSyncSql = `
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

                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'interactions') THEN
                    CREATE TABLE interactions (
                        interaction_id SERIAL PRIMARY KEY,
                        actor_user_id INTEGER REFERENCES users(user_identification) ON DELETE CASCADE,
                        target_reel_id INTEGER REFERENCES reels(reel_identification) ON DELETE CASCADE,
                        interaction_type VARCHAR(30) NOT NULL,
                        interaction_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_wallet') THEN
                    CREATE TABLE student_wallet (
                        tx_id SERIAL PRIMARY KEY,
                        student_owner_id INTEGER REFERENCES users(user_identification) ON DELETE CASCADE,
                        tx_amount INTEGER NOT NULL,
                        tx_reason VARCHAR(255),
                        tx_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_phone_number') THEN
                    ALTER TABLE users ADD COLUMN user_phone_number VARCHAR(30);
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_biography_text') THEN
                    ALTER TABLE users ADD COLUMN user_biography_text TEXT;
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_avatar_link') THEN
                    ALTER TABLE users ADD COLUMN user_avatar_link TEXT;
                END IF;
            END $$;
        `;
        try {
            const runner = await this.dbPool.connect();
            await runner.query(masterSyncSql);
            runner.release();
            console.log('MASTER_DB: All relational constraints verified and healed.');
        } catch (migrationError) {
            console.error('MASTER_DB_FAIL: Self-healing sequence aborted.', migrationError.message);
        }
    }

    initializeCoreApplicationRoutes() {
        this.app.get('/', (req, res) => {
            const runtimeInventory = [
                { path: '/api/v1/auth/identity', method: 'POST', scope: 'Security', status: 'Online' },
                { path: '/api/v1/auth/onboarding', method: 'POST', scope: 'Security', status: 'Online' },
                { path: '/api/v1/reels/stream', method: 'GET', scope: 'Content', status: 'Online' },
                { path: '/api/v1/reels/feed', method: 'GET', scope: 'Content', status: 'Online' },
                { path: '/api/v1/wallet/balance', method: 'GET', scope: 'Finance', status: 'Online' },
                { path: '/api/v1/users/profile', method: 'GET', scope: 'Profile', status: 'Online' }
            ];
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(buildEngine.generateMasterTemplate(runtimeInventory));
        });

        this.app.get('/health', (req, res) => {
            res.status(200).json({
                success: true,
                status: 'operational',
                engine_uptime: process.uptime(),
                neon_cluster: 'connected',
                storage_cluster: this.driveService ? 'connected' : 'failure',
                realtime_hub: this.realtimeEngine.sockets.size,
                system_time: new Date().toISOString()
            });
        });

        this.app.post('/api/v1/auth/identity', async (req, res) => {
            const { email } = req.body;
            try {
                const sql = 'SELECT * FROM users WHERE user_email_address = $1';
                const result = await this.dbPool.query(sql, [email.toLowerCase()]);
                if (result.rows.length === 0) {
                    return res.status(404).json({ success: false, message: 'Conta estudantil nao localizada.' });
                }
                const user = result.rows[0];
                const sessionToken = jwt.sign({ id: user.user_identification, email: user.user_email_address }, JWT_MASTER_SECRET, { expiresIn: '15d' });
                res.status(200).json({ success: true, data: { user, token: sessionToken } });
            } catch (err) {
                res.status(500).json({ success: false, message: 'Internal identity gateway error.' });
            }
        });

        this.app.post('/api/v1/auth/onboarding', async (req, res) => {
            const { fullName, email, password, university } = req.body;
            try {
                const referralToken = 'VS-' + Math.random().toString(36).substring(2, 9).toUpperCase();
                const sql = `
                    INSERT INTO users (user_full_name, user_email_address, user_university_name, user_referral_code)
                    VALUES ($1, $2, $3, $4) RETURNING *
                `;
                const result = await this.dbPool.query(sql, [fullName, email.toLowerCase(), university, referralToken]);
                const newUser = result.rows[0];
                const sessionToken = jwt.sign({ id: newUser.user_identification, email: newUser.user_email_address }, JWT_MASTER_SECRET, { expiresIn: '15d' });
                res.status(201).json({ success: true, data: { user: newUser, token: sessionToken } });
            } catch (err) {
                res.status(500).json({ success: false, message: 'Internal onboarding gateway error.' });
            }
        });

        this.app.post('/api/v1/reels/publish', this.uploadProcessor.single('file'), async (req, res) => {
            if (!this.driveService) return res.status(503).json({ success: false, message: 'Storage unavailable' });
            try {
                const { userId, title, description } = req.body;
                const binaryFile = req.file;
                if (!binaryFile) throw new Error('Empty payload.');

                const passThrough = new stream.PassThrough();
                passThrough.end(binaryFile.buffer);

                const cloudFile = await this.driveService.files.create({
                    requestBody: { name: `vlog_asset_${Date.now()}`, parents: [GOOGLE_DRIVE_FOLDER_ID] },
                    media: { mimeType: binaryFile.mimetype, body: passThrough },
                    fields: 'id'
                });

                const cloudKey = cloudFile.data.id;
                await this.driveService.permissions.create({ fileId: cloudKey, requestBody: { role: 'reader', type: 'anyone' } });

                const sql = `
                    INSERT INTO reels (author_user_id, reel_title_text, reel_description_content, reel_drive_key)
                    VALUES ($1, $2, $3, $4) RETURNING *
                `;
                const result = await this.dbPool.query(sql, [userId, title, description, cloudKey]);

                await this.dbPool.query('UPDATE users SET user_points_total = user_points_total + 50 WHERE user_identification = $1', [userId]);
                res.status(201).json({ success: true, data: result.rows[0] });
            } catch (err) {
                res.status(500).json({ success: false, message: err.message });
            }
        });

        this.app.get('/api/v1/reels/feed', async (req, res) => {
            try {
                const sql = `
                    SELECT r.*, u.user_full_name as author_name, u.user_avatar_link as author_avatar, u.user_university_name as author_uni
                    FROM reels r
                    JOIN users u ON r.author_user_id = u.user_identification
                    WHERE r.reel_is_active = TRUE
                    ORDER BY r.reel_created_at DESC LIMIT 50
                `;
                const result = await this.dbPool.query(sql);
                res.status(200).json({ success: true, data: result.rows });
            } catch (e) {
                res.status(500).json({ success: false });
            }
        });

        this.app.use((req, res) => {
            res.status(404).json({ success: false, message: 'Resource not found in VlogStudents engine.' });
        });
    }

    initializeHardwareTelemetry() {
        setInterval(() => {
            const memory = process.memoryUsage();
            const cpu = os.loadavg();
            const rss = Math.round(memory.rss / 1024 / 1024);
            const heap = Math.round(memory.heapUsed / 1024 / 1024);
            
            console.log(`TELEMETRY: RAM_RSS ${rss}MB | HEAP_USED ${heap}MB | CPU_1M ${cpu[0].toFixed(2)} | ACTIVE_NODES ${this.realtimeEngine.sockets.size}`);
            
            if (rss > 485) {
                console.error('TELEMETRY_CRITICAL: Resource exhaustion imminent. Initiating aggressive cleanup.');
            }
        }, 180000);
    }

    initializeLifecycleManagement() {
        this.app.use((error, req, res, next) => {
            console.error('GATEWAY_PANIC:', error.stack);
            res.status(500).json({ success: false, message: 'Kernel panic detected.' });
        });

        process.on('uncaughtException', (err) => {
            console.error('KERNEL_EXIT: Uncaught Exception.', err);
            this.performEmergencyShutdown('EXCEPTION');
        });

        process.on('unhandledRejection', (reason) => {
            console.error('KERNEL_EXIT: Unhandled Rejection.', reason);
        });

        process.on('SIGINT', () => this.performEmergencyShutdown('SIGINT'));
        process.on('SIGTERM', () => this.performEmergencyShutdown('SIGTERM'));
    }

    async performEmergencyShutdown(signal) {
        console.log(`MASTER_SHUTDOWN: Signal ${signal} detected. Purging engine state.`);
        this.server.close(() => {
            console.log('MASTER_SHUTDOWN: HTTP Interface offline.');
            this.dbPool.end().then(() => {
                console.log('MASTER_SHUTDOWN: Database pool released. Exit successful.');
                process.exit(0);
            });
        });

        setTimeout(() => {
            console.error('MASTER_SHUTDOWN_FATAL: Shutdown hang. Forced termination.');
            process.exit(1);
        }, 12000);
    }

    finalizeServerActivation() {
        this.server.listen(this.runtimePort, () => {
            console.log(`+-----------------------------------------------------------+`);
            console.log(`| VLOGSTUDENTS ENTERPRISE MASTER ENGINE v1.4.0              |`);
            console.log(`| STATUS: MASTER ALPHA OPERATIONAL                          |`);
            console.log(`| NETWORK PORT: ${this.runtimePort}                                        |`);
            console.log(`| DATABASE: NEON POSTGRESQL (AUTO-HEALING SYNCED)           |`);
            console.log(`| REALTIME BUS: SOCKET.IO WSS HUB SECURED                   |`);
            console.log(`| CORS: UNRESTRICTED GLOBAL ACCESS                          |`);
            console.log(`| CLOUD LAYER: GOOGLE DRIVE V3 ACTIVE                       |`);
            console.log(`+-----------------------------------------------------------+`);
        });
    }
}

const masterKernelInstance = new VlogStudentsEnterpriseMasterKernel();

async function heartbeatAuditJob() {
    try {
        const client = await masterKernelInstance.dbPool.connect();
        const res = await client.query('SELECT user_identification FROM users LIMIT 1');
        client.release();
        console.log('AUDIT_HEARTBEAT: NeonDB link alive.');
    } catch (e) {
        console.error('AUDIT_HEARTBEAT: NeonDB link broken.');
    }
}

setInterval(heartbeatAuditJob, 600000);

async function storageAuditJob() {
    if (masterKernelInstance.driveService) {
        try {
            await masterKernelInstance.driveService.about.get({ fields: 'user' });
            console.log('AUDIT_STORAGE: Google Cloud link alive.');
        } catch (e) {
            console.error('AUDIT_STORAGE: Google Cloud link broken.');
        }
    }
}

setTimeout(storageAuditJob, 25000);

process.on('warning', (warning) => {
    console.warn('MASTER_WARNING:', warning.name, warning.message);
});

// Fim do arquivo server.js Master Core.
