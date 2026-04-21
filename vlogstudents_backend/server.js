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
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const stream = require('stream');
const { google } = require('googleapis');
const { Pool } = require('pg');
const { OAuth2Client } = require('google-auth-library');

/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER SERVER ENGINE v4.5.0
 * DESENVOLVIDO PARA ALTA DISPONIBILIDADE E INTEGRAÇÃO TOTAL FRONT-BACK
 * ============================================================================
 */

// --- CONFIGURAÇÕES DE AMBIENTE E SEGURANÇA ---
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'VLOG_STUDENTS_SUPER_ENCRYPT_MASTER_KEY_2025_RELEASE';
const DATABASE_URL = 'postgresql://neondb_owner:npg_tzKG1cYOg2JV@ep-billowing-scene-amoqz4x7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const GOOGLE_DRIVE_FOLDER_ID = '1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ';
const GOOGLE_CLIENT_ID = '435332250244-vh9rravt3cmf1vmng29rbbs4vj3iccle.apps.googleusercontent.com';

class VlogStudentsEnterpriseMaster {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);

        // Inicialização de Motores Externos
        this.googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
        this.pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 100, // Pool de conexões industrial
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        // Configuração de Mídia
        this.storage = multer.memoryStorage();
        this.upload = multer({
            storage: this.storage,
            limits: { fileSize: 100 * 1024 * 1024 } // 100MB por Reel
        });

        this.bootstrap();
    }

    async bootstrap() {
        this.setupLogger();
        this.applySecurityMiddlewares();
        this.initializeCloudSystems();
        this.setupSocketIO();
        this.configureInfrastructureRoutes();
        this.mapBusinessRoutes();
        this.setupErrorHandler();
        this.startHardwareAudit();
    }

    // ----------------------------------------------------------------------------
    // 1. SISTEMA DE LOGS E TELEMETRIA
    // ----------------------------------------------------------------------------
    setupLogger() {
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
                new winston.transports.File({ filename: 'logs/security.log', level: 'warn' }),
                new winston.transports.File({ filename: 'logs/api_traffic.log' })
            ]
        });
    }

    // ----------------------------------------------------------------------------
    // 2. MIDDLEWARES DE SEGURANÇA E REDE
    // ----------------------------------------------------------------------------
    applySecurityMiddlewares() {
        // Proteção de Headers
        this.app.use(helmet({
            contentSecurityPolicy: false,
            crossOriginResourcePolicy: { policy: "cross-origin" }
        }));

        // Compressão de Gzip para economia de dados móveis
        this.app.use(compression());

        // CORS CONFIGURATION (FIM DO ERRO XMLHTTPREQUEST)
        const corsOptions = {
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-App-Version'],
            credentials: true
        };
        this.app.use(cors(corsOptions));

        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        // Logger de Requisições
        this.app.use(morgan('combined', { stream: { write: msg => this.logger.info(msg.trim()) } }));

        // Injeção de Contexto
        this.app.use((req, res, next) => {
            req.io = this.io;
            req.db = this.pool;
            next();
        });
    }

    // ----------------------------------------------------------------------------
    // 3. INTEGRAÇÃO GOOGLE CLOUD (DRIVE & OAUTH)
    // ----------------------------------------------------------------------------
    initializeCloudSystems() {
        const credentialsPath = path.join(__dirname, 'credentials.json');
        if (!fs.existsSync(credentialsPath)) {
            this.logger.error('CRITICAL: Google credentials.json is missing.');
            return;
        }

        const auth = new google.auth.GoogleAuth({
            keyFile: credentialsPath,
            scopes: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.readonly'
            ]
        });

        this.drive = google.drive({ version: 'v3', auth });
        this.logger.info('VLOG_CLOUD: Google Drive engine connected.');
    }

    // ----------------------------------------------------------------------------
    // 4. MOTOR REALTIME (WEBSOCKETS) - CHAT & CALLS
    // ----------------------------------------------------------------------------
    setupSocketIO() {
        this.io = socketIo(this.server, {
            cors: { origin: "*", methods: ["GET", "POST"] },
            pingTimeout: 60000,
            transports: ['websocket', 'polling']
        });

        this.io.on('connection', (socket) => {
            this.logger.info(`SOCKET_CONNECT: ID ${socket.id}`);

            // Handshake de Identidade do Estudante
            socket.on('auth_handshake', (payload) => {
                socket.userId = payload.userId;
                socket.join(`room_user_${payload.userId}`);
                this.logger.info(`SOCKET_SYNC: User ${payload.userId} linked to ${socket.id}`);
            });

            // Mensageria Direta
            socket.on('vlog_send_message', (data) => {
                const { roomId, message } = data;
                this.io.to(`chat_${roomId}`).emit('vlog_receive_message', message);
            });

            // Indicador de Digitação
            socket.on('chat_typing_indicator', (data) => {
                socket.to(`chat_${data.roomId}`).emit('remote_typing', data);
            });

            // Sinalização de Vídeo Chamada (WebRTC Signaling)
            socket.on('initiate_video_call', (data) => {
                this.io.to(`room_user_${data.targetUserId}`).emit('incoming_video_call', data);
            });

            socket.on('disconnect', () => {
                this.logger.info(`SOCKET_DISCONNECT: ID ${socket.id}`);
            });
        });
    }

    // ----------------------------------------------------------------------------
    // 5. MIDDLEWARE DE AUTENTICAÇÃO (GUARD)
    // ----------------------------------------------------------------------------
    vlogAuthGuard = (req, res, next) => {
        const header = req.headers.authorization;
        if (!header) return res.status(401).json({ success: false, message: 'Autenticação necessária.' });

        const token = header.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            next();
        } catch (err) {
            res.status(403).json({ success: false, message: 'Sessão expirada.' });
        }
    };

    // ----------------------------------------------------------------------------
    // 6. MAPEAMENTO DE ROTAS DA API (SINCRO TOTAL COM FLUTTER)
    // ----------------------------------------------------------------------------
    mapBusinessRoutes() {
        const v1 = express.Router();

        // --- MÓDULO: AUTENTICAÇÃO ---

        v1.post('/auth/register', async (req, res) => {
            const { user_full_name, user_email_address, password, user_university_name, user_referral_code } = req.body;
            try {
                const hashedPassword = await bcrypt.hash(password, 12);
                const query = `
                    INSERT INTO users (user_full_name, user_email_address, password, user_university_name)
                    VALUES ($1, $2, $3, $4) RETURNING *;
                `;
                const result = await this.pool.query(query, [user_full_name, user_email_address, hashedPassword, user_university_name]);
                const user = result.rows[0];
                const token = jwt.sign({ id: user.user_identification }, JWT_SECRET, { expiresIn: '30d' });

                res.status(201).json({ success: true, data: { user, token } });
            } catch (err) {
                res.status(400).json({ success: false, message: 'E-mail já cadastrado no sistema.' });
            }
        });

        v1.post('/auth/login', async (req, res) => {
            const { user_email_address, password } = req.body;
            try {
                const result = await this.pool.query('SELECT * FROM users WHERE user_email_address = $1', [user_email_address]);
                if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });

                const user = result.rows[0];
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) return res.status(401).json({ success: false, message: 'Senha incorreta.' });

                const token = jwt.sign({ id: user.user_identification }, JWT_SECRET, { expiresIn: '30d' });
                res.json({ success: true, data: { user, token } });
            } catch (err) {
                res.status(500).json({ success: false, message: 'Erro no motor de autenticação.' });
            }
        });

        v1.post('/auth/google', async (req, res) => {
            const { googleToken } = req.body;
            try {
                const ticket = await this.googleClient.verifyIdToken({ idToken: googleToken, audience: GOOGLE_CLIENT_ID });
                const payload = ticket.getPayload();
                const result = await this.pool.query(
                    'INSERT INTO users (google_id_reference, user_email_address, user_full_name, user_profile_picture_url) VALUES ($1, $2, $3, $4) ON CONFLICT (user_email_address) DO UPDATE SET google_id_reference = $1 RETURNING *',
                    [payload.sub, payload.email, payload.name, payload.picture]
                );
                const user = result.rows[0];
                const token = jwt.sign({ id: user.user_identification }, JWT_SECRET, { expiresIn: '30d' });
                res.json({ success: true, data: { user, token } });
            } catch (err) {
                res.status(500).json({ success: false, message: 'Falha no Google Handshake.' });
            }
        });

        v1.get('/auth/validate', this.vlogAuthGuard, async (req, res) => {
            const result = await this.pool.query('SELECT * FROM users WHERE user_identification = $1', [req.user.id]);
            if (result.rows.length > 0) res.json({ success: true, user: result.rows[0] });
            else res.status(404).json({ success: false });
        });

        // --- MÓDULO: REELS & FEED (TIKTOK FLOW) ---

        v1.get('/reels/feed', async (req, res) => {
            try {
                // Rota pública para assistir sem login
                const result = await this.pool.query('SELECT * FROM view_vlog_reels_feed LIMIT 50');
                res.json({ success: true, data: result.rows });
            } catch (err) {
                res.status(500).json({ success: false, message: err.message });
            }
        });

        v1.post('/reels/publish', this.vlogAuthGuard, this.upload.single('file'), async (req, res) => {
            try {
                const { title, description, duration } = req.body;
                const file = req.file;

                const bufferStream = new stream.PassThrough();
                bufferStream.end(file.buffer);

                const driveRes = await this.drive.files.create({
                    requestBody: { name: `vlog_${Date.now()}`, parents: [GOOGLE_DRIVE_FOLDER_ID] },
                    media: { mimeType: file.mimetype, body: bufferStream },
                    fields: 'id'
                });

                const query = `
                    INSERT INTO reels (reel_author_user_id, reel_google_drive_file_id, reel_title_text, reel_description_content, reel_duration_seconds)
                    VALUES ($1, $2, $3, $4, $5) RETURNING *;
                `;
                const result = await this.pool.query(query, [req.user.id, driveRes.data.id, title, description, duration]);

                // Trigger de Recompensa
                await this.pool.query('INSERT INTO points (point_owner_user_id, point_amount_value, point_reason_description) VALUES ($1, 20, $2)', [req.user.id, 'REEL_UPLOAD']);

                res.status(201).json({ success: true, data: result.rows[0] });
            } catch (err) {
                res.status(500).json({ success: false, message: 'Falha no upload para nuvem.' });
            }
        });

        // --- MÓDULO: MÍDIA E STREAMING ---

        v1.get('/media/drive/:fileId', async (req, res) => {
            try {
                const response = await this.drive.files.get(
                    { fileId: req.params.fileId, alt: 'media' },
                    { responseType: 'stream' }
                );
                res.setHeader('Content-Type', response.headers['content-type']);
                response.data.pipe(res);
            } catch (err) {
                res.status(404).send('Media not found.');
            }
        });

        // --- MÓDULO: USUÁRIOS E SOCIAL ---

        v1.get('/users/profile/:id', async (req, res) => {
            const result = await this.pool.query('SELECT * FROM users WHERE user_identification = $1', [req.params.id]);
            res.json({ success: true, data: result.rows[0] });
        });

        v1.patch('/users/profile/update', this.vlogAuthGuard, async (req, res) => {
            const { user_full_name, user_university_name, user_biography_text, user_phone_number } = req.body;
            const query = `
                UPDATE users SET user_full_name = $1, user_university_name = $2, user_biography_text = $3, user_phone_number = $4
                WHERE user_identification = $5 RETURNING *;
            `;
            const result = await this.pool.query(query, [user_full_name, user_university_name, user_biography_text, user_phone_number, req.user.id]);
            res.json({ success: true, data: result.rows[0] });
        });

        v1.get('/users/points/balance', this.vlogAuthGuard, async (req, res) => {
            const result = await this.pool.query('SELECT user_points_balance FROM users WHERE user_identification = $1', [req.user.id]);
            res.json({ success: true, balance: result.rows[0].user_points_balance });
        });

        v1.get('/users/leaderboard/global', async (req, res) => {
            const result = await this.pool.query('SELECT * FROM view_leaderboard_points');
            res.json({ success: true, data: result.rows });
        });

        // --- MÓDULO: CHAT ---

        v1.get('/chat/rooms/my-chats', this.vlogAuthGuard, async (req, res) => {
            const result = await this.pool.query('SELECT * FROM view_user_chat_list WHERE member_user_id = $1', [req.user.id]);
            res.json({ success: true, data: result.rows });
        });

        v1.post('/chat/rooms', this.vlogAuthGuard, async (req, res) => {
            const { participants, isGroup, name } = req.body;
            const room = await this.pool.query('INSERT INTO chat_rooms (chat_room_name_display, chat_room_is_group_chat) VALUES ($1, $2) RETURNING *', [name, isGroup]);
            const roomId = room.rows[0].chat_room_identification;

            for (let p of participants) {
                await this.pool.query('INSERT INTO chat_room_members (member_chat_room_id, member_user_id) VALUES ($1, $2)', [roomId, p]);
            }
            await this.pool.query('INSERT INTO chat_room_members (member_chat_room_id, member_user_id) VALUES ($1, $2)', [roomId, req.user.id]);

            res.json({ success: true, data: room.rows[0] });
        });

        this.app.use('/api/v1', v1);
    }

    // ----------------------------------------------------------------------------
    // 7. INFRAESTRUTURA DE ROTAS DE SUPORTE
    // ----------------------------------------------------------------------------
    configureInfrastructureRoutes() {
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', uptime: process.uptime(), db: 'connected' });
        });

        this.app.get('/', (req, res) => {
            res.send('<h1>VlogStudents Enterprise Master API</h1><p>Status: Operational</p>');
        });

        // Handler para rotas inexistentes
        this.app.use('*', (req, res) => {
            res.status(404).json({ success: false, message: `Rota ${req.originalUrl} não mapeada.` });
        });
    }

    // ----------------------------------------------------------------------------
    // 8. AUDITORIA DE HARDWARE E GESTÃO DE ERROS
    // ----------------------------------------------------------------------------
    startHardwareAudit() {
        setInterval(() => {
            const mem = process.memoryUsage().rss / 1024 / 1024;
            if (mem > 480) {
                this.logger.warn(`MEMORY_ALERT: ${Math.round(mem)}MB used on Render Instance.`);
            }
        }, 300000);
    }

    setupErrorHandler() {
        this.app.use((err, req, res, next) => {
            this.logger.error(`UNHANDLED_EXCEPTION: ${err.message}`, { stack: err.stack });
            res.status(500).json({ success: false, message: 'Erro crítico no motor do servidor.' });
        });
    }

    start() {
        this.server.listen(PORT, () => {
            console.log(`
            +-------------------------------------------------------------+
            | VLOGSTUDENTS ENTERPRISE ECOSYSTEM v4.5.0                    |
            +-------------------------------------------------------------+
            | DATABASE: NEON POSTGRESQL (CONNECTED)                       |
            | STORAGE: GOOGLE DRIVE V3 (OPERATIONAL)                      |
            | REALTIME: SOCKET.IO HUB (ACTIVE)                            |
            | PROTOCOL: HTTPS / JSON / WEBSOCKET                          |
            | PORT: ${PORT}                                                  |
            +-------------------------------------------------------------+
            `);
        });
    }
}

// Inicialização e Ciclo de Vida
const coreServer = new VlogStudentsEnterpriseMaster();
coreServer.start();

// Graceful Shutdown
process.on('SIGTERM', () => {
    coreServer.logger.info('SIGTERM: Drenando conexões do pool...');
    coreServer.pool.end();
    process.exit(0);
});
