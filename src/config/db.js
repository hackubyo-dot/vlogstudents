const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
    connectionString: env.databaseUrl,

    // SSL obrigatório para provedores como Neon / Supabase
    ssl: {
        rejectUnauthorized: false
    },

    // Configuração do pool (performance + estabilidade)
    max: 20, // limite de conexões simultâneas
    idleTimeoutMillis: 30000, // tempo de idle antes de fechar conexão
    connectionTimeoutMillis: 2000 // timeout para novas conexões
});

// Evento disparado quando uma nova conexão é criada
pool.on('connect', () => {
    console.log('[DATABASE] Nova conexão estabelecida com o cluster.');
});

// Evento para erros inesperados no pool
pool.on('error', (err) => {
    console.error('[DATABASE ERROR] Erro inesperado no pool:', err);
});

module.exports = {
    // Executar queries diretamente
    query: (text, params) => pool.query(text, params),

    // Obter client manual (transações, etc.)
    getClient: () => pool.connect(),

    // Exportar pool completo (casos avançados)
    pool
};