/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DATABASE ORCHESTRATOR (Neon PostgreSQL) v5.0.0
 * SISTEMA DE PERSISTÊNCIA COM AUTO-HEALING E SEEDING DE ALTA FIDELIDADE
 * 
 * STATUS: ALFA OMEGA OPERATIONAL
 * USUÁRIO ALVO: hackubyo@gmail.com
 * REEL DE TESTE: 1i9JVHDig6JiRticxx7ScSf98JitH69D9
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
 */
const initializeDatabase = async () => {
    let client;
    try {
        console.log('[MASTER_DB] Iniciando auditoria de integridade de dados...');
        client = await pool.connect();

        await client.query('BEGIN');

        // 1. ESTRUTURA DE USUÁRIOS
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

        // 2. ESTRUTURA DE REELS
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

        // 3. ESTRUTURA DE COMENTÁRIOS
        await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
                author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 4. ESTRUTURA DE LIKES / FOLLOWS
        await client.query(`
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

        // 5. ESTRUTURA DE CHAT
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

        // 6. ESTRUTURA DE TRANSAÇÕES
        await client.query(`
            CREATE TABLE IF NOT EXISTS point_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                amount INTEGER NOT NULL,
                reason VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log('[MASTER_DB] Estrutura verificada. Iniciando Sincronização de Dados Reais...');

        /**
         * LÓGICA DE SEEDING: CONFIGURAÇÃO DE USUÁRIOS E REELS REAIS
         */
        
        // A. Garantir Usuário Principal (hackubyo@gmail.com)
        const avatarUrl = "https://img.freepik.com/psd-premium/ilustracao-3d-de-avatar_235528-2093.jpg?semt=ais_hybrid&w=740&q=80";
        
        await client.query(`
            INSERT INTO users (full_name, email, university_name, referral_code, points_total, avatar_url, isactive)
            VALUES ('Hackubyo VIP', 'hackubyo@gmail.com', 'Cyber University', 'HACK_MASTER_VLOG', 5000, $1, true)
            ON CONFLICT (email) DO UPDATE SET avatar_url = $1;
        `, [avatarUrl]);

        // B. Garantir Usuário Admin Secundário
        await client.query(`
            INSERT INTO users (full_name, email, university_name, referral_code, points_total, avatar_url, isactive)
            VALUES ('Vlog Admin', 'admin@vlogstudents.com', 'Universidade Master', 'ADMIN_VLOG', 1000, $1, true)
            ON CONFLICT (email) DO NOTHING;
        `, [avatarUrl]);

        // C. Inserir Reel para hackubyo@gmail.com
        await client.query(`
            INSERT INTO reels (author_id, drive_file_id, title, description, views_count, likes_count)
            SELECT id, '1i9JVHDig6JiRticxx7ScSf98JitH69D9', '🔥 Teste de Streaming hackubyo', 'Validando o motor de vídeo do VlogStudents.', 2500, 890
            FROM users WHERE email = 'hackubyo@gmail.com'
            AND NOT EXISTS (SELECT 1 FROM reels WHERE author_id = users.id AND drive_file_id = '1i9JVHDig6JiRticxx7ScSf98JitH69D9');
        `);

        // D. Inserir Reel para o Admin (Mesmo vídeo)
        await client.query(`
            INSERT INTO reels (author_id, drive_file_id, title, description, views_count, likes_count)
            SELECT id, '1i9JVHDig6JiRticxx7ScSf98JitH69D9', '🚀 Admin Check System', 'Vídeo espelhado para teste de carga.', 500, 120
            FROM users WHERE email = 'admin@vlogstudents.com'
            AND NOT EXISTS (SELECT 1 FROM reels WHERE author_id = users.id AND drive_file_id = '1i9JVHDig6JiRticxx7ScSf98JitH69D9');
        `);

        await client.query('COMMIT');
        console.log('[MASTER_DB] Sincronização concluída. hackubyo@gmail.com está ativo com avatar e vídeo.');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('[MASTER_DB_ERROR] Falha crítica:', error.message);
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
