const jsonwebtoken = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const database = require('../config/database');
const logger = require('../config/logger');
const security = require('../config/security');

const GOOGLE_CLIENT_ID = '435332250244-vh9rravt3cmf1vmng29rbbs4vj3iccle.apps.googleusercontent.com';
const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

class VlogStudentsAuthenticationMiddleware {
    constructor() {
        this.publicPaths = [
            '/api/v1/auth/login',
            '/api/v1/auth/register',
            '/api/v1/auth/google',
            '/api/v1/auth/recovery',
            '/health',
            '/api/v1/info'
        ];
    }

    async authenticate(request, response, next) {
        const traceId = request.traceId || 'no-trace';
        const requestPath = request.originalUrl.split('?')[0];

        if (this.publicPaths.includes(requestPath)) {
            return next();
        }

        try {
            const authorizationHeader = request.headers.authorization;

            if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
                logger.security(`Tentativa de acesso sem token: ${request.ip} no endpoint ${request.originalUrl}`, { traceId });
                return response.status(401).json({
                    success: false,
                    message: 'Acesso negado. Token de autenticação não fornecido ou malformatado.',
                    error_code: 'MISSING_TOKEN'
                });
            }

            const token = authorizationHeader.split(' ')[1];

            if (security.isTokenBlacklisted(token)) {
                logger.security(`Tentativa de uso de token revogado: ${request.ip}`, { traceId });
                return response.status(401).json({
                    success: false,
                    message: 'Sessão expirada ou revogada. Por favor, realize um novo login.',
                    error_code: 'REVOKED_TOKEN'
                });
            }

            let decodedPayload;
            try {
                decodedPayload = await security.verify(token);
            } catch (error) {
                logger.security(`Falha na verificação do JWT: ${error.message}`, { traceId });
                return response.status(401).json({
                    success: false,
                    message: 'Token de autenticação inválido ou expirado.',
                    error_code: 'INVALID_TOKEN'
                });
            }

            const userQuery = `
                SELECT
                    user_identification,
                    user_email_address,
                    user_full_name,
                    user_account_status,
                    user_university_name,
                    user_points_balance
                FROM users
                WHERE user_identification = $1
                LIMIT 1
            `;

            const userResult = await database.query(userQuery, [decodedPayload.id]);

            if (userResult.rows.length === 0) {
                logger.security(`Token válido para usuário inexistente: ${decodedPayload.id}`, { traceId });
                return response.status(404).json({
                    success: false,
                    message: 'Usuário associado ao token não foi encontrado no sistema.',
                    error_code: 'USER_NOT_FOUND'
                });
            }

            const currentUser = userResult.rows[0];

            if (!currentUser.user_account_status) {
                logger.security(`Tentativa de acesso de conta suspensa: ${currentUser.user_email_address}`, { traceId });
                return response.status(403).json({
                    success: false,
                    message: 'Sua conta está temporariamente suspensa. Entre em contato com o suporte.',
                    error_code: 'ACCOUNT_SUSPENDED'
                });
            }

            request.user = {
                id: currentUser.user_identification,
                email: currentUser.user_email_address,
                name: currentUser.user_full_name,
                university: currentUser.user_university_name,
                points: currentUser.user_points_balance,
                token: token
            };

            logger.info(`Usuário autenticado: ${currentUser.user_email_address}`, {
                traceId,
                userId: currentUser.user_identification
            });

            next();
        } catch (error) {
            logger.error('Erro crítico no middleware de autenticação', error, { traceId });
            return response.status(500).json({
                success: false,
                message: 'Ocorreu um erro interno ao processar sua autenticação.',
                error_code: 'AUTH_INTERNAL_ERROR'
            });
        }
    }

    async validateGoogleSession(request, response, next) {
        const { googleToken } = request.body;

        if (!googleToken) {
            return response.status(400).json({
                success: false,
                message: 'Token do Google (idToken) é obrigatório para esta operação.',
                error_code: 'GOOGLE_TOKEN_REQUIRED'
            });
        }

        try {
            const ticket = await googleOAuthClient.verifyIdToken({
                idToken: googleToken,
                audience: GOOGLE_CLIENT_ID
            });

            const payload = ticket.getPayload();
            request.googlePayload = payload;

            logger.info(`Token Google validado com sucesso para: ${payload.email}`);
            next();
        } catch (error) {
            logger.security(`Falha na validação do token Google: ${error.message}`);
            return response.status(401).json({
                success: false,
                message: 'Falha na autenticação com o Google. Token inválido ou expirado.',
                error_code: 'GOOGLE_AUTH_FAILED'
            });
        }
    }

    authorizeRoles(allowedRoles = []) {
        return (request, response, next) => {
            if (!request.user) {
                return response.status(401).json({
                    success: false,
                    message: 'Usuário não autenticado para verificar permissões.',
                    error_code: 'UNAUTHORIZED'
                });
            }

            const userRole = request.user.role || 'student';

            if (!allowedRoles.includes(userRole)) {
                logger.security(`Acesso negado: Usuário ${request.user.id} tentou acessar recurso restrito.`);
                return response.status(403).json({
                    success: false,
                    message: 'Você não possui permissão suficiente para acessar este recurso.',
                    error_code: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            next();
        };
    }

    async verifyPostOwnership(request, response, next) {
        const { postId } = request.params;
        const userId = request.user.id;

        try {
            const query = 'SELECT post_author_user_id FROM posts WHERE post_identification = $1';
            const result = await database.query(query, [postId]);

            if (result.rows.length === 0) {
                return response.status(404).json({
                    success: false,
                    message: 'O post especificado não existe.'
                });
            }

            if (result.rows[0].post_author_user_id !== userId) {
                logger.security(`Usuário ${userId} tentou manipular post ${postId} de outro usuário.`);
                return response.status(403).json({
                    success: false,
                    message: 'Operação negada. Você só pode manipular seus próprios posts.'
                });
            }

            next();
        } catch (error) {
            logger.error('Erro ao verificar propriedade do post', error);
            return response.status(500).json({ success: false, message: 'Erro interno ao validar permissão.' });
        }
    }

    async verifyReelOwnership(request, response, next) {
        const { reelId } = request.params;
        const userId = request.user.id;

        try {
            const query = 'SELECT reel_author_user_id FROM reels WHERE reel_identification = $1';
            const result = await database.query(query, [reelId]);

            if (result.rows.length === 0) {
                return response.status(404).json({
                    success: false,
                    message: 'O reel especificado não existe.'
                });
            }

            if (result.rows[0].reel_author_user_id !== userId) {
                logger.security(`Usuário ${userId} tentou manipular reel ${reelId} de outro usuário.`);
                return response.status(403).json({
                    success: false,
                    message: 'Operação negada. Você só pode manipular seus próprios reels.'
                });
            }

            next();
        } catch (error) {
            logger.error('Erro ao verificar propriedade do reel', error);
            return response.status(500).json({ success: false, message: 'Erro interno ao validar permissão.' });
        }
    }

    async verifyCommentOwnership(request, response, next) {
        const { commentId } = request.params;
        const userId = request.user.id;

        try {
            const query = 'SELECT comment_author_user_id FROM comments WHERE comment_identification = $1';
            const result = await database.query(query, [commentId]);

            if (result.rows.length === 0) {
                return response.status(404).json({
                    success: false,
                    message: 'O comentário especificado não existe.'
                });
            }

            if (result.rows[0].comment_author_user_id !== userId) {
                logger.security(`Usuário ${userId} tentou manipular comentário ${commentId} de outro usuário.`);
                return response.status(403).json({
                    success: false,
                    message: 'Operação negada. Você só pode manipular seus próprios comentários.'
                });
            }

            next();
        } catch (error) {
            logger.error('Erro ao verificar propriedade do comentário', error);
            return response.status(500).json({ success: false, message: 'Erro interno ao validar permissão.' });
        }
    }

    async checkAccountIntegrity(request, response, next) {
        const userId = request.user.id;
        try {
            const query = 'SELECT user_email_address FROM users WHERE user_identification = $1';
            const result = await database.query(query, [userId]);

            if (result.rows.length === 0) {
                return response.status(401).json({ success: false, message: 'Sessão inválida. Conta não encontrada.' });
            }
            next();
        } catch (error) {
            next(error);
        }
    }

    async limitConcurrentSessions(request, response, next) {
        next();
    }

    async validateIdToken(request, response, next) {
        const authHeader = request.headers.authorization;
        if (!authHeader) return response.status(401).json({ success: false, message: 'Token requerido' });
        next();
    }

    async checkMaintenanceMode(request, response, next) {
        const isMaintenance = process.env.SYSTEM_MAINTENANCE_MODE === 'true';
        if (isMaintenance) {
            return response.status(503).json({
                success: false,
                message: 'O VlogStudents está em manutenção programada para melhorias. Voltamos logo!',
                estimated_return: '2h'
            });
        }
        next();
    }

    requireSsl(request, response, next) {
        if (!request.secure && process.env.NODE_ENV === 'production') {
            return response.status(403).json({
                success: false,
                message: 'Conexão insegura detectada. HTTPS é obrigatório para esta operação.'
            });
        }
        next();
    }

    async auditRequest(request, response, next) {
        const start = Date.now();
        response.on('finish', () => {
            const duration = Date.now() - start;
            if (duration > 2000) {
                logger.warn(`Requisição lenta auditada: ${request.method} ${request.originalUrl} levou ${duration}ms`);
            }
        });
        next();
    }

    checkInternalSecurityKey(request, response, next) {
        const internalKey = request.headers['x-vlog-internal-key'];
        if (internalKey !== process.env.VLOG_INTERNAL_SERVICE_KEY) {
            logger.security('Tentativa de acesso interno sem chave válida.');
            return response.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        next();
    }

    async preventBruteForce(request, response, next) {
        next();
    }

    async validateUserUniversityEmail(request, response, next) {
        const email = request.user.email;
        if (!email.endsWith('.edu') && !email.endsWith('.br')) {
            logger.warn(`Aviso: Usuário ${email} autenticado sem e-mail educacional padrão.`);
        }
        next();
    }

    async enforcePasswordReset(request, response, next) {
        next();
    }

    async checkIpBlacklist(request, response, next) {
        const clientIp = request.ip;
        const blacklistedIps = [];
        if (blacklistedIps.includes(clientIp)) {
            return response.status(403).json({ success: false, message: 'Seu IP foi bloqueado por atividades suspeitas.' });
        }
        next();
    }

    async validateReferralOwnership(request, response, next) {
        const { referralId } = request.params;
        const userId = request.user.id;
        try {
            const query = 'SELECT referral_owner_user_id FROM referrals WHERE referral_identification = $1';
            const result = await database.query(query, [referralId]);
            if (result.rows.length > 0 && result.rows[0].referral_owner_user_id !== userId) {
                return response.status(403).json({ success: false, message: 'Você não tem permissão sobre este convite.' });
            }
            next();
        } catch (error) {
            next(error);
        }
    }

    async checkMediaAccessPermissions(request, response, next) {
        next();
    }

    async logUserActivity(request, response, next) {
        if (request.user) {
            const query = 'UPDATE users SET user_last_login_timestamp = NOW() WHERE user_identification = $1';
            await database.query(query, [request.user.id]);
        }
        next();
    }

    async validateSessionIntegrity(request, response, next) {
        next();
    }

    async verifyChatMembership(request, response, next) {
        const { roomId } = request.params;
        const userId = request.user.id;
        try {
            const query = 'SELECT 1 FROM chat_room_members WHERE member_chat_room_id = $1 AND member_user_id = $2';
            const result = await database.query(query, [roomId, userId]);
            if (result.rows.length === 0) {
                return response.status(403).json({ success: false, message: 'Você não faz parte desta sala de chat.' });
            }
            next();
        } catch (error) {
            next(error);
        }
    }

    async checkAccountAge(request, response, next) {
        next();
    }

    async validatePointsTransaction(request, response, next) {
        next();
    }

    async monitorSuspiciousPayloads(request, response, next) {
        const payload = JSON.stringify(request.body);
        const suspiciousPatterns = ['<script>', 'DROP TABLE', 'OR 1=1', 'union select'];
        if (suspiciousPatterns.some(pattern => payload.toLowerCase().includes(pattern))) {
            logger.critical(`Injeção detectada vinda do IP ${request.ip}`);
            return response.status(400).json({ success: false, message: 'Payload contém caracteres ou padrões proibidos.' });
        }
        next();
    }

    async verifyCallPermissions(request, response, next) {
        const { roomId } = request.params;
        const userId = request.user.id;
        try {
            const query = 'SELECT 1 FROM chat_room_members WHERE member_chat_room_id = $1 AND member_user_id = $2';
            const result = await database.query(query, [roomId, userId]);
            if (result.rows.length === 0) {
                return response.status(403).json({ success: false, message: 'Permissão para chamada negada.' });
            }
            next();
        } catch (error) {
            next(error);
        }
    }

    async forceUserReauthentication(request, response, next) {
        next();
    }

    async checkDeviceFingerprint(request, response, next) {
        next();
    }

    async validateAppVersion(request, response, next) {
        const appVersion = request.headers['x-app-version'];
        if (!appVersion) {
            logger.warn('Requisição recebida sem cabeçalho de versão do app.');
        }
        next();
    }

    async checkGlobalPrivacySettings(request, response, next) {
        next();
    }

    async verifySecurityCompliance(request, response, next) {
        next();
    }

    async handleSessionTimeout(request, response, next) {
        next();
    }

    async finalizeAuthenticationContext(request, response, next) {
        logger.debug(`Contexto de autenticação finalizado para usuário ${request.user.id}`);
        next();
    }
}

const authMiddlewareInstance = new VlogStudentsAuthenticationMiddleware();

module.exports = {
    authenticate: (req, res, next) => authMiddlewareInstance.authenticate(req, res, next),
    validateGoogle: (req, res, next) => authMiddlewareInstance.validateGoogleSession(req, res, next),
    authorize: (roles) => authMiddlewareInstance.authorizeRoles(roles),
    verifyPostOwner: (req, res, next) => authMiddlewareInstance.verifyPostOwnership(req, res, next),
    verifyReelOwner: (req, res, next) => authMiddlewareInstance.verifyReelOwnership(req, res, next),
    verifyCommentOwner: (req, res, next) => authMiddlewareInstance.verifyCommentOwnership(req, res, next),
    verifyChatMember: (req, res, next) => authMiddlewareInstance.verifyChatMembership(req, res, next),
    checkMaintenance: (req, res, next) => authMiddlewareInstance.checkMaintenanceMode(req, res, next),
    audit: (req, res, next) => authMiddlewareInstance.auditRequest(req, res, next),
    sanitizer: (req, res, next) => authMiddlewareInstance.monitorSuspiciousPayloads(req, res, next),
    instance: authMiddlewareInstance
};

logger.info('VlogStudents Authentication Middleware Layer v1.0.0 carregado.');