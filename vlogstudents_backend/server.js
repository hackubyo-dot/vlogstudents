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

dotenv.config();

const DATABASE_URL = 'postgresql://neondb_owner:npg_tzKG1cYOg2JV@ep-billowing-scene-amoqz4x7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const GOOGLE_DRIVE_FOLDER_ID = '1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ';
const GOOGLE_CLIENT_ID = '435332250244-vh9rravt3cmf1vmng29rbbs4vj3iccle.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
const SERVICE_ACCOUNT_EMAIL = 'vlogstudentes@vlogstudentes.iam.gserviceaccount.com';

const app = express();
const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID);

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

const googleAuth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly']
});

const driveService = google.drive({ version: 'v3', auth: googleAuth });

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = ['http://localhost:3000', 'https://vlogstudents.onrender.com'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Acesso negado pelo CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('combined'));

class VlogStudentsBackendService {
    static async verifyGoogleToken(idToken) {
        try {
            const ticket = await oauth2Client.verifyIdToken({
                idToken: idToken,
                audience: GOOGLE_CLIENT_ID
            });
            return ticket.getPayload();
        } catch (error) {
            throw new Error('Falha na verificacao do token Google: ' + error.message);
        }
    }

    static async getOrCreateUser(payload) {
        const { email, name, picture, sub } = payload;
        const query = `
            INSERT INTO users (google_id, email, name, profile_picture, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (email) DO UPDATE
            SET name = $3, profile_picture = $4, updated_at = NOW()
            RETURNING *;
        `;
        const values = [sub, email, name, picture];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async uploadToDrive(fileBuffer, fileName, mimeType) {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileBuffer);

        const media = {
            mimeType: mimeType,
            body: bufferStream
        };

        const fileMetadata = {
            name: `vlog_${Date.now()}_${fileName}`,
            parents: [GOOGLE_DRIVE_FOLDER_ID]
        };

        try {
            const response = await driveService.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id'
            });
            return response.data.id;
        } catch (error) {
            throw new Error('Erro no upload para Google Drive: ' + error.message);
        }
    }

    static async savePostToDatabase(userId, username, content, driveKey) {
        const query = `
            INSERT INTO posts (user_id, username, content, drive_key, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *;
        `;
        const values = [userId, username, content, driveKey];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async awardPoints(userId, points, reason) {
        const query = `
            INSERT INTO points (user_id, amount, reason, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING *;
        `;
        await pool.query(query, [userId, points, reason]);
    }
}

app.post('/api/auth/google', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ success: false, message: 'ID Token ausente' });
        }

        const payload = await VlogStudentsBackendService.verifyGoogleToken(idToken);
        const user = await VlogStudentsBackendService.getOrCreateUser(payload);

        res.status(200).json({
            success: true,
            data: user,
            message: 'Autenticacao realizada com sucesso'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { username, content, userId } = req.body;
        const file = req.file;

        if (!file || !username || !userId) {
            return res.status(400).json({ success: false, message: 'Dados incompletos para postagem' });
        }

        await client.query('BEGIN');

        const driveFileId = await VlogStudentsBackendService.uploadToDrive(
            file.buffer,
            file.originalname,
            file.mimetype
        );

        const post = await VlogStudentsBackendService.savePostToDatabase(
            userId,
            username,
            content,
            driveFileId
        );

        await VlogStudentsBackendService.awardPoints(userId, 10, 'NOVO_POST_VLOG');

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            data: post,
            message: 'Postagem criada com sucesso no Arrenda App'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: 'Falha na operacao: ' + error.message });
    } finally {
        client.release();
    }
});

app.get('/api/media/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const response = await driveService.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        res.setHeader('Content-Type', response.headers['content-type']);
        response.data
            .on('end', () => {})
            .on('error', (err) => {
                res.status(500).end();
            })
            .pipe(res);
    } catch (error) {
        res.status(404).json({ success: false, message: 'Arquivo nao encontrado ou erro no stream' });
    }
});

