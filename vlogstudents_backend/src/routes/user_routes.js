const express = require('express');
const userController = require('../controllers/user_controller');
const authMiddleware = require('../middlewares/auth_middleware');
const validation = require('../middlewares/validation_middleware');
const uploadMiddleware = require('../middlewares/upload_middleware');
const security = require('../config/security');

const userRouter = express.Router();

userRouter.use(authMiddleware.authenticate);
userRouter.use(authMiddleware.audit);

userRouter.get(
    '/profile/:id',
    userController.getProfile
);

userRouter.patch(
    '/profile/update',
    validation.profile,
    userController.updateProfile
);

userRouter.post(
    '/profile/avatar',
    security.uploadRateLimit,
    uploadMiddleware.profile,
    userController.uploadProfilePicture
);

userRouter.post(
    '/social/toggle-follow',
    validation.follow,
    userController.toggleFollow
);

userRouter.get(
    '/:id/followers',
    validation.pagination,
    userController.getFollowers
);

userRouter.get(
    '/:id/following',
    validation.pagination,
    userController.getFollowing
);

userRouter.get(
    '/search',
    validation.search,
    userController.searchUsers
);

userRouter.post(
    '/settings/theme',
    validation.theme,
    userController.setTheme
);

userRouter.get(
    '/points/balance',
    userController.getPointsBalance
);

userRouter.get(
    '/points/history',
    userController.getPointsHistory
);

userRouter.get(
    '/leaderboard/global',
    userController.getLeaderboard
);

userRouter.get(
    '/leaderboard/university',
    userController.getUniversityRanking
);

userRouter.get(
    '/:id/reels',
    userController.getUserReels
);

userRouter.get(
    '/:id/posts',
    userController.getUserPosts
);

userRouter.post(
    '/block',
    validation.block,
    userController.blockUser
);

userRouter.post(
    '/report',
    validation.report,
    userController.reportUser
);

userRouter.get(
    '/referrals/my-list',
    userController.getMyReferrals
);

userRouter.get(
    '/suggestions',
    userController.getSuggestedUsers
);

userRouter.post(
    '/mute',
    validation.mute,
    userController.muteUser
);

userRouter.get(
    '/stats/interactions',
    userController.getInteractions
);

userRouter.get(
    '/verify-university',
    userController.verifyUniversityStatus
);

userRouter.patch(
    '/privacy',
    validation.privacyUpdate,
    userController.updatePrivacySettings
);

userRouter.get(
    '/blocked-list',
    userController.getBlockedUsers
);

userRouter.get(
    '/notifications/settings',
    userController.getNotificationSettings
);

userRouter.patch(
    '/notifications/settings',
    validation.notifications,
    userController.updateNotificationSettings
);

userRouter.post(
    '/export-personal-data',
    userController.exportMyData
);

userRouter.post(
    '/track-visit/:id',
    userController.handleProfileVisit
);

userRouter.get(
    '/active-sessions',
    userController.getActiveSessions
);

userRouter.post(
    '/logo',
    userController.setProfileLogo
);

userRouter.get(
    '/social-metrics',
    userController.getSocialStats
);

userRouter.delete(
    '/deactivate',
    userController.deactivateAccount
);

userRouter.delete(
    '/clear-content',
    userController.deleteMyContent
);

userRouter.get(
    '/badges',
    userController.getSystemBadges
);

userRouter.post(
    '/finalize-setup',
    userController.finalizeProfileSetup
);

module.exports = userRouter;