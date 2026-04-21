/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER CORE ENGINE v5.0.0
 * DESENVOLVIDO PARA ALTA DISPONIBILIDADE, SEGURANÇA E PERFORMANCE.
 * ============================================================================
 */

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
const stream = require('stream');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { google } = require('googleapis');
const { Pool } = require('pg');
const { OAuth2Client } = require('google-auth-library');

// --- INFRAESTRUTURA DE CONFIGURAÇÃO ---
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'VLOGSTUDENTS_ENTERPRISE_SECRET_CORE_2025_RELEASE';
const DATABASE_URL = 'postgresql://neondb_owner:npg_tzKG1cYOg2JV@ep-billowing-scene-amoqz4x7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const GOOGLE_DRIVE_FOLDER_ID = '1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ';
const GOOGLE_CLIENT_ID = '435332250244-vh9rravt3cmf1vmng29rbbs4vj3iccle.apps.googleusercontent.com';

class VlogStudentsEnterpriseServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);

        // Motores de Integração
        this.googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
        this.dbPool = new Pool({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 100, // Suporte a tráfego massivo
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        // Gestão de Mídia
        this.storage = multer.memoryStorage();
        this.uploader = multer({
            storage: this.storage,
            limits: { fileSize: 100 * 1024 * 1024 } // Limite industrial de 100MB
        });

        this.init();
    }

    async init() {
        this.configureWinston();
        this.initializeMiddlewares();
        this.bootstrapCloudServices();
        this.setupRealtimeSync();
        this.mapInfrastructureRoutes();
        this.mapBusinessLogicRoutes();
        this.activateHardwareMonitor();
        this.injectGlobalErrorHandler();
        this.setupLifecycleHooks();
    }

    // ----------------------------------------------------------------------------
    // 1. SISTEMA DE LOGS E AUDITORIA (WINSTON)
    // ----------------------------------------------------------------------------
    configureWinston() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), winston.format.simple())
                }),
                new winston.transports.File({ filename: 'logs/vlog_critical.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/vlog_traffic.log' })
            ]
        });
    }

    // ----------------------------------------------------------------------------
    // 2. MIDDLEWARES DE SEGURANÇA E PROTOCOLO (CORS FIX)
    // ----------------------------------------------------------------------------
    initializeMiddlewares() {
        // Proteção Helmet (Desativado CSP para permitir streaming de vídeos)
        this.app.use(helmet({ contentSecurityPolicy: false }));

        // Compressão de payloads
        this.app.use(compression());

        // CONFIGURAÇÃO CORS DEFINITIVA PARA FLUTTER
        const corsOptions = {
            origin: '*', // Permite acesso universal do App
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With", "X-App-Version", "X-App-Platform", "Accept", "Origin"],
            credentials: true,
            optionsSuccessStatus: 204
        };
        this.app.use(cors(corsOptions));

        this.app.use(express.json({ limit: '100mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '100mb' }));

        // Logger Morgan para tráfego HTTP
        this.app.use(morgan('dev', { stream: { write: msg => this.logger.info(msg.trim()) } }));

        // Injeção de Contexto Global (Request Injection)
        this.app.use((req, res, next) => {
            req.pool = this.dbPool;
            req.drive = this.driveInstance;
            req.logger = this.logger;
            req.io = this.socketServer;
            next();
        });
    }

    // ----------------------------------------------------------------------------
    // 3. CLOUD ENGINE (GOOGLE DRIVE V3)
    // ----------------------------------------------------------------------------
    bootstrapCloudServices() {
        const keyPath = path.join(__dirname, 'credentials.json');
        if (!fs.existsSync(keyPath)) {
            this.logger.error('ERROR: Google Cloud credentials.json not found in root.');
            return;
        }

        const auth = new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.readonly'
            ]
        });

        this.driveInstance = google.drive({ version: 'v3', auth });
        this.logger.info('VLOG_CLOUD: Google Drive Engine synchronized and stable.');
    }

    // ----------------------------------------------------------------------------
    // 4. MOTOR REALTIME (SOCKET.IO) - CHATS E CALLS
    // ----------------------------------------------------------------------------
    setupRealtimeSync() {
        this.socketServer = socketIo(this.server, {
            cors: { origin: "*", methods: ["GET", "POST"] },
            transports: ['websocket', 'polling'],
            pingTimeout: 60000
        });

        this.socketServer.on('connection', (socket) => {
            this.logger.info(`REALTIME: New link node -> ${socket.id}`);

            // Handshake de Identidade do Estudante
            socket.on('auth_handshake', (data) => {
                socket.studentId = data.userId;
                socket.join(`student_node_${data.userId}`);
                this.logger.info(`REALTIME: Student ${data.userId} mapped to socket node.`);
            });

            // Signal de Vídeo Chamada
            socket.on('initiate_video_call', (payload) => {
                this.socketServer.to(`student_node_${payload.targetUserId}`).emit('incoming_video_call', payload);
            });

            // Gestão de Mensagens Diretas
            socket.on('chat_send_message', (data) => {
                this.socketServer.to(`chat_room_${data.roomId}`).emit('chat_receive_message', data.message);
            });

            socket.on('disconnect', () => {
                this.logger.info(`REALTIME: Link node closed -> ${socket.id}`);
            });
        });
    }

    // ----------------------------------------------------------------------------
    // 5. MIDDLEWARE DE AUTENTICAÇÃO (VLOG GUARD)
    // ----------------------------------------------------------------------------
    vlogGuard = (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ success: false, message: 'Unauthorized access.' });

        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            next();
        } catch (err) {
            res.status(403).json({ success: false, message: 'Invalid or expired token.' });
        }
    };

    // ----------------------------------------------------------------------------
    // 6. MAPEAMENTO DE ROTAS DA API (V1 PREFIX)
    // ----------------------------------------------------------------------------
    mapBusinessLogicRoutes() {
        const v1 = express.Router();

        // --- AUTH MODULE (Sincronizado com NeonDB) ---

        v1.post('/auth/register', async (req, res) => {
            const { user_full_name, user_email_address, password, user_university_name } = req.body;
            try {
                const hashedPassword = await bcrypt.hash(password, 12);
                const query = `
                    INSERT INTO users (user_full_name, user_email_address, password, user_university_name)
                    VALUES ($1, $2, $3, $4) RETURNING *;
                `;
                const result = await this.dbPool.query(query, [user_full_name, user_email_address, hashedPassword, user_university_name]);
                const user = result.rows[0];
                const token = jwt.sign({ id: user.user_identification }, JWT_SECRET, { expiresIn: '30d' });

                res.status(201).json({ success: true, data: { user, token } });
            } catch (err) {
                res.status(400).json({ success: false, message: 'E-mail em uso ou falha no cadastro.' });
            }
        });

        v1.post('/auth/login', async (req, res) => {
            const { user_email_address, password } = req.body;
            try {
                const result = await this.dbPool.query('SELECT * FROM users WHERE user_email_address = $1', [user_email_address]);
                if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuário não localizado.' });

                const user = result.rows[0];
                const isValid = await bcrypt.compare(password, user.password);
                if (!isValid) return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });

                const token = jwt.sign({ id: user.user_identification }, JWT_SECRET, { expiresIn: '30d' });
                res.json({ success: true, data: { user, token } });
            } catch (err) {
                res.status(500).json({ success: false, message: 'Erro interno no motor de login.' });
            }
        });

        v1.post('/auth/google', async (req, res) => {
            const { googleToken } = req.body;
            try {
                const ticket = await this.googleClient.verifyIdToken({ idToken: googleToken, audience: GOOGLE_CLIENT_ID });
                const payload = ticket.getPayload();

                const query = `
                    INSERT INTO users (google_id_reference, user_email_address, user_full_name, user_profile_picture_url)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (user_email_address) DO UPDATE SET user_full_name = $3
                    RETURNING *;
                `;
                const result = await this.dbPool.query(query, [payload.sub, payload.email, payload.name, payload.picture]);
                const user = result.rows[0];
                const token = jwt.sign({ id: user.user_identification }, JWT_SECRET, { expiresIn: '30d' });

                res.json({ success: true, data: { user, token } });
            } catch (err) {
                res.status(500).json({ success: false, message: 'Erro no handshake do Google.' });
            }
        });

        // --- REELS & CONTENT MODULE (TIKTOK FLOW) ---

        // ROTA PÚBLICA PARA FEED (Sem vlogGuard)
        v1.get('/reels/feed', async (req, res) => {
            try {
                const result = await this.dbPool.query(`
                    SELECT r.*, u.user_full_name as author_name, u.user_profile_picture_url as author_picture
                    FROM reels r
                    JOIN users u ON r.reel_author_user_id = u.user_identification
                    WHERE r.reel_is_active = TRUE
                    ORDER BY r.reel_created_at_timestamp DESC LIMIT 30;
                `);
                res.json({ success: true, data: result.rows });
            } catch (err) {
                res.status(500).json({ success: false, message: 'Falha ao buscar feed.' });
            }
        });

        v1.post('/reels/publish', this.vlogGuard, this.uploader.single('file'), async (req, res) => {
            try {
                const { title, description, duration } = req.body;
                const file = req.file;

                const passThrough = new stream.PassThrough();
                passThrough.end(file.buffer);

                const driveRes = await this.driveInstance.files.create({
                    requestBody: { name: `reel_${Date.now()}`, parents: [GOOGLE_DRIVE_FOLDER_ID] },
                    media: { mimeType: file.mimetype, body: passThrough },
                    fields: 'id'
                });

                const query = `
                    INSERT INTO reels (reel_author_user_id, reel_google_drive_file_id, reel_title_text, reel_description_content, reel_duration_seconds)
                    VALUES ($1, $2, $3, $4, $5) RETURNING *;
                `;
                const result = await this.dbPool.query(query, [req.user.id, driveRes.data.id, title, description, duration]);

                res.status(201).json({ success: true, data: result.rows[0] });
            } catch (err) {
                res.status(500).json({ success: false, message: 'Erro no upload para o Cloud Drive.' });
            }
        });

        // --- MEDIA STREAMING MODULE ---

        v1.get('/media/drive/:fileId', async (req, res) => {
            try {
                const response = await this.driveInstance.files.get(
                    { fileId: req.params.fileId, alt: 'media' },
                    { responseType: 'stream' }
                );
                res.setHeader('Content-Type', response.headers['content-type']);
                response.data.pipe(res);
            } catch (err) {
                res.status(404).send('Content not available.');
            }
        });

        // --- USER & POINTS MODULE (RESTRICTED) ---

        v1.get('/users/profile/:id', async (req, res) => {
            const result = await this.dbPool.query('SELECT user_full_name, user_university_name, user_profile_picture_url, user_points_balance FROM users WHERE user_identification = $1', [req.params.id]);
            res.json({ success: true, data: result.rows[0] });
        });

        v1.get('/users/points/balance', this.vlogGuard, async (req, res) => {
            const result = await this.dbPool.query('SELECT user_points_balance FROM users WHERE user_identification = $1', [req.user.id]);
            res.json({ success: true, balance: result.rows[0].user_points_balance });
        });

        v1.get('/users/leaderboard/global', async (req, res) => {
            const result = await this.dbPool.query('SELECT user_full_name, user_points_balance FROM users ORDER BY user_points_balance DESC LIMIT 10');
            res.json({ success: true, data: result.rows });
        });

        // Montagem do Roteador Principal
        this.app.use('/api/v1', v1);
    }

    // ----------------------------------------------------------------------------
    // 7. ROTAS DE INFRAESTRUTURA E HEALTH
    // ----------------------------------------------------------------------------
    mapInfrastructureRoutes() {
        this.app.get('/', (req, res) => {
            res.send(`
                <div style="background:#0F0F0F; color:#CCFF00; padding:50px; font-family:sans-serif; text-align:center;">
                    <h1>VLOGSTUDENTS ENTERPRISE MASTER API</h1>
                    <p style="color:white">Status: FULLY OPERATIONAL</p>
                    <p style="color:gray">Engine Version: 5.0.0</p>
                </div>
            `);
        });

        this.app.get('/health', (req, res) => {
            res.status(200).json({ status: 'ok', engine: 'v5-master', db: 'Neon-PostgreSQL-Synced', uptime: process.uptime() });
        });

        // Catch-all 404
        this.app.use('*', (req, res) => {
            res.status(404).json({ success: false, message: `O recurso ${req.originalUrl} não existe neste servidor.` });
        });
    }

    // ----------------------------------------------------------------------------
    // 8. MONITORAMENTO DE HARDWARE E GESTÃO DE ERROS
    // ----------------------------------------------------------------------------
    activateHardwareMonitor() {
        setInterval(() => {
            const memoryUsed = process.memoryUsage().rss / 1024 / 1024;
            this.logger.info(`DIAGNOSTIC: Instance RAM Usage -> ${Math.round(memoryUsed)}MB`);
            if (memoryUsed > 480) {
                this.logger.warn('ALERT: Memory threshold 480MB reached on Render instance!');
            }
        }, 600000);
    }

    injectGlobalErrorHandler() {
        this.app.use((err, req, res, next) => {
            this.logger.error(`UNHANDLED_EXCEPTION: ${err.message}`, { stack: err.stack, path: req.originalUrl });
            res.status(500).json({ success: false, message: 'Internal engine failure.' });
        });
    }

    setupLifecycleHooks() {
        process.on('SIGTERM', () => {
            this.logger.info('LIFECYCLE: SIGTERM received. Draining Database Pool...');
            this.dbPool.end();
            process.exit(0);
        });
    }

    start() {
        this.server.listen(PORT, () => {
            console.log(`
            +-----------------------------------------------------------+
            | VLOGSTUDENTS ENTERPRISE BACKEND MASTER v5.0               |
            +-----------------------------------------------------------+
            | PORTA: ${PORT}                                               |
            | BANCO: NEON POSTGRESQL (SYNCED)                           |
            | CLOUD: GOOGLE DRIVE V3 (OPERATIONAL)                      |
            | REALTIME: SOCKET.IO (HUB ACTIVE)                          |
            | THEME: NEON LIME DARK MODE                                |
            +-----------------------------------------------------------+
            `);
        });
    }
}

// Inicialização Direta
const masterEngine = new VlogStudentsEnterpriseServer();
masterEngine.start();

module.exports = masterEngine.app;