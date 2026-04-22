const dotenv = require('dotenv');
const path = require('path');

// Carrega o .env
dotenv.config();

const env = {
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    JWT_SECRET: process.env.JWT_SECRET,
    BCRYPT_SALT: 12
};

// Validação Crítica
const requiredEnvs = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'JWT_SECRET'
];

requiredEnvs.forEach(key => {
    if (!process.env[key]) {
        console.error(`[FATAL] Variável de ambiente obrigatória ausente: ${key}`);
        process.exit(1);
    }
});

module.exports = env;