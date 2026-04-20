const { body, query, param, validationResult } = require('express-validator');
const logger = require('../config/logger');
const { AppError } = require('./error_middleware');

class VlogStudentsValidationEngine {
    constructor() {
        this.passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        this.phoneRegex = /^\+?[1-9]\d{1,14}$/;
        this.universityEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(edu|br)$/;
    }

    handleValidationResults(request, response, next) {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            const extractedErrors = [];
            errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

            logger.warn(`Falha de validacao em ${request.originalUrl}: ${JSON.stringify(extractedErrors)}`);

            return response.status(422).json({
                success: false,
                message: 'Dados de entrada invalidos. Verifique os campos e tente novamente.',
                error_code: 'VALIDATION_ERROR',
                details: extractedErrors
            });
        }
        next();
    }

    validateRegistration() {
        return [
            body('fullName').notEmpty().withMessage('O nome completo e obrigatorio.').trim().isLength({ min: 3, max: 100 }).withMessage('O nome deve ter entre 3 e 100 caracteres.'),
            body('email').isEmail().withMessage('Informe um endereco de e-mail valido.').normalizeEmail().matches(this.universityEmailRegex).withMessage('E necessario um e-mail universitario (.edu ou .br).'),
            body('password').matches(this.passwordRegex).withMessage('A senha deve conter no minimo 8 caracteres, incluindo letras maiusculas, minusculas, numeros e caracteres especiais.'),
            body('university').notEmpty().withMessage('A universidade e obrigatoria.').isLength({ min: 2 }).withMessage('Nome da universidade invalido.'),
            body('referralCode').optional().isAlphanumeric().isLength({ min: 5, max: 15 }).withMessage('Codigo de indicacao invalido.'),
            this.handleValidationResults
        ];
    }

    validateLogin() {
        return [
            body('email').isEmail().withMessage('E-mail invalido.').normalizeEmail(),
            body('password').notEmpty().withMessage('A senha e obrigatoria.'),
            this.handleValidationResults
        ];
    }

    validateProfileUpdate() {
        return [
            body('fullName').optional().isLength({ min: 3, max: 100 }).withMessage('Nome muito curto ou longo.'),
            body('phoneNumber').optional().matches(this.phoneRegex).withMessage('Formato de telefone internacional invalido.'),
            body('university').optional().isLength({ min: 2 }),
            body('biography').optional().isLength({ max: 500 }).withMessage('A biografia deve ter no maximo 500 caracteres.'),
            body('themePreference').optional().isIn(['light', 'dark']).withMessage('Tema invalido.'),
            this.handleValidationResults
        ];
    }

    validateReelCreation() {
        return [
            body('title').notEmpty().withMessage('O titulo do Reel e obrigatorio.').isLength({ max: 100 }).withMessage('O titulo nao pode exceder 100 caracteres.'),
            body('description').optional().isLength({ max: 1000 }).withMessage('A descricao do Reel e muito longa.'),
            body('hashtags').optional().isArray().withMessage('Hashtags devem ser enviadas como uma lista.'),
            this.handleValidationResults
        ];
    }

    validateCommentCreation() {
        return [
            body('textContent').notEmpty().withMessage('O conteudo do comentario nao pode estar vazio.').isLength({ max: 500 }).withMessage('O comentario e muito longo.'),
            body('postId').optional().isInt().withMessage('ID do Post invalido.'),
            body('reelId').optional().isInt().withMessage('ID do Reel invalido.'),
            body('parentId').optional().isInt().withMessage('ID do comentario pai invalido.'),
            this.handleValidationResults
        ];
    }

    validateChatRoomCreation() {
        return [
            body('participants').isArray({ min: 1 }).withMessage('E necessario pelo menos um participante para criar um chat.'),
            body('isGroup').optional().isBoolean().withMessage('Campo isGroup deve ser booleano.'),
            body('roomName').optional().isString().isLength({ max: 50 }),
            this.handleValidationResults
        ];
    }

    validateChatMessage() {
        return [
            body('roomId').isInt().withMessage('ID da sala invalido.'),
            body('textBody').optional().isString().isLength({ max: 2000 }).withMessage('A mensagem excedeu o limite de 2000 caracteres.'),
            body('type').optional().isIn(['text', 'image', 'video', 'audio', 'file']),
            this.handleValidationResults
        ];
    }

    validatePointTransaction() {
        return [
            body('amount').isInt({ min: 1 }).withMessage('O valor de pontos deve ser um inteiro positivo.'),
            body('reason').notEmpty().isString().withMessage('O motivo da transacao e obrigatorio.'),
            this.handleValidationResults
        ];
    }

    validateReferralClaim() {
        return [
            body('invitedEmail').isEmail().withMessage('E-mail do convidado invalido.'),
            body('appliedCode').isAlphanumeric().isLength({ min: 5, max: 15 }),
            this.handleValidationResults
        ];
    }

    validatePagination() {
        return [
            query('page').optional().isInt({ min: 1 }).withMessage('Pagina invalida.'),
            query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite de itens invalido.'),
            this.handleValidationResults
        ];
    }

    validateIdParam(paramName = 'id') {
        return [
            param(paramName).isInt().withMessage(`O parametro ${paramName} deve ser um numero inteiro.`),
            this.handleValidationResults
        ];
    }

    validateSearchQuery() {
        return [
            query('q').notEmpty().withMessage('O termo de busca e obrigatorio.').isLength({ min: 2 }),
            this.handleValidationResults
        ];
    }

    validateVideoCall() {
        return [
            body('roomId').isInt().withMessage('ID da sala de video chamada invalido.'),
            body('action').isIn(['start', 'join', 'end', 'reject']).withMessage('Acao de chamada invalida.'),
            this.handleValidationResults
        ];
    }

    validatePasswordRecovery() {
        return [
            body('email').isEmail().withMessage('E-mail invalido para recuperacao.'),
            this.handleValidationResults
        ];
    }

    validatePasswordReset() {
        return [
            body('token').notEmpty().withMessage('Token de recuperacao ausente.'),
            body('newPassword').matches(this.passwordRegex).withMessage('A nova senha nao atende aos requisitos de seguranca.'),
            this.handleValidationResults
        ];
    }

    validateLikeAction() {
        return [
            body('targetId').isInt().withMessage('ID do alvo invalido.'),
            body('targetType').isIn(['post', 'reel', 'comment']).withMessage('Tipo de alvo invalido.'),
            this.handleValidationResults
        ];
    }

    validateFollowAction() {
        return [
            body('targetUserId').isInt().withMessage('ID do usuario alvo invalido.'),
            this.handleValidationResults
        ];
    }

    validateReportCreation() {
        return [
            body('targetId').isInt(),
            body('targetType').isIn(['post', 'reel', 'comment', 'user']),
            body('reason').notEmpty().isLength({ max: 300 }),
            this.handleValidationResults
        ];
    }

    validateUniversityVerification() {
        return [
            body('universityId').notEmpty(),
            body('studentCardImage').optional(),
            this.handleValidationResults
        ];
    }

    validateFeedback() {
        return [
            body('rating').isInt({ min: 1, max: 5 }),
            body('message').optional().isLength({ max: 1000 }),
            this.handleValidationResults
        ];
    }

    validateNotificationSettings() {
        return [
            body('pushEnabled').optional().isBoolean(),
            body('emailEnabled').optional().isBoolean(),
            this.handleValidationResults
        ];
    }

    validateGroupMemberManagement() {
        return [
            body('userId').isInt(),
            body('action').isIn(['add', 'remove', 'make_admin']),
            this.handleValidationResults
        ];
    }

    validateMuteUser() {
        return [
            body('userId').isInt(),
            body('duration').optional().isInt(),
            this.handleValidationResults
        ];
    }

    validateBlockUser() {
        return [
            body('userId').isInt(),
            this.handleValidationResults
        ];
    }

    validateThemeToggle() {
        return [
            body('theme').isIn(['light', 'dark']),
            this.handleValidationResults
        ];
    }

    validateReelInteraction() {
        return [
            body('reelId').isInt(),
            body('action').isIn(['view', 'share', 'download']),
            this.handleValidationResults
        ];
    }

    validatePointsRedemption() {
        return [
            body('rewardId').isInt(),
            this.handleValidationResults
        ];
    }

    validateSecurityCheck() {
        return [
            body('currentPassword').notEmpty(),
            this.handleValidationResults
        ];
    }

    validateEmailUpdate() {
        return [
            body('newEmail').isEmail().matches(this.universityEmailRegex),
            this.handleValidationResults
        ];
    }

    validateUsernameUpdate() {
        return [
            body('newUsername').isAlphanumeric().isLength({ min: 3, max: 30 }),
            this.handleValidationResults
        ];
    }

    validatePollCreation() {
        return [
            body('question').notEmpty(),
            body('options').isArray({ min: 2, max: 5 }),
            this.handleValidationResults
        ];
    }

    validateVote() {
        return [
            body('pollId').isInt(),
            body('optionIndex').isInt(),
            this.handleValidationResults
        ];
    }

    validateLocationTag() {
        return [
            body('latitude').isFloat(),
            body('longitude').isFloat(),
            body('locationName').isString(),
            this.handleValidationResults
        ];
    }

    validateMediaFilter() {
        return [
            query('type').optional().isIn(['image', 'video', 'all']),
            this.handleValidationResults
        ];
    }

    validateStatusUpdate() {
        return [
            body('status').isLength({ max: 50 }),
            this.handleValidationResults
        ];
    }

    validateInviteToGroup() {
        return [
            body('groupId').isInt(),
            body('userEmails').isArray(),
            this.handleValidationResults
        ];
    }

    validatePrivacyUpdate() {
        return [
            body('isPrivate').isBoolean(),
            this.handleValidationResults
        ];
    }

    validateLanguageUpdate() {
        return [
            body('language').isIn(['pt-BR', 'en-US', 'es-ES']),
            this.handleValidationResults
        ];
    }

    validateApiAccess() {
        return [
            header('x-api-key').optional().isString(),
            this.handleValidationResults
        ];
    }

    checkSystemIntegrity() {
        logger.info('Validador de dados VlogStudents pronto para interceptar requisicoes.');
    }
}

