const jsonwebtoken = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const xssClean = require('xss-clean');
const logger = require('./logger');

/**
 * VlogStudents Security Engine - Full Enterprise Edition
 * Sistema unificado de segurança, criptografia e proteção de dados.
 */
class VlogStudentsSecurityEngine {
    constructor() {
        // Configurações Base
        this.jwtSecret = process.env.JWT_SECRET || 'VLOGSTUDENTS_SUPER_SECRET_KEY_2025_CORE_SYSTEM_SECURE_AUTH';
        this.jwtExpiration = process.env.JWT_EXPIRATION || '7d';
        this.bcryptSaltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;

        // Criptografia Simétrica (AES)
        this.encryptionAlgorithm = 'aes-256-cbc';
        this.encryptionKey = crypto.scryptSync(this.jwtSecret, 'vlog_salt', 32);
        this.initializationVector = crypto.randomBytes(16);

        // Controle de Acesso e Revogação
        this.allowedOrigins = ['http://localhost:3000', 'https://vlogstudents.onrender.com'];
        this.blacklist = new Set();

        // Configurações de Terceiros
        this.googleClientId = process.env.GOOGLE_CLIENT_ID;
    }

    // ==========================================
    // CONFIGURAÇÕES DE MIDDLEWARE (CORS & HELMET)
    // ==========================================

    setupCorsConfiguration() {
        return {
            origin: (origin, callback) => {
                // Permite requisições sem origin (como apps mobile ou curl) ou se estiver na whitelist
                if (!origin || this.allowedOrigins.indexOf(origin) !== -1) {
                    callback(null, true);
                } else {
                    logger.security(`Tentativa de acesso bloqueada por CORS: ${origin}`);
                    callback(new Error('Acesso negado pelas políticas de segurança de origem do VlogStudents'));
                }
            },
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Trace-Id'],
            exposedHeaders: ['Content-Range', 'X-Content-Range', 'X-Trace-Id'],
            credentials: true,
            maxAge: 86400 // 24 horas
        };
    }

