/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DATABASE ORCHESTRATOR (Neon PostgreSQL) v2.0.6
 * SISTEMA DE PERSISTÊNCIA COM PROTOCOLO DE RETRY E TIMEOUT ESTENDIDO
 * ============================================================================
 */

const { Pool } = require('pg');

// Configuração de Conectividade Industrial
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false 
    },
    max: 20,
    idleTimeoutMillis: 30000,
    // Aumentado para 15s para suportar o Cold Start do Neon
    connectionTimeoutMillis: 15000, 
    statement_timeout: 15000,
};

const pool = new Pool(poolConfig);

/**
 * Script de Inicialização Master com Auto-Healing e Retries
 */
const initializeDatabase = async (retryCount = 5) => {
    let client;
    try {
        console.log(`[MASTER_DB] Tentando conexão com o cluster (Tentativas restantes: ${retryCount})...`);
        client = await pool.connect();
        
        console.log('[MASTER_DB] Auditoria de integridade de tabelas iniciada...');

        await client.query('BEGIN');

        // 1. USUÁRIOS
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
                isActive BOOLEAN DEFAULT true,
                recovery_token VARCHAR(10),
                recovery_expires TIMESTAMP,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 2. REELS
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

        // 3. COMENTÁRIOS (Vital para evitar erro de UNDEFINED)
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

        // 4. INTERAÇÕES
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

        // 5. CHAT ENGINE
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

        // 6. ECONOMIA (VOICES)
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

        await client.query('COMMIT');
        console.log('[MASTER_DB] Protocolo de Auto-Healing concluído. Esquema sincronizado.');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('[MASTER_DB_ERROR] Falha na conexão/inicialização:', error.message);
        
        if (retryCount > 0) {
            console.log(`[MASTER_DB_RECOVERY] Tentando reconectar em 5 segundos...`);
            setTimeout(() => initializeDatabase(retryCount - 1), 5000);
        } else {
            console.error('[MASTER_DB_CRITICAL] Limite de tentativas de conexão excedido.');
        }
    } finally {
        if (client) client.release();
    }
};

// Disparo imediato da inicialização
initializeDatabase();

module.exports = {
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect(),
    pool: pool
};
