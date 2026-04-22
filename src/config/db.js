const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: {
        rejectUnauthorized: false
    },
    max: 20, // Limite de conexões para evitar sobrecarga no Neon free tier
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
    console.log('[DATABASE] Nova conexão estabelecida com o cluster Neon.');
});

pool.on('error', (err) => {
    console.error('[DATABASE ERROR] Erro inesperado no pool:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    pool
};