    setupHelmetConfiguration() {
        return helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
                    connectSrc: ["'self'", "https://vlogstudents.onrender.com", "wss://vlogstudents.onrender.com", "https://*.googleapis.com"],
                    imgSrc: ["'self'", "data:", "blob:", "https://*.googleusercontent.com", "https://*.googleapis.com"],
                    mediaSrc: ["'self'", "blob:", "https://*.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    objectSrc: ["'none'"],
                    frameSrc: ["'self'", "https://accounts.google.com"],
                    upgradeInsecureRequests: [],
                },
            },
            dnsPrefetchControl: { allow: false },
            frameguard: { action: 'deny' },
            hidePoweredBy: true,
            hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
            ieNoOpen: true,
            noSniff: true,
            originAgentCluster: true,
            permittedCrossDomainPolicies: { policy: 'none' },
            referrerPolicy: { policy: 'no-referrer' },
            xssFilter: true,
        });
    }

    // ==========================================
    // LIMITADORES DE REQUISIÇÃO (RATE LIMITING)
    // ==========================================

    createGeneralRateLimiter() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutos
            max: 1000,
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                success: false,
                status: 429,
                message: 'Muitas requisições originadas deste endereço IP. Tente novamente em 15 minutos.',
                error_code: 'RATE_LIMIT_EXCEEDED'
            },
            handler: (req, res, next, options) => {
                logger.security(`Rate limit atingido: ${req.ip} no endpoint ${req.originalUrl}`);
                res.status(options.statusCode).send(options.message);
            }
        });
    }

    createAuthenticationRateLimiter() {
        return rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hora
            max: 15,
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                success: false,
                status: 429,
                message: 'Muitas tentativas de login. Sua conta foi temporariamente protegida contra força bruta.',
                error_code: 'BRUTE_FORCE_PROTECTION'
            },
            handler: (req, res, next, options) => {
                logger.security(`Possível tentativa de brute force: ${req.ip} para o email ${req.body?.email}`);
                res.status(options.statusCode).send(options.message);
            }
        });
    }

    createUploadRateLimiter() {
        return rateLimit({
            windowMs: 24 * 60 * 60 * 1000, // 24 horas
            max: 50,
            message: {
                success: false,
                status: 429,
                message: 'Limite diário de uploads atingido para seu perfil.',
                error_code: 'UPLOAD_LIMIT_REACHED'
            }
        });
    }

    // ==========================================
    // AUTENTICAÇÃO E JWT
    // ==========================================

    async generateAccessToken(payload) {
        try {
            const options = {
                expiresIn: this.jwtExpiration,
                issuer: 'vlogstudents_api',
                audience: 'vlogstudents_app',
                algorithm: 'HS256'
            };
            return jsonwebtoken.sign(payload, this.jwtSecret, options);
        } catch (error) {
            logger.error('Erro ao gerar token JWT', error);
            throw new Error('Falha na geração do token de segurança');
        }
    }

    async verifyAccessToken(token) {
        try {
            if (this.blacklist.has(token)) {
                throw new Error('Token revogado');
            }
            return jsonwebtoken.verify(token, this.jwtSecret, {
                issuer: 'vlogstudents_api',
                audience: 'vlogstudents_app'
            });
        } catch (error) {
            logger.security(`Token inválido ou expirado detectado: ${error.message}`);
            return null;
        }
    }

    revokeToken(token) {
        if (token) {
            this.blacklist.add(token);
            logger.security('Token adicionado à lista de revogação');
            // Remove da blacklist após 7 dias (tempo da expiração) para economizar memória
            setTimeout(() => {
                this.blacklist.delete(token);
            }, 7 * 24 * 60 * 60 * 1000);
        }
    }

    isTokenBlacklisted(token) {
        return this.blacklist.has(token);
    }

    // ==========================================
    // HASHEAMENTO E CRIPTOGRAFIA
    // ==========================================

    async hashData(data) {
        try {
            return await bcryptjs.hash(data, this.bcryptSaltRounds);
        } catch (error) {
            logger.error('Erro ao processar hash de dados', error);
            throw new Error('Erro interno de processamento de segurança');
        }
    }

    async compareHash(data, hashedData) {
        try {
            if (!data || !hashedData) return false;
            return await bcryptjs.compare(data, hashedData);
        } catch (error) {
            logger.error('Erro ao comparar hash', error);
            return false;
        }
    }

    encryptSensitiveData(text) {
        try {
            const cipher = crypto.createCipheriv(this.encryptionAlgorithm, this.encryptionKey, this.initializationVector);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return {
                iv: this.initializationVector.toString('hex'),
                content: encrypted
            };
        } catch (error) {
            logger.error('Erro na criptografia de dados sensíveis', error);
            throw new Error('Falha no motor de criptografia');
        }
    }

    decryptSensitiveData(encryptedData) {
        try {
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, this.encryptionKey, iv);
            let decrypted = decipher.update(encryptedData.content, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            logger.error('Erro na descriptografia de dados', error);
            throw new Error('Falha na recuperação de dados seguros');
        }
    }

    // ==========================================
    // SANITIZAÇÃO E INTEGRIDADE
    // ==========================================

    applyDataSanitization(app) {
        app.use(xssClean());
        app.use(hpp());
        app.use((req, res, next) => {
            if (req.body) this.deepSanitize(req.body);
            if (req.query) this.deepSanitize(req.query);
            if (req.params) this.deepSanitize(req.params);
            next();
        });
    }

    deepSanitize(obj) {
        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                // Remove tags HTML básicas e faz trim
                obj[key] = obj[key].replace(/[<>]/g, '').trim();
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                this.deepSanitize(obj[key]);
            }
        }
    }

    calculateFileHash(buffer) {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    checkContentIntegrity(receivedHash, originalBuffer) {
        const currentHash = this.calculateFileHash(originalBuffer);
        return receivedHash === currentHash;
    }

    // ==========================================
    // UTILITÁRIOS DE VALIDAÇÃO
    // ==========================================

    validatePasswordComplexity(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
    }

    validateEmailFormat(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validateUsername(username) {
        const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
        return usernameRegex.test(username);
    }

    validateUuid(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    // ==========================================
    // GERAÇÃO DE CÓDIGOS E TOKENS
    // ==========================================

    generateReferralCode(username) {
        const seed = `${username}${Date.now()}${crypto.randomBytes(4).toString('hex')}`;
        return crypto.createHash('md5').update(seed).digest('hex').substring(0, 10).toUpperCase();
    }

    generateSecureRandomCode(length = 6) {
        return crypto.randomInt(100000, 999999).toString().substring(0, length);
    }

    generateTraceId() {
        return crypto.randomBytes(16).toString('hex');
    }

    createPasswordResetToken() {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expires = Date.now() + 3600000; // 1 hora
        return { resetToken, hashedToken, expires };
    }

    // ==========================================
    // PROTEÇÃO DE CONTA (LOCKOUT)
    // ==========================================

    checkAccountLockout(user) {
        return user.login_attempts >= 5 && user.lockout_until > Date.now();
    }

    incrementLoginAttempts(user) {
        user.login_attempts = (user.login_attempts || 0) + 1;
        if (user.login_attempts >= 5) {
            user.lockout_until = Date.now() + 900000; // 15 minutos de bloqueio
        }
    }

    resetLoginAttempts(user) {
        user.login_attempts = 0;
        user.lockout_until = null;
    }

    // ==========================================
    // MÁSCARAS E FORMATAÇÃO SEGURA
    // ==========================================

    maskEmail(email) {
        const [user, domain] = email.split('@');
        return `${user.substring(0, 3)}****@${domain}`;
    }

    maskPhoneNumber(phone) {
        return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) *****-$3");
    }

    sanitizeFilename(filename) {
        return filename.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    }

    // ==========================================
    // MIDDLEWARE DE INTEGRAÇÃO
    // ==========================================

    setupSecurityMiddleware(app) {
        // Redirecionamento HTTPS em produção
        app.use((req, res, next) => {
            const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
            if (!isSecure && process.env.NODE_ENV === 'production') {
                return res.redirect(`https://${req.headers.host}${req.url}`);
            }
            next();
        });

        app.use(this.setupHelmetConfiguration());
        app.use(require('cors')(this.setupCorsConfiguration()));
        app.use(this.createGeneralRateLimiter());
        this.applyDataSanitization(app);

        // Trace ID para debug e auditoria
        app.use((req, res, next) => {
            const traceId = this.generateTraceId();
            req.traceId = traceId;
            res.setHeader('X-Trace-Id', traceId);
            next();
        });
    }

    auditLogMiddleware(req, res, next) {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            if (req.method !== 'GET' || duration > 1000) {
                logger.audit(req.method, req.user ? req.user.id : 'anonymous', req.originalUrl, {
                    duration,
                    statusCode: res.statusCode,
                    ip: req.ip,
                    traceId: req.traceId
                });
            }
        });
        next();
    }

    getSecurityAuditReport() {
        return {
            engine_status: 'operational',
            firewall_active: true,
            brute_force_protection: 'active',
            encryption_level: 'enterprise (AES-256-CBC)',
            last_audit_timestamp: new Date().toISOString(),
            blacklist_count: this.blacklist.size
        };
    }
}

