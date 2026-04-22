/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - ENV CONFIG v2.0.0
 * Central de configuração segura e validada
 * ============================================================================
 */

const dotenv = require('dotenv');
const path = require('path');

// Carrega variáveis de ambiente (.env local ou Render env)
dotenv.config({
    path: path.resolve(process.cwd(), '.env')
});

// ===============================
// OBJETO DE CONFIG
// ===============================
const env = {
    // SERVIDOR
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // DATABASE (NEON)
    DATABASE_URL: process.env.DATABASE_URL,

    // SUPABASE (STORAGE)
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,

    // SEGURANÇA
    JWT_SECRET: process.env.JWT_SECRET || 'vlog_students_master_secret',

    // CRYPTO
    BCRYPT_SALT: parseInt(process.env.BCRYPT_SALT, 10) || 12,
};

// ===============================
// VALIDAÇÃO CRÍTICA
// ===============================
const requiredEnvs = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'JWT_SECRET'
];

const missingEnvs = [];

requiredEnvs.forEach((key) => {
    if (!process.env[key] || process.env[key].trim() === '') {
        missingEnvs.push(key);
    }
});

// Se faltar algo → crash controlado
if (missingEnvs.length > 0) {
    console.error('========================================');
    console.error('[FATAL ENV ERROR] Variáveis ausentes:');
    missingEnvs.forEach(env => console.error(` - ${env}`));
    console.error('========================================');
    process.exit(1);
}

// ===============================
// LOG SEGURO (SEM VAZAR SEGREDOS)
// ===============================
if (env.NODE_ENV !== 'production') {
    console.log('[ENV] Ambiente carregado com sucesso');
} else {
    console.log('[ENV] Production mode ativo');
}

// ===============================
module.exports = env;
