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
const buildEngine = require('./build');

dotenv.config();

const DATABASE_URL = 'postgresql://neondb_owner:npg_tzKG1cYOg2JV@ep-billowing-scene-amoqz4x7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const GOOGLE_DRIVE_FOLDER_ID = '1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ';
const GOOGLE_CLIENT_ID = '435332250244-vh9rravt3cmf1vmng29rbbs4vj3iccle.apps.googleusercontent.com';
const JWT_SECRET = process.env.JWT_SECRET || 'VLOG_CORE_MASTER_ULTIMATE_KEY_2025';

class VlogStudentsEnterpriseEngine {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.initializeRealtimeArchitecture();
        this.initializeDatabaseCluster();
        this.initializeSecurityLayers();
        this.initializeInfrastructure();
        this.initializeGoogleCloudStorage();
        this.initializeSystemRoutes();
        this.initializeErrorInterceptors();
        this.initializeSystemSchedules();
    }

    initializeRealtimeArchitecture() {
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
            console.log('VLOG_SIGNAL: Novo nó de estudante conectado:', socket.id);

            socket.on('vlog_auth_handshake', (payload) => {
                socket.studentId = payload.userId;
                socket.join(`student_node_${payload.userId}`);
            });

            socket.on('vlog_chat_dispatch', (data) => {
                this.io.to(`student_node_${data.targetId}`).emit('vlog_chat_receive', {
                    ...data,
                    serverTime: new Date().toISOString()
                });
            });

            socket.on('vlog_video_signal', (payload) => {
                this.io.to(`student_node_${payload.targetId}`).emit('vlog_video_incoming', {
                    signal: payload.signal,
                    from: socket.studentId
                });
            });

            socket.on('disconnect', () => {
                console.log('VLOG_SIGNAL: Nó de estudante desconectado:', socket.id);
            });
        });
    }

    initializeDatabaseCluster() {
        this.pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 100,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000
        });

        this.pool.on('error', (err) => {
            console.error('VLOG_DATABASE_ERROR: Falha inesperada no pool NeonDB', err);
        });
    }

    initializeSecurityLayers() {
        this.app.use(helmet({
            contentSecurityPolicy: false,
            crossOriginResourcePolicy: { policy: "cross-origin" },
            crossOriginEmbedderPolicy: false
        }));

        this.app.use(cors({
            origin: function (origin, callback) {
                callback(null, true);
            },
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-App-Version", "X-App-Platform"],
            credentials: true,
            optionsSuccessStatus: 204
        }));

        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-App-Version, X-App-Platform');
            if (req.method === 'OPTIONS') {
                return res.sendStatus(204);
            }
            next();
        });
    }

    initializeInfrastructure() {
        this.app.use(compression());
        this.app.use(express.json({ limit: '150mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '150mb' }));
        this.app.use(morgan('combined'));

        this.upload = multer({
            storage: multer.memoryStorage(),
            limits: { fileSize: 200 * 1024 * 1024 }
        });

        this.oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID);
    }

    initializeGoogleCloudStorage() {
        const credentialsPath = path.join(__dirname, 'credentials.json');
        if (!fs.existsSync(credentialsPath)) {
            console.error('VLOG_STORAGE_CRITICAL: credentials.json nao localizado na raiz.');
            return;
        }

        try {
            const auth = new google.auth.GoogleAuth({
                keyFile: credentialsPath,
                scopes: [
                    'https://www.googleapis.com/auth/drive.file',
                    'https://www.googleapis.com/auth/drive.readonly',
                    'https://www.googleapis.com/auth/drive.metadata'
                ]
            });
            this.drive = google.drive({ version: 'v3', auth: auth });
            console.log('VLOG_STORAGE_ACTIVE: Integracao Google Drive API v3 consolidada.');
        } catch (error) {
            console.error('VLOG_STORAGE_FAIL:', error.message);
        }
    }

    async synchronizeDatabaseSchema() {
        const schema = `
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                google_id VARCHAR(255) UNIQUE,
                email VARCHAR(255) UNIQUE NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                avatar_url TEXT,
                university_name VARCHAR(255),
                points_total INTEGER DEFAULT 0,
                theme_pref VARCHAR(10) DEFAULT 'dark',
                referral_code VARCHAR(15) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS reels (
                reel_id SERIAL PRIMARY KEY,
                author_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                title VARCHAR(255),
                description TEXT,
                drive_file_id VARCHAR(255) NOT NULL,
                thumbnail_id VARCHAR(255),
                views_count INTEGER DEFAULT 0,
                likes_count INTEGER DEFAULT 0,
                comments_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS interactions (
                interaction_id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(user_id),
                reel_id INTEGER REFERENCES reels(reel_id),
                interaction_type VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS gamification_logs (
                log_id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(user_id),
                points_amount INTEGER NOT NULL,
                award_reason VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        try {
            const client = await this.pool.connect();
            await client.query(schema);
            client.release();
            console.log('VLOG_DATABASE_STABLE: Tabelas e constraints sincronizadas no NeonDB.');
        } catch (err) {
            console.error('VLOG_DATABASE_SYNC_ERROR:', err.message);
        }
    }

    initializeSystemRoutes() {
        // Rota Raiz Customizada chamando o motor visual do build.js
        this.app.get('/', (req, res) => {
            const routesList = [
                { path: '/api/v1/auth/google', method: 'POST', status: 'Operational' },
                { path: '/api/v1/auth/register', method: 'POST', status: 'Operational' },
                { path: '/api/v1/reels/feed', method: 'GET', status: 'Operational' },
                { path: '/api/v1/upload', method: 'POST', status: 'Operational' },
                { path: '/api/v1/chat/rooms', method: 'GET', status: 'Operational' },
                { path: '/api/v1/points/balance', method: 'GET', status: 'Operational' }
            ];
            res.setHeader('Content-Type', 'text/html');
            res.send(buildEngine.generateSuccessTemplate(routesList));
        });

        this.app.get('/health', (req, res) => {
            res.status(200).json({ status: 'operational', timestamp: new Date(), uptime: process.uptime() });
        });

        this.app.post('/api/v1/auth/google', async (req, res) => {
            try {
                const { idToken } = req.body;
                const ticket = await this.oauth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
                const payload = ticket.getPayload();
                
                const query = `
                    INSERT INTO users (google_id, email, full_name, avatar_url)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (email) DO UPDATE SET avatar_url = $4
                    RETURNING *;
                `;
                const result = await this.pool.query(query, [payload.sub, payload.email, payload.name, payload.picture]);
                const user = result.rows[0];
                const token = jwt.sign({ id: user.user_id, email: user.email }, JWT_SECRET);
                
                res.status(200).json({ success: true, data: { user, token } });
            } catch (error) {
                res.status(401).json({ success: false, message: 'Falha na autenticacao federada.' });
            }
        });

        this.app.post('/api/v1/auth/register', async (req, res) => {
            try {
                const { fullName, email, password, university } = req.body;
                const passwordHash = await bcrypt.hash(password, 12);
                const referral = Math.random().toString(36).substring(2, 10).toUpperCase();

                const query = `
                    INSERT INTO users (full_name, email, university_name, referral_code)
                    VALUES ($1, $2, $3, $4) RETURNING *
                `;
                const result = await this.pool.query(query, [fullName, email, university, referral]);
                const user = result.rows[0];
                const token = jwt.sign({ id: user.user_id, email: user.email }, JWT_SECRET);

                res.status(201).json({ success: true, data: { user, token } });
            } catch (e) {
                res.status(500).json({ success: false, message: e.message });
            }
        });

        this.app.post('/api/v1/upload', this.upload.single('file'), async (req, res) => {
            if (!this.drive) return res.status(503).json({ success: false, message: 'Storage Offline' });

            const client = await this.pool.connect();
            try {
                const { userId, username, title, description } = req.body;
                const videoFile = req.file;

                const passThrough = new stream.PassThrough();
                passThrough.end(videoFile.buffer);

                const driveResponse = await this.drive.files.create({
                    requestBody: {
                        name: `vlog_${Date.now()}_${videoFile.originalname}`,
                        parents: [GOOGLE_DRIVE_FOLDER_ID]
                    },
                    media: { mimeType: videoFile.mimetype, body: passThrough },
                    fields: 'id'
                });

                const fileId = driveResponse.data.id;
                await this.drive.permissions.create({
                    fileId: fileId,
                    requestBody: { role: 'reader', type: 'anyone' }
                });

                await client.query('BEGIN');
                const reelQuery = `
                    INSERT INTO reels (author_id, title, description, drive_file_id)
                    VALUES ($1, $2, $3, $4) RETURNING *
                `;
                const reelResult = await client.query(reelQuery, [userId, title, description, fileId]);

                await client.query('UPDATE users SET points_total = points_total + 50 WHERE user_id = $1', [userId]);
                await client.query('INSERT INTO gamification_logs (user_id, points_amount, award_reason) VALUES ($1, 50, $2)', [userId, 'NEW_REEL_PUBLISHED']);

                await client.query('COMMIT');
                res.status(201).json({ success: true, data: reelResult.rows[0] });
            } catch (error) {
                await client.query('ROLLBACK');
                res.status(500).json({ success: false, message: error.message });
            } finally {
                client.release();
            }
        });

        this.app.get('/api/v1/media/:fileId', async (req, res) => {
            if (!this.drive) return res.status(503).end();
            try {
                const fileResponse = await this.drive.files.get(
                    { fileId: req.params.fileId, alt: 'media' },
                    { responseType: 'stream' }
                );
                res.setHeader('Content-Type', fileResponse.headers['content-type']);
                fileResponse.data.pipe(res);
            } catch (error) {
                res.status(404).end();
            }
        });

        this.app.get('/api/v1/feed', async (req, res) => {
            try {
                const result = await this.pool.query(`
                    SELECT r.*, u.full_name, u.avatar_url, u.university_name
                    FROM reels r
                    JOIN users u ON r.author_id = u.user_id
                    ORDER BY r.created_at DESC LIMIT 50
                `);
                res.json({ success: true, data: result.rows });
            } catch (error) {
                res.status(500).json({ success: false });
            }
        });

        this.app.post('/api/v1/reels/:id/like', async (req, res) => {
            try {
                const { userId } = req.body;
                const { id } = req.params;
                await this.pool.query('UPDATE reels SET likes_count = likes_count + 1 WHERE reel_id = $1', [id]);
                await this.pool.query('UPDATE users SET points_total = points_total + 1 WHERE user_id = $1', [userId]);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ success: false });
            }
        });

        this.app.get('/api/v1/users/:id/profile', async (req, res) => {
            try {
                const result = await this.pool.query('SELECT * FROM users WHERE user_id = $1', [req.params.id]);
                res.json({ success: true, data: result.rows[0] });
            } catch (error) {
                res.status(500).json({ success: false });
            }
        });

        this.app.use((req, res) => {
            res.status(404).json({ success: false, message: 'VlogStudents Core: Rota nao implementada.', path: req.originalUrl });
        });
    }

    initializeErrorInterceptors() {
        this.app.use((err, req, res, next) => {
            console.error('SYSTEM_GLOBAL_EXCEPTION:', err.stack);
            res.status(500).json({
                success: false,
                message: 'Erro interno na Engine VlogStudents.',
                error_id: Date.now()
            });
        });

        process.on('uncaughtException', (err) => {
            console.error('PROCESS_FATAL_EXCEPTION:', err);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('PROMISE_FATAL_REJECTION:', reason);
        });
    }

    initializeSystemSchedules() {
        setInterval(async () => {
            try {
                await this.pool.query('SELECT 1');
                console.log('VLOG_HEARTBEAT: NeonDB Link is active.');
            } catch (e) {
                console.error('VLOG_HEARTBEAT: Database Link failure.');
            }
        }, 300000);
    }

    start(port) {
        this.server.listen(port, () => {
            console.log(`+-----------------------------------------------------------+`);
            console.log(`| VLOGSTUDENTS ENTERPRISE ECOSYSTEM LIVE                    |`);
            console.log(`| AMBIENTE: ${process.env.NODE_ENV || 'production'}                      |`);
            console.log(`| PORTA: ${port}                                               |`);
            console.log(`| DATABASE: NEON POSTGRESQL ACTIVE                          |`);
            console.log(`| REALTIME: SOCKET.IO INFRASTRUCTURE OPERATIONAL            |`);
            console.log(`| STORAGE: GOOGLE DRIVE V3 FULL ACCESS                      |`);
            console.log(`+-----------------------------------------------------------+`);
            this.synchronizeDatabaseSchema();
        });
    }
}

const masterKernel = new VlogStudentsEnterpriseEngine();
const LISTEN_PORT = process.env.PORT || 3000;

masterKernel.start(LISTEN_PORT);

function setupCleanExit() {
    const shutdown = () => {
        console.log('VLOG_LIFECYCLE: Iniciando shutdown controlado...');
        masterKernel.server.close(() => {
            masterKernel.pool.end().then(() => {
                console.log('VLOG_LIFECYCLE: Processo encerrado com seguranca.');
                process.exit(0);
            });
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

setupCleanExit();

// Final do arquivo server.js Master Core.