const securityEngine = new VlogStudentsSecurityEngine();

// Exportação unificada compatível com os dois estilos solicitados
module.exports = {
    engine: securityEngine,
    corsOptions: securityEngine.setupCorsConfiguration(),
    helmetConfig: securityEngine.setupHelmetConfiguration(),
    generalRateLimit: securityEngine.createGeneralRateLimiter(),
    authRateLimit: securityEngine.createAuthenticationRateLimiter(),
    uploadRateLimit: securityEngine.createUploadRateLimiter(),

    // Métodos diretos (Shorthands)
    hash: (data) => securityEngine.hashData(data),
    compare: (data, hashed) => securityEngine.compareHash(data, hashed),
    sign: (payload) => securityEngine.generateAccessToken(payload),
    verify: (token) => securityEngine.verifyAccessToken(token),
    encrypt: (text) => securityEngine.encryptSensitiveData(text),
    decrypt: (data) => securityEngine.decryptSensitiveData(data),
    sanitizer: (app) => securityEngine.applyDataSanitization(app),
    middleware: (app) => securityEngine.setupSecurityMiddleware(app),

    // Utilitários Extras
    utils: {
        generateReferral: (name) => securityEngine.generateReferralCode(name),
        validateEmail: (email) => securityEngine.validateEmailFormat(email),
        validatePassword: (pass) => securityEngine.validatePasswordComplexity(pass),
        maskEmail: (email) => securityEngine.maskEmail(email)
    }
};

logger.info('VlogStudents Security Engine Layer v1.0.0 (FULL) carregado com proteções corporativas ativas.');
