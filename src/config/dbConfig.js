/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DATABASE ORCHESTRATOR v8.0.0
 * NEON POSTGRESQL CONNECTIVITY HUB & AUTO-HEALING SCHEMA
 * ============================================================================
 */

const { Pool } = require('pg');

const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false 
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000, 
    statement_timeout: 30000,
};

const pool = new Pool(poolConfig);

/**
 * PROTOCOLO DE INICIALIZAÇÃO E SEEDING MASTER
 * Garante que o banco de dados esteja sempre pronto para o Flutter.
 */
const initializeDatabase = async () => {
    let client;
    try {
        console.log('[MASTER_DB] Iniciando auditoria de integridade de dados...');
        client = await pool.connect();

        await client.query('BEGIN');

        // 1. ESTRUTURA DE USUÁRIOS (Sincronizado com VlogUser do Flutter)
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                google_id VARCHAR(255) UNIQUE,
                avatar_url TEXT,
                university_name VARCHAR(255),
                referral_code VARCHAR(50) UNIQUE,
                points_total INTEGER DEFAULT 0,
                theme_pref VARCHAR(20) DEFAULT 'dark',
                phone_number VARCHAR(50),
                biography TEXT,
                isactive BOOLEAN DEFAULT true,
                recovery_token VARCHAR(10),
                recovery_expires TIMESTAMP,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 2. ESTRUTURA DE REELS (O coração do feed)
        await client.query(`
            CREATE TABLE IF NOT EXISTS reels (
                id SERIAL PRIMARY KEY,
                author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                drive_file_id TEXT NOT NULL,
                thumbnail_id TEXT,
                title VARCHAR(255),
                description TEXT,
                duration INTEGER DEFAULT 0,
                views_count INTEGER DEFAULT 0,
                likes_count INTEGER DEFAULT 0,
                comments_count INTEGER DEFAULT 0,
                reposts_count INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 3. ESTRUTURA DE COMENTÁRIOS E SOCIAL
        await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
                author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS likes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
                UNIQUE(user_id, reel_id)
            );

            CREATE TABLE IF NOT EXISTS follows (
                id SERIAL PRIMARY KEY,
                follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(follower_id, following_id)
            );
        `);

        // 4. ESTRUTURA DE CHAT REALTIME
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_rooms (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                is_group BOOLEAN DEFAULT false,
                last_message_preview TEXT,
                last_activity TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS chat_participants (
                room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                unread_count INTEGER DEFAULT 0,
                PRIMARY KEY (room_id, user_id)
            );
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                content TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 5. ESTRUTURA DE ECONOMIA (VOICES)
        await client.query(`
            CREATE TABLE IF NOT EXISTS point_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                amount INTEGER NOT NULL,
                reason VARCHAR(100) NOT NULL,
                reference_id TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log('[MASTER_DB] Esquema validado. Iniciando Seeding de Dados...');

        /**
         * LÓGICA DE SEEDING: CONFIGURAÇÃO DE ACESSO VIP
         */
        
        // Garantir Usuário Principal (hackubyo@gmail.com)
        const defaultAvatar = "https://img.freepik.com/psd-premium/ilustracao-3d-de-avatar_235528-2093.jpg?w=740";
        
        await client.query(`
            INSERT INTO users (full_name, email, university_name, referral_code, points_total, avatar_url, isactive)
            VALUES ('Hackubyo VIP', 'hackubyo@gmail.com', 'Cyber University', 'HACK_MASTER_VLOG', 5000, $1, true)
            ON CONFLICT (email) DO UPDATE SET avatar_url = EXCLUDED.avatar_url;
        `, [defaultAvatar]);

        // Inserir Reel de Teste (1i9JVHDig6JiRticxx7ScSf98JitH69D9) para o usuário VIP
        await client.query(`
            INSERT INTO reels (author_id, drive_file_id, title, description, views_count, likes_count)
            SELECT id, '1i9JVHDig6JiRticxx7ScSf98JitH69D9', '🔥 Teste de Streaming Master', 'Validando v8.0.0 no Flutter.', 2500, 890
            FROM users WHERE email = 'hackubyo@gmail.com'
            AND NOT EXISTS (SELECT 1 FROM reels WHERE drive_file_id = '1i9JVHDig6JiRticxx7ScSf98JitH69D9');
        `);

        await client.query('COMMIT');
        console.log('[MASTER_DB] Sincronização concluída com sucesso.');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('[MASTER_DB_ERROR] Falha na sincronização:', error.message);
    } finally {
        if (client) client.release();
    }
};

initializeDatabase();

module.exports = {
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect(),
    pool: pool
};
