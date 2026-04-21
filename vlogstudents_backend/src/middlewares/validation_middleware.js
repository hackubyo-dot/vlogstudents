const { body, query, param, validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * VlogStudents Validation Engine - Enterprise Edition
 * Responsável por garantir a integridade de todos os dados que entram na API.
 */
class VlogStudentsValidationEngine {
    constructor() {
        // Regex para senha forte: Mínimo 8 caracteres, pelo menos uma maiúscula, uma minúscula, um número e um caractere especial
        this.passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

        // Regex para Telefone Internacional (E.164)
        this.phoneRegex = /^\+?[1-9]\d{1,14}$/;

        // Regex de E-mail Permissiva: Aceita qualquer domínio válido globalmente
        this.generalEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    }

    /**
     * Centralizador de resultados de validação
     */
    handleValidationResults(request, response, next) {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            const extractedErrors = [];
            errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

            logger.warn(`Falha de validação em ${request.originalUrl}: ${JSON.stringify(extractedErrors)}`);

            return response.status(422).json({
                success: false,
                message: 'Dados de entrada inválidos. Verifique os campos preenchidos.',
                error_code: 'VALIDATION_ERROR',
                details: extractedErrors
            });
        }
        next();
    }

    // ==========================================
    // AUTENTICAÇÃO E CONTA
    // ==========================================

    validateRegistration() {
        return [
            body('fullName').notEmpty().withMessage('O nome completo é obrigatório.').trim().isLength({ min: 3, max: 100 }),
            body('email')
                .isEmail().withMessage('Informe um endereço de e-mail válido.')
                .normalizeEmail()
                .matches(this.generalEmailRegex).withMessage('O formato do e-mail é inválido.'),
            body('password').matches(this.passwordRegex).withMessage('A senha deve conter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas, números e símbolos.'),
            body('university').notEmpty().withMessage('A instituição de ensino é obrigatória.'),
            body('referralCode').optional().isAlphanumeric().withMessage('Código de indicação inválido.'),
            this.handleValidationResults
        ];
    }

    validateLogin() {
        return [
            body('email').isEmail().withMessage('E-mail inválido.').normalizeEmail(),
            body('password').notEmpty().withMessage('A senha é obrigatória.'),
            this.handleValidationResults
        ];
    }

    validateVerification() {
        return [
            body('email').isEmail().normalizeEmail(),
            body('code').isLength({ min: 6, max: 6 }).withMessage('O código de verificação deve ter 6 dígitos.'),
            this.handleValidationResults
        ];
    }

    validatePasswordRecovery() {
        return [
            body('email').isEmail().withMessage('Informe um e-mail válido para recuperação.'),
            this.handleValidationResults
        ];
    }

    validatePasswordReset() {
        return [
            body('email').optional().isEmail(),
            body('code').optional().isLength({ min: 6, max: 6 }),
            body('token').optional().notEmpty(), // Aceita token (link) ou código
            body('newPassword').matches(this.passwordRegex).withMessage('A nova senha não atende aos critérios de segurança.'),
            this.handleValidationResults
        ];
    }

    // ==========================================
    // PERFIL E CONFIGURAÇÕES
    // ==========================================

    validateProfileUpdate() {
        return [
            body('fullName').optional().trim().isLength({ min: 3, max: 100 }),
            body('phoneNumber').optional().matches(this.phoneRegex).withMessage('Formato de telefone inválido.'),
            body('university').optional().isLength({ min: 2 }),
            body('biography').optional().isLength({ max: 500 }),
            body('themePreference').optional().isIn(['light', 'dark']),
            this.handleValidationResults
        ];
    }

    validateUsernameUpdate() {
        return [
            body('newUsername').isAlphanumeric().isLength({ min: 3, max: 30 }).withMessage('O nome de usuário deve ser alfanumérico.'),
            this.handleValidationResults
        ];
    }

    validateEmailUpdate() {
        return [
            body('newEmail').isEmail().matches(this.generalEmailRegex).withMessage('Informe um novo e-mail válido.'),
            this.handleValidationResults
        ];
    }

    // ==========================================
    // CONTEÚDO (REELS, COMENTÁRIOS, LIKES)
    // ==========================================

    validateReelCreation() {
        return [
            body('title').notEmpty().isLength({ max: 100 }).trim(),
            body('description').optional().isLength({ max: 1000 }),
            this.handleValidationResults
        ];
    }

    validateCommentCreation() {
        return [
            body('textContent').notEmpty().withMessage('O comentário não pode estar vazio.').isLength({ max: 500 }),
            body('targetId').notEmpty().withMessage('ID do alvo é necessário.'),
            this.handleValidationResults
        ];
    }

    validateLikeAction() {
        return [
            body('targetId').notEmpty(),
            body('targetType').isIn(['post', 'reel', 'comment', 'story']),
            this.handleValidationResults
        ];
    }

    // ==========================================
    // COMUNICAÇÃO (CHAT E VIDEO)
    // ==========================================

    validateChatRoomCreation() {
        return [
            body('participants').isArray({ min: 1 }).withMessage('Selecione ao menos um participante.'),
            body('isGroup').optional().isBoolean(),
            this.handleValidationResults
        ];
    }

    validateChatMessage() {
        return [
            body('roomId').notEmpty(),
            body('textBody').notEmpty().isLength({ max: 2000 }),
            this.handleValidationResults
        ];
    }

    validateVideoCall() {
        return [
            body('roomId').notEmpty(),
            body('action').isIn(['start', 'join', 'end', 'reject']),
            this.handleValidationResults
        ];
    }

    // ==========================================
    // UTILITÁRIOS E SISTEMA
    // ==========================================

    validatePagination() {
        return [
            query('page').optional().isInt({ min: 1 }),
            query('limit').optional().isInt({ min: 1, max: 100 }),
            this.handleValidationResults
        ];
    }

    validateIdParam(paramName = 'id') {
        return [
            param(paramName).notEmpty().withMessage(`O parâmetro ${paramName} é obrigatório.`),
            this.handleValidationResults
        ];
    }

    validateSearchQuery() {
        return [
            query('q').notEmpty().isLength({ min: 2 }).withMessage('A busca deve ter pelo menos 2 caracteres.'),
            this.handleValidationResults
        ];
    }

    validatePointTransaction() {
        return [
            body('amount').isInt({ min: 1 }),
            body('reason').notEmpty().trim(),
            this.handleValidationResults
        ];
    }

    validateReportCreation() {
        return [
            body('targetId').notEmpty(),
            body('targetType').isIn(['post', 'reel', 'comment', 'user']),
            body('reason').notEmpty().isLength({ min: 5 }),
            this.handleValidationResults
        ];
    }

    validatePoll() {
        return [
            body('question').notEmpty().isLength({ max: 255 }),
            body('options').isArray({ min: 2, max: 10 }).withMessage('A enquete deve ter entre 2 e 10 opções.'),
            this.handleValidationResults
        ];
    }

    validateLocation() {
        return [
            body('latitude').isFloat({ min: -90, max: 90 }),
            body('longitude').isFloat({ min: -180, max: 180 }),
            this.handleValidationResults
        ];
    }

    checkIntegrity() {
        logger.info('VlogStudents Validation Engine Layer v1.0.0 carregada: E-mails globais habilitados.');
    }
}

