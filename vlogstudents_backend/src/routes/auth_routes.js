const express = require('express');
const authController = require('../controllers/auth_controller');
const authMiddleware = require('../middlewares/auth_middleware');
const validation = require('../middlewares/validation_middleware');
const security = require('../config/security');

const authRouter = express.Router();

authRouter.use(authMiddleware.audit);

authRouter.post(
    '/register',
    security.authRateLimit,
    validation.register,
    authController.register
);

authRouter.post(
    '/login',
    security.authRateLimit,
    validation.login,
    authController.login
);

authRouter.post(
    '/google',
    security.generalRateLimit,
    authController.googleSignIn
);

authRouter.post(
    '/recovery',
    security.authRateLimit,
    validation.recovery,
    authController.recoverPassword
);

authRouter.post(
    '/verify-code',
    security.authRateLimit,
    authController.verifyRecoveryCode
);

authRouter.post(
    '/reset-password',
    security.authRateLimit,
    validation.reset,
    authController.resetPassword
);

authRouter.get(
    '/validate',
    authMiddleware.authenticate,
    authController.validateToken
);

authRouter.post(
    '/logout',
    authMiddleware.authenticate,
    authController.logout
);

authRouter.post(
    '/change-password',
    authMiddleware.authenticate,
    validation.security,
    authController.changePassword
);

authRouter.get(
    '/sessions',
    authMiddleware.authenticate,
    authController.getLoginHistory
);

authRouter.get(
    '/check-username/:username',
    authController.checkUsernameAvailability
);

authRouter.delete(
    '/account',
    authMiddleware.authenticate,
    authController.deleteAccount
);

authRouter.get(
    '/referral-code',
    authMiddleware.authenticate,
    authController.getReferralInfo
);

authRouter.post(
    '/resend-welcome',
    security.authRateLimit,
    authController.resendVerificationEmail
);

authRouter.get(
    '/status',
    authMiddleware.authenticate,
    authController.getSessionData
);

authRouter.patch(
    '/mfa',
    authMiddleware.authenticate,
    authController.updateMfaStatus
);

authRouter.get(
    '/security-logs',
    authMiddleware.authenticate,
    authController.getAccountLogs
);

authRouter.post(
    '/refresh-token',
    authMiddleware.authenticate,
    authController.refreshToken
);

authRouter.get(
    '/devices',
    authMiddleware.authenticate,
    authController.getDeviceList
);

authRouter.delete(
    '/devices/:deviceId',
    authMiddleware.authenticate,
    authController.revokeDevice
);

authRouter.post(
    '/export-data-request',
    authMiddleware.authenticate,
    authController.requestDataExport
);

authRouter.get(
    '/method',
    authMiddleware.authenticate,
    authController.getAuthMethod
);

module.exports = authRouter;