const express = require('express');
const reelController = require('../controllers/reel_controller');
const authMiddleware = require('../middlewares/auth_middleware');
const validation = require('../middlewares/validation_middleware');
const uploadMiddleware = require('../middlewares/upload_middleware');
const security = require('../config/security');

const reelRouter = express.Router();

reelRouter.use(authMiddleware.authenticate);

reelRouter.post(
    '/publish',
    security.uploadRateLimit,
    uploadMiddleware.reel,
    validation.reel,
    reelController.createReel
);

reelRouter.get(
    '/feed',
    validation.pagination,
    reelController.getFeed
);

reelRouter.get(
    '/trending',
    reelController.getTrending
);

reelRouter.post(
    '/:id/view',
    reelController.trackView
);

reelRouter.post(
    '/:id/like',
    reelController.toggleLike
);

reelRouter.post(
    '/:id/comment',
    validation.comment,
    reelController.addComment
);

reelRouter.get(
    '/:id/comments',
    reelController.getComments
);

reelRouter.post(
    '/:id/repost',
    reelController.repost
);

reelRouter.delete(
    '/:id',
    authMiddleware.verifyReelOwner,
    reelController.deleteReel
);

reelRouter.get(
    '/author/:authorId',
    reelController.getAuthorReels
);

reelRouter.get(
    '/search/hashtag',
    reelController.searchByHashtag
);

reelRouter.patch(
    '/:id/metadata',
    authMiddleware.verifyReelOwner,
    reelController.updateMetadata
);

reelRouter.get(
    '/:id/stats',
    reelController.getReelStats
);

reelRouter.get(
    '/:id/download',
    reelController.downloadReel
);

reelRouter.get(
    '/recommendations',
    reelController.getRecommendations
);

reelRouter.patch(
    '/:id/hide',
    authMiddleware.verifyReelOwner,
    reelController.hideReel
);

reelRouter.get(
    '/:id/share-link',
    reelController.shareReel
);

reelRouter.get(
    '/university/:university',
    reelController.getReelsByUniversity
);

reelRouter.get(
    '/:id/thumbnail',
    reelController.getThumbnail
);

reelRouter.post(
    '/bulk-delete',
    reelController.bulkDelete
);

reelRouter.get(
    '/most-viewed',
    reelController.getMostViewed
);

reelRouter.get(
    '/:id/check-owner',
    reelController.verifyReelOwnership
);

reelRouter.post(
    '/:id/report',
    reelController.reportReel
);

reelRouter.get(
    '/duration-avg',
    reelController.getDurationAverage
);

reelRouter.post(
    '/archive',
    reelController.archiveReel
);

module.exports = reelRouter;