const express = require('express');
const chatController = require('../controllers/chat_controller');
const authMiddleware = require('../middlewares/auth_middleware');
const validation = require('../middlewares/validation_middleware');
const uploadMiddleware = require('../middlewares/upload_middleware');

const chatRouter = express.Router();

chatRouter.use(authMiddleware.authenticate);

chatRouter.post(
    '/rooms',
    validation.chatRoom,
    chatController.createRoom
);

chatRouter.get(
    '/rooms/my-chats',
    chatController.getMyRooms
);

chatRouter.get(
    '/rooms/:roomId/messages',
    authMiddleware.verifyChatMember,
    chatController.getMessages
);

chatRouter.post(
    '/rooms/:roomId/messages',
    authMiddleware.verifyChatMember,
    uploadMiddleware.chat,
    validation.chatMessage,
    chatController.sendMessage
);

chatRouter.get(
    '/rooms/:roomId/members',
    authMiddleware.verifyChatMember,
    chatController.getMembers
);

chatRouter.post(
    '/rooms/:roomId/members',
    authMiddleware.verifyChatMember,
    chatController.addMember
);

chatRouter.delete(
    '/rooms/:roomId/members',
    authMiddleware.verifyChatMember,
    chatController.removeMember
);

chatRouter.patch(
    '/rooms/:roomId/read',
    authMiddleware.verifyChatMember,
    chatController.markAsRead
);

chatRouter.delete(
    '/messages/:messageId',
    chatController.deleteMessage
);

chatRouter.delete(
    '/rooms/:roomId',
    chatController.deleteRoom
);

chatRouter.post(
    '/rooms/:roomId/call/init',
    authMiddleware.verifyChatMember,
    chatController.initCall
);

chatRouter.patch(
    '/call/:callId/status',
    chatController.updateCallStatus
);

chatRouter.get(
    '/rooms/:roomId/call-history',
    authMiddleware.verifyChatMember,
    chatController.getCallHistory
);

chatRouter.get(
    '/rooms/:roomId/search',
    authMiddleware.verifyChatMember,
    chatController.searchMessages
);

chatRouter.delete(
    '/rooms/:roomId/clear',
    authMiddleware.verifyChatMember,
    chatController.clearHistory
);

chatRouter.get(
    '/rooms/:roomId/media',
    authMiddleware.verifyChatMember,
    chatController.getMediaHistory
);

chatRouter.patch(
    '/rooms/:roomId/name',
    authMiddleware.verifyChatMember,
    chatController.updateRoomName
);

chatRouter.post(
    '/rooms/:roomId/leave',
    chatController.leaveRoom
);

chatRouter.get(
    '/unread-total',
    chatController.getUnreadCount
);

chatRouter.post(
    '/messages/:messageId/pin',
    chatController.pinMessage
);

chatRouter.get(
    '/rooms/:roomId/details',
    authMiddleware.verifyChatMember,
    chatController.getRoomDetails
);

chatRouter.post(
    '/rooms/:roomId/admin-transfer',
    chatController.transferAdmin
);

chatRouter.get(
    '/call/:callId/status',
    chatController.getCallStatus
);

chatRouter.post(
    '/rooms/:roomId/mute',
    chatController.muteRoom
);

chatRouter.post(
    '/rooms/:roomId/unmute',
    chatController.unmuteRoom
);

chatRouter.get(
    '/archived',
    chatController.getArchivedRooms
);

chatRouter.post(
    '/rooms/:roomId/archive',
    chatController.archiveRoom
);

chatRouter.get(
    '/rooms/:roomId/blocked-members',
    chatController.getBlockedMembers
);

chatRouter.get(
    '/messages/:messageId',
    chatController.getMessageById
);

chatRouter.post(
    '/messages/:messageId/forward',
    chatController.forwardMessage
);

chatRouter.get(
    '/rooms/:roomId/group-settings',
    chatController.getGroupSettings
);

chatRouter.patch(
    '/rooms/:roomId/group-settings',
    chatController.updateGroupSettings
);

chatRouter.get(
    '/rooms/:roomId/typing',
    chatController.getTypingUsers
);

module.exports = chatRouter;