const engine = new VlogStudentsValidationEngine();
engine.checkIntegrity();

// Exportação organizada por contexto
module.exports = {
    // Auth
    register: engine.validateRegistration(),
    login: engine.validateLogin(),
    verify: engine.validateVerification(),
    recovery: engine.validatePasswordRecovery(),
    reset: engine.validatePasswordReset(),

    // Perfil
    profile: engine.validateProfileUpdate(),
    usernameUpdate: engine.validateUsernameUpdate(),
    emailUpdate: engine.validateEmailUpdate(),
    theme: [body('theme').isIn(['light', 'dark']), engine.handleValidationResults],
    privacy: [body('isPrivate').isBoolean(), engine.handleValidationResults],
    security: [body('currentPassword').notEmpty(), engine.handleValidationResults],

    // Social & Conteúdo
    reel: engine.validateReelCreation(),
    comment: engine.validateCommentCreation(),
    like: engine.validateLikeAction(),
    follow: [body('targetUserId').notEmpty(), engine.handleValidationResults],
    report: engine.validateReportCreation(),
    poll: engine.validatePoll(),
    status: [body('status').isLength({ max: 50 }), engine.handleValidationResults],
    mediaFilter: [query('type').optional().isIn(['image', 'video', 'all']), engine.handleValidationResults],

    // Comunicação
    chatRoom: engine.validateChatRoomCreation(),
    chatMessage: engine.validateChatMessage(),
    videoCall: engine.validateVideoCall(),
    invite: [body('groupId').notEmpty(), body('userEmails').isArray(), engine.handleValidationResults],

    // Sistema
    pagination: engine.validatePagination(),
    id: (name) => engine.validateIdParam(name),
    search: engine.validateSearchQuery(),
    point: engine.validatePointTransaction(),
    referral: [body('invitedEmail').isEmail(), body('appliedCode').isAlphanumeric(), engine.handleValidationResults],
    feedback: [body('rating').isInt({ min: 1, max: 5 }), engine.handleValidationResults],
    notifications: [body('pushEnabled').optional().isBoolean(), body('emailEnabled').optional().isBoolean(), engine.handleValidationResults],
    location: engine.validateLocation(),

    // Instância
    instance: engine
};
