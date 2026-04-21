/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DATABASE ORCHESTRATOR (Neon PostgreSQL) v4.5.0
 * SISTEMA DE PERSISTÊNCIA COM AUTO-HEALING E AUTO-SEEDING DE TESTE
 * 
 * STATUS: ALFA OMEGA OPERATIONAL
 * REEL DE TESTE INTEGRADO: 1i9JVHDig6JiRticxx7ScSf98JitH69D9
 * ============================================================================
 */

const { Pool } = require('pg');

/**
 * Configuração de Conectividade Industrial
 * Suporte a Cold Start e SSL obrigatório para ambiente de nuvem
 */
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false 
    },
    max: 20, // Pool de conexões para alta demanda
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000, 
    statement_timeout: 30000, // Tempo máximo por query
};

const pool = new Pool(poolConfig);

/**
 * PROTOCOLO DE INICIALIZAÇÃO MASTER
 * Gerencia a criação de tabelas e a inserção de dados de teste (Seeding)
 */
const initializeDatabase = async () => {
    let client;
    try {
        console.log('[MASTER_DB] Iniciando auditoria de integridade de dados...');
        client = await pool.connect();

        await client.query('BEGIN');

        // 1. CAMADA DE IDENTIDADE: USUÁRIOS
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

        // 2. CAMADA DE CONTEÚDO: REELS
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

        // 3. CAMADA DE ENGAJAMENTO: COMENTÁRIOS
        await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
                author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                parent_node_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 4. CAMADA SOCIAL: LIKES E SEGUIDORES
        await client.query(`
            CREATE TABLE IF NOT EXISTS likes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, reel_id)
            );

            CREATE TABLE IF NOT EXISTS follows (
                id SERIAL PRIMARY KEY,
                follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(follower_id, following_id)
            );
        `);

        // 5. CAMADA REALTIME: CHAT E MENSAGENS
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_rooms (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                is_group BOOLEAN DEFAULT false,
                last_message_preview TEXT,
                last_activity TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW()
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
                type VARCHAR(20) DEFAULT 'text',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 6. CAMADA ECONÔMICA: POINT TRANSACTIONS (VOICES)
        await client.query(`
            CREATE TABLE IF NOT EXISTS point_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                amount INTEGER NOT NULL,
                reason VARCHAR(100) NOT NULL,
                reference_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log('[MASTER_DB] Estrutura verificada. Iniciando Auto-Seeding de teste...');

        /**
         * LÓGICA DE SEEDING: INJEÇÃO DO REEL DE TESTE
         * Garante que o app já abra com o vídeo enviado para teste.
         */
        
        // A. Inserir Usuário Master se não existir
        await client.query(`
            INSERT INTO users (full_name, email, university_name, referral_code, points_total, isactive)
            VALUES ('Vlog Master Admin', 'admin@vlogstudents.com', 'Universidade Master', 'VLOG_MASTER_2026', 1000, true)
            ON CONFLICT (email) DO NOTHING;
        `);

        // B. Inserir o Reel manual (ID: 1i9JVHDig6JiRticxx7ScSf98JitH69D9)
        await client.query(`
            INSERT INTO reels (author_id, drive_file_id, title, description, duration, views_count, likes_count)
            SELECT id, '1i9JVHDig6JiRticxx7ScSf98JitH69D9', '🚀 Bem-vindo ao VlogStudents!', 'Este é um Reel de teste injetado para validar o streaming via Google Drive Cloud Cluster.', 15, 1200, 450
            FROM users WHERE email = 'admin@vlogstudents.com'
            AND NOT EXISTS (SELECT 1 FROM reels WHERE drive_file_id = '1i9JVHDig6JiRticxx7ScSf98JitH69D9');
        `);

        await client.query('COMMIT');
        console.log('[MASTER_DB] Protocolo concluído. Dados de teste sincronizados.');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('[MASTER_DB_ERROR] Falha na estruturação:', error.message);
    } finally {
        if (client) client.release();
    }
};

// Disparo imediato do Kernel de Dados
initializeDatabase();

module.exports = {
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect(),
    pool: pool
};
