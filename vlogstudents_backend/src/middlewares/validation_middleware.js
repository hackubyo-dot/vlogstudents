const { body, query, param, validationResult } = require('express-validator');
const logger = require('../config/logger');
const { AppError } = require('./error_middleware');

class VlogStudentsValidationEngine {
    constructor() {
        this.passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        this.phoneRegex = /^\+?[1-9]\d{1,14}$/;
        this.generalEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    }

    handleValidationResults(request, response, next) {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            const extractedErrors = [];
            errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));
            logger.warn(`Falha de validacao em ${request.originalUrl}: ${JSON.stringify(extractedErrors)}`);
            return response.status(422).json({
                success: false,
                message: 'Dados de entrada invalidos. Verifique os campos.',
                error_code: 'VALIDATION_ERROR',
                details: extractedErrors
            });
        }
        next();
    }

    validateRegistration() {
        return [
            body('fullName').notEmpty().withMessage('O nome completo e obrigatorio.').trim().isLength({ min: 3, max: 100 }),
            body('email').isEmail().withMessage('Informe um endereco de e-mail valido.').normalizeEmail().matches(this.generalEmailRegex).withMessage('O formato do e-mail e invalido.'),
            body('password').matches(this.passwordRegex).withMessage('A senha deve conter no minimo 8 caracteres, maiusculas, minusculas, numeros e simbolos.'),
            body('university').notEmpty().withMessage('A universidade e obrigatoria.'),
            body('referralCode').optional().isAlphanumeric(),
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
            body('fullName').optional().isLength({ min: 3, max: 100 }),
            body('phoneNumber').optional().matches(this.phoneRegex),
            body('university').optional().isLength({ min: 2 }),
            body('biography').optional().isLength({ max: 500 }),
            body('themePreference').optional().isIn(['light', 'dark']),
            this.handleValidationResults
        ];
    }

    validateReelCreation() {
        return [
            body('title').notEmpty().isLength({ max: 100 }),
            body('description').optional().isLength({ max: 1000 }),
            this.handleValidationResults
        ];
    }

    validateCommentCreation() {
        return [
            body('textContent').notEmpty().isLength({ max: 500 }),
            body('targetId').optional().isInt(),
            this.handleValidationResults
        ];
    }

    validateChatRoomCreation() {
        return [
            body('participants').isArray({ min: 1 }),
            body('isGroup').optional().isBoolean(),
            this.handleValidationResults
        ];
    }

    validateChatMessage() {
        return [
            body('roomId').isInt(),
            body('textBody').optional().isString().isLength({ max: 2000 }),
            this.handleValidationResults
        ];
    }

    validatePointTransaction() {
        return [
            body('amount').isInt({ min: 1 }),
            body('reason').notEmpty(),
            this.handleValidationResults
        ];
    }

    validateReferralClaim() {
        return [
            body('invitedEmail').isEmail(),
            body('appliedCode').isAlphanumeric(),
            this.handleValidationResults
        ];
    }

    validatePagination() {
        return [
            query('page').optional().isInt({ min: 1 }),
            query('limit').optional().isInt({ min: 1, max: 100 }),
            this.handleValidationResults
        ];
    }

    validateIdParam(paramName = 'id') {
        return [
            param(paramName).isInt(),
            this.handleValidationResults
        ];
    }

    validateSearchQuery() {
        return [
            query('q').notEmpty().isLength({ min: 2 }),
            this.handleValidationResults
        ];
    }

    validateVideoCall() {
        return [
            body('roomId').isInt(),
            body('action').isIn(['start', 'join', 'end', 'reject']),
            this.handleValidationResults
        ];
    }

    validatePasswordRecovery() {
        return [
            body('email').isEmail(),
            this.handleValidationResults
        ];
    }

    validatePasswordReset() {
        return [
            body('token').notEmpty(),
            body('newPassword').matches(this.passwordRegex),
            this.handleValidationResults
        ];
    }

    validateLikeAction() {
        return [
            body('targetId').isInt(),
            body('targetType').isIn(['post', 'reel', 'comment']),
            this.handleValidationResults
        ];
    }

    validateFollowAction() {
        return [
            body('targetUserId').isInt(),
            this.handleValidationResults
        ];
    }

    validateReportCreation() {
        return [
            body('targetId').isInt(),
            body('targetType').isIn(['post', 'reel', 'comment', 'user']),
            body('reason').notEmpty(),
            this.handleValidationResults
        ];
    }

    validateFeedback() {
        return [
            body('rating').isInt({ min: 1, max: 5 }),
            this.handleValidationResults
        ];
    }

    validateNotifications() {
        return [
            body('pushEnabled').optional().isBoolean(),
            body('emailEnabled').optional().isBoolean(),
            this.handleValidationResults
        ];
    }

    validateTheme() {
        return [
            body('theme').isIn(['light', 'dark']),
            this.handleValidationResults
        ];
    }

    validateEmailUpdate() {
        return [
            body('newEmail').isEmail().matches(this.generalEmailRegex),
            this.handleValidationResults
        ];
    }

    validatePoll() {
        return [
            body('question').notEmpty(),
            body('options').isArray({ min: 2 }),
            this.handleValidationResults
        ];
    }

    validateLocation() {
        return [
            body('latitude').isFloat(),
            body('longitude').isFloat(),
            this.handleValidationResults
        ];
    }

    validateStatus() {
        return [
            body('status').isLength({ max: 50 }),
            this.handleValidationResults
        ];
    }

    validateInvite() {
        return [
            body('groupId').isInt(),
            body('userEmails').isArray(),
            this.handleValidationResults
        ];
    }

    validatePrivacy() {
        return [
            body('isPrivate').isBoolean(),
            this.handleValidationResults
        ];
    }

    validateSecurity() {
        return [
            body('currentPassword').notEmpty(),
            this.handleValidationResults
        ];
    }

    validateUsername() {
        return [
            body('newUsername').isAlphanumeric().isLength({ min: 3 }),
            this.handleValidationResults
        ];
    }

    validateMedia() {
        return [
            query('type').optional().isIn(['image', 'video', 'all']),
            this.handleValidationResults
        ];
    }

    validateReset() {
        return [
            body('email').isEmail(),
            body('code').isLength({ min: 6, max: 6 }),
            body('newPassword').matches(this.passwordRegex),
            this.handleValidationResults
        ];
    }

    validateRegistrationFull() {
        return this.validateRegistration();
    }

    validateLoginFull() {
        return this.validateLogin();
    }

    validateRecovery() {
        return this.validatePasswordRecovery();
    }

    validateVerification() {
        return [
            body('email').isEmail(),
            body('code').isLength({ min: 6, max: 6 }),
            this.handleValidationResults
        ];
    }

    checkIntegrity() {
        logger.info('Engine de Validacao VLOG: Atualizada para aceitar e-mails globais.');
    }
}

const validationEngine = new VlogStudentsValidationEngine();
validationEngine.checkIntegrity();

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
    reset: validationEngine.validateReset(),
    like: validationEngine.validateLikeAction(),
    follow: validationEngine.validateFollowAction(),
    report: validationEngine.validateReportCreation(),
    feedback: validationEngine.validateFeedback(),
    notifications: validationEngine.validateNotifications(),
    theme: validationEngine.validateTheme(),
    emailUpdate: validationEngine.validateEmailUpdate(),
    poll: validationEngine.validatePoll(),
    location: validationEngine.validateLocation(),
    status: validationEngine.validateStatus(),
    invite: validationEngine.validateInvite(),
    privacy: validationEngine.validatePrivacy(),
    security: validationEngine.validateSecurity(),
    usernameUpdate: validationEngine.validateUsername(),
    mediaFilter: validationEngine.validateMedia(),
    verify: validationEngine.validateVerification(),
    instance: validationEngine
};