app.get('/api/feed', async (req, res) => {
    try {
        const query = `
            SELECT p.*, u.profile_picture, u.name as display_name
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
            LIMIT 50;
        `;
        const result = await pool.query(query);
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/points/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const query = `
            SELECT COALESCE(SUM(amount), 0) as total_points
            FROM points
            WHERE user_id = $1;
        `;
        const result = await pool.query(query, [userId]);
        res.status(200).json({
            success: true,
            balance: parseInt(result.rows[0].total_points)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'VlogStudents Core',
        timestamp: new Date().toISOString()
    });
});

const initializeDatabase = async () => {
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            google_id VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            profile_picture TEXT,
            university VARCHAR(255),
            bio TEXT,
            points_balance INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const createPostsTable = `
        CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            username VARCHAR(255) NOT NULL,
            content TEXT,
            drive_key VARCHAR(255) NOT NULL,
            likes_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const createPointsTable = `
        CREATE TABLE IF NOT EXISTS points (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            amount INTEGER NOT NULL,
            reason VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const createCommentsTable = `
        CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            post_id INTEGER REFERENCES posts(id),
            user_id INTEGER REFERENCES users(id),
            text TEXT NOT NULL,
            parent_id INTEGER REFERENCES comments(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        await pool.query(createUsersTable);
        await pool.query(createPostsTable);
        await pool.query(createPointsTable);
        await pool.query(createCommentsTable);
        console.log('Tabelas sincronizadas no NeonDB');
    } catch (error) {
        console.error('Erro ao inicializar banco de dados:', error);
    }
};

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log('------------------------------------------------');
    console.log('VLOGSTUDENTS SERVER STARTING');
    console.log(`URL: https://vlogstudents.onrender.com`);
    console.log(`PORT: ${PORT}`);
    console.log('THEME: DARK MODE / NEON LIME #CCFF00');
    console.log('------------------------------------------------');
    await initializeDatabase();
});

function monitorMemoryUsage() {
    setInterval(() => {
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        if (used > 400) {
            console.warn(`Alerta de Memoria: ${Math.round(used * 100) / 100} MB sendo usados.`);
        }
    }, 60000);
}

monitorMemoryUsage();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promessa nao tratada em:', promise, 'motivo:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Excecao nao capturada:', error);
    process.exit(1);
});

app.use((err, req, res, next) => {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Erro interno do servidor',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/v1/system/info', (req, res) => {
    res.status(200).json({
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        database: 'PostgreSQL - Neon',
        storage: 'Google Drive API v3',
        auth: 'Google OAuth 2.0'
    });
});

app.post('/api/posts/:postId/like', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body;

        await pool.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1', [postId]);
        await VlogStudentsBackendService.awardPoints(userId, 1, 'LIKE_DADO');

        res.status(200).json({ success: true, message: 'Like computado' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/posts/:postId', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body;

        const postCheck = await pool.query('SELECT drive_key FROM posts WHERE id = $1 AND user_id = $2', [postId, userId]);

        if (postCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Permissao negada ou post inexistente' });
        }

        const driveKey = postCheck.rows[0].drive_key;

        await driveService.files.delete({ fileId: driveKey });
        await pool.query('DELETE FROM posts WHERE id = $1', [postId]);

        res.status(200).json({ success: true, message: 'Post removido com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.patch('/api/users/profile', async (req, res) => {
    try {
        const { userId, university, bio } = req.body;
        const query = `
            UPDATE users
            SET university = $2, bio = $3, updated_at = NOW()
            WHERE id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [userId, university, bio]);
        res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const postsCount = await pool.query('SELECT COUNT(*) FROM posts');
        res.status(200).json({
            users: parseInt(usersCount.rows[0].count),
            posts: parseInt(postsCount.rows[0].count)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/search/users', async (req, res) => {
    try {
        const { query } = req.query;
        const result = await pool.query(
            "SELECT id, name, profile_picture FROM users WHERE name ILIKE $1 LIMIT 10",
            [`%${query}%`]
        );
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

function cleanupTempFiles() {
    const tempDir = path.join(__dirname, 'uploads/tmp');
    if (fs.existsSync(tempDir)) {
        fs.readdir(tempDir, (err, files) => {
            if (err) return;
            files.forEach(file => {
                const filePath = path.join(tempDir, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;
                    if (Date.now() - stats.mtimeMs > 3600000) {
                        fs.unlink(filePath, () => {});
                    }
                });
            });
        });
    }
}

setInterval(cleanupTempFiles, 3600000);

const rateLimiter = (req, res, next) => {
    next();
};

app.use(rateLimiter);

app.get('/api/media/download/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const fileMetadata = await driveService.files.get({ fileId: fileId, fields: 'name, mimeType' });

        res.setHeader('Content-disposition', 'attachment; filename=' + fileMetadata.data.name);
        res.setHeader('Content-type', fileMetadata.data.mimeType);

        const response = await driveService.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        response.data.pipe(res);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao baixar arquivo' });
    }
});

app.post('/api/comments', async (req, res) => {
    try {
        const { postId, userId, text, parentId } = req.body;
        const query = `
            INSERT INTO comments (post_id, user_id, text, parent_id, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *;
        `;
        const result = await pool.query(query, [postId, userId, text, parentId]);
        await VlogStudentsBackendService.awardPoints(userId, 2, 'COMENTARIO_FEITO');
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/posts/:postId/comments', async (req, res) => {
    try {
        const { postId } = req.params;
        const query = `
            SELECT c.*, u.name, u.profile_picture
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = $1
            ORDER BY c.created_at ASC;
        `;
        const result = await pool.query(query, [postId]);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/users/:userId/posts', async (req, res) => {
    try {
        const { userId } = req.params;
        const query = "SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC";
        const result = await pool.query(query, [userId]);
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/trending/hashtags', async (req, res) => {
    res.status(200).json({
        success: true,
        data: ['#vlogstudents', '#university', '#coding', '#studygram', '#arrendaapp']
    });
});

app.get('/', (req, res) => {
    res.send('VlogStudents API Running');
});