const validationEngine = new VlogStudentsValidationEngine();
validationEngine.checkSystemIntegrity();

module.exports = {
    register: validationEngine.validateRegistration(),
    login: validationEngine.validateLogin(),
    profile: validationEngine.validateProfileUpdate(),
    reel: validationEngine.validateReelCreation(),
    comment: validationEngine.validateCommentCreation(),
    chatRoom: validationEngine.validateChatRoomCreation(),
    chatMessage: validationEngine.validateChatMessage(),
    point: validationEngine.validatePointTransaction(),
    referral: validationEngine.validateReferralClaim(),
    pagination: validationEngine.validatePagination(),
    id: (name) => validationEngine.validateIdParam(name),
    search: validationEngine.validateSearchQuery(),
    videoCall: validationEngine.validateVideoCall(),
    recovery: validationEngine.validatePasswordRecovery(),
    reset: validationEngine.validatePasswordReset(),
    like: validationEngine.validateLikeAction(),
    follow: validationEngine.validateFollowAction(),
    report: validationEngine.validateReportCreation(),
    university: validationEngine.validateUniversityVerification(),
    feedback: validationEngine.validateFeedback(),
    notifications: validationEngine.validateNotificationSettings(),
    groupMember: validationEngine.validateGroupMemberManagement(),
    mute: validationEngine.validateMuteUser(),
    block: validationEngine.validateBlockUser(),
    theme: validationEngine.validateThemeToggle(),
    reelInteraction: validationEngine.validateReelInteraction(),
    redemption: validationEngine.validatePointsRedemption(),
    security: validationEngine.validateSecurityCheck(),
    emailUpdate: validationEngine.validateEmailUpdate(),
    usernameUpdate: validationEngine.validateUsernameUpdate(),
    poll: validationEngine.validatePollCreation(),
    vote: validationEngine.validateVote(),
    location: validationEngine.validateLocationTag(),
    mediaFilter: validationEngine.validateMediaFilter(),
    status: validationEngine.validateStatusUpdate(),
    invite: validationEngine.validateInviteToGroup(),
    privacy: validationEngine.validatePrivacyUpdate(),
    language: validationEngine.validateLanguageUpdate(),
    instance: validationEngine
};