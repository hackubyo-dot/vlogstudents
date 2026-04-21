const socketIo = require('socket.io');
const logger = require('../config/logger');
const database = require('../config/database');
const security = require('../config/security');

class VlogStudentsSocketService {
    constructor() {
        this.io = null;
        this.onlineUsers = new Map();
        this.activeRooms = new Set();
        this.callSessions = new Map();
    }

    initialize(server) {
        this.io = socketIo(server, {
            cors: {
                origin: ["http://localhost:3000", "https://vlogstudents.onrender.com"],
                methods: ["GET", "POST"],
                credentials: true
            },
            pingTimeout: 30000,
            pingInterval: 10000,
            transports: ['websocket', 'polling']
        });

        logger.info('Servidor WebSocket Socket.io inicializado.');
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);

            socket.on('authenticate_session', (payload) => this.handleAuthentication(socket, payload));
            socket.on('join_chat_room', (payload) => this.handleRoomJoin(socket, payload));
            socket.on('leave_chat_room', (payload) => this.handleRoomLeave(socket, payload));
            socket.on('dispatch_chat_message', (payload) => this.handleMessageDispatch(socket, payload));
            socket.on('typing_indicator', (payload) => this.handleTypingIndicator(socket, payload));

            socket.on('initiate_video_call', (payload) => this.handleCallInitiation(socket, payload));
            socket.on('respond_video_call', (payload) => this.handleCallResponse(socket, payload));
            socket.on('webrtc_signal', (payload) => this.handleWebRTCSignal(socket, payload));
            socket.on('terminate_video_call', (payload) => this.handleCallTermination(socket, payload));

            socket.on('track_reel_view', (payload) => this.handleReelAnalytics(socket, payload));
            socket.on('request_online_status', (payload) => this.handleStatusRequest(socket, payload));

            socket.on('disconnect', () => this.handleDisconnect(socket));
            socket.on('error', (error) => logger.error('Erro no socket:', error));
        });
    }

    handleConnection(socket) {
        logger.info(`Nova tentativa de conexao via socket detectada: ${socket.id}`);
        socket.emit('connection_established', { socketId: socket.id, timestamp: Date.now() });
    }

    async handleAuthentication(socket, payload) {
        const { token, userId } = payload;
        try {
            const decoded = await security.verify(token);
            if (decoded && decoded.id.toString() === userId.toString()) {
                socket.userId = userId;
                this.onlineUsers.set(userId.toString(), socket.id);
                socket.join(`user_channel_${userId}`);

                logger.info(`Usuario ${userId} autenticado no WebSocket. Socket: ${socket.id}`);
                socket.emit('auth_success', { status: 'connected', userId });
                this.broadcastUserStatus(userId, 'online');
            } else {
                throw new Error('Falha na verificacao de identidade do token.');
            }
        } catch (error) {
            logger.security(`Falha na autenticacao de socket para usuario ${userId}: ${error.message}`);
            socket.emit('auth_error', { message: 'Token invalido ou expirado.' });
            socket.disconnect();
        }
    }

    handleRoomJoin(socket, payload) {
        const { roomId, userId } = payload;
        if (!socket.userId) return;

        socket.join(`room_${roomId}`);
        this.activeRooms.add(roomId.toString());

        logger.debug(`Socket ${socket.id} (User ${userId}) entrou na sala ${roomId}`);
        this.io.to(`room_${roomId}`).emit('user_entered_room', { userId, timestamp: Date.now() });
    }

    handleRoomLeave(socket, payload) {
        const { roomId, userId } = payload;
        socket.leave(`room_${roomId}`);
        logger.debug(`Socket ${socket.id} (User ${userId}) saiu da sala ${roomId}`);
        this.io.to(`room_${roomId}`).emit('user_left_room', { userId, timestamp: Date.now() });
    }

    async handleMessageDispatch(socket, payload) {
        const { roomId, message, senderId, type, mediaUrl } = payload;
        if (!socket.userId || socket.userId.toString() !== senderId.toString()) return;

        const messagePacket = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            roomId,
            senderId,
            content: message,
            type: type || 'text',
            mediaUrl: mediaUrl || null,
            timestamp: new Date().toISOString()
        };

        this.io.to(`room_${roomId}`).emit('receive_new_message', messagePacket);
        logger.debug(`Mensagem enviada na sala ${roomId} por ${senderId}`);

        try {
            await this.persistMessageToDatabase(messagePacket);
        } catch (error) {
            logger.error('Falha ao persistir mensagem vinda do socket', error);
        }
    }

    async persistMessageToDatabase(packet) {
        const query = `
            INSERT INTO chat_messages (
                message_chat_room_id,
                message_sender_user_id,
                message_text_body,
                message_type_category,
                message_media_drive_id,
                message_created_at_timestamp
            )
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await database.query(query, [
            packet.roomId,
            packet.senderId,
            packet.content,
            packet.type,
            packet.mediaUrl,
            packet.timestamp
        ]);

        await database.query(`
            UPDATE chat_rooms
            SET chat_room_last_message_preview = $1,
                chat_room_last_activity_timestamp = NOW()
            WHERE chat_room_identification = $2
        `, [packet.type === 'text' ? packet.content.substring(0, 100) : `Enviou um(a) ${packet.type}`, packet.roomId]);
    }

    handleTypingIndicator(socket, payload) {
        const { roomId, userId, isTyping } = payload;
        socket.to(`room_${roomId}`).emit('display_typing', { userId, isTyping });
    }

    handleCallInitiation(socket, payload) {
        const { targetUserId, roomId, callerName, callerAvatar } = payload;
        const targetSocketId = this.onlineUsers.get(targetUserId.toString());

        if (targetSocketId) {
            this.io.to(targetSocketId).emit('incoming_video_call', {
                roomId,
                callerId: socket.userId,
                callerName,
                callerAvatar,
                timestamp: Date.now()
            });
            this.callSessions.set(roomId.toString(), {
                initiatorId: socket.userId,
                receiverId: targetUserId,
                status: 'ringing',
                startTime: Date.now()
            });
            logger.info(`Chamada iniciada na sala ${roomId}: ${socket.userId} -> ${targetUserId}`);
        } else {
            socket.emit('call_error', { message: 'O destinatario esta offline no momento.' });
        }
    }

    handleCallResponse(socket, payload) {
        const { roomId, accept, callerId } = payload;
        const callerSocketId = this.onlineUsers.get(callerId.toString());

        if (callerSocketId) {
            this.io.to(callerSocketId).emit('call_response_received', {
                roomId,
                accept,
                responderId: socket.userId
            });

            if (accept) {
                const session = this.callSessions.get(roomId.toString());
                if (session) session.status = 'active';
                logger.info(`Chamada aceita na sala ${roomId}`);
            } else {
                this.callSessions.delete(roomId.toString());
                logger.info(`Chamada rejeitada na sala ${roomId}`);
            }
        }
    }

    handleWebRTCSignal(socket, payload) {
        const { targetUserId, signal, roomId } = payload;
        const targetSocketId = this.onlineUsers.get(targetUserId.toString());

        if (targetSocketId) {
            this.io.to(targetSocketId).emit('webrtc_signal_received', {
                signal,
                senderId: socket.userId,
                roomId
            });
        }
    }

    handleCallTermination(socket, payload) {
        const { roomId, targetUserId, duration } = payload;
        const targetSocketId = this.onlineUsers.get(targetUserId.toString());

        if (targetSocketId) {
            this.io.to(targetSocketId).emit('call_ended', { roomId, duration });
        }

        this.callSessions.delete(roomId.toString());
        logger.info(`Chamada finalizada na sala ${roomId} apos ${duration}s`);

        this.logCallToDatabase(roomId, socket.userId, targetUserId, duration);
    }

    async logCallToDatabase(roomId, initiatorId, receiverId, duration) {
        const query = `
            INSERT INTO video_calls (
                video_call_chat_room_id,
                video_call_initiator_id,
                video_call_receiver_id,
                video_call_status_current,
                video_call_duration_seconds,
                video_call_started_at_timestamp,
                video_call_ended_at_timestamp
            )
            VALUES ($1, $2, $3, 'finished', $4, NOW() - INTERVAL '${duration} seconds', NOW())
        `;
        try {
            await database.query(query, [roomId, initiatorId, receiverId, duration]);
        } catch (e) {
            logger.error('Erro ao salvar log de videochamada', e);
        }
    }

    handleReelAnalytics(socket, payload) {
        const { reelId, userId } = payload;
        logger.debug(`Reel ${reelId} assistido pelo usuario ${userId} via socket.`);
    }

    handleStatusRequest(socket, payload) {
        const { userId } = payload;
        const isOnline = this.onlineUsers.has(userId.toString());
        socket.emit('user_status_response', { userId, status: isOnline ? 'online' : 'offline' });
    }

    handleDisconnect(socket) {
        if (socket.userId) {
            const userId = socket.userId.toString();
            this.onlineUsers.delete(userId);
            this.broadcastUserStatus(userId, 'offline');
            logger.info(`Usuario ${userId} desconectado. Socket: ${socket.id}`);
        }
    }

    broadcastUserStatus(userId, status) {
        this.io.emit('user_presence_update', { userId, status, timestamp: Date.now() });
    }

    sendNotification(userId, title, body, data = {}) {
        const targetSocketId = this.onlineUsers.get(userId.toString());
        if (targetSocketId) {
            this.io.to(targetSocketId).emit('in_app_notification', {
                title,
                body,
                data,
                timestamp: Date.now()
            });
            return true;
        }
        return false;
    }

    notifyPointsEarned(userId, amount, reason) {
        this.sendNotification(userId, 'Voce ganhou pontos!', `+${amount} VS por ${reason}`, { type: 'points', amount });
    }

    broadcastSystemMessage(message) {
        this.io.emit('system_broadcast', { message, timestamp: Date.now() });
    }

    getOnlineCount() {
        return this.onlineUsers.size;
    }

    isUserOnline(userId) {
        return this.onlineUsers.has(userId.toString());
    }

    getSocketId(userId) {
        return this.onlineUsers.get(userId.toString());
    }

    forceDisconnectUser(userId) {
        const socketId = this.onlineUsers.get(userId.toString());
        if (socketId) {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) socket.disconnect();
        }
    }

    async getRoomParticipants(roomId) {
        const sockets = await this.io.in(`room_${roomId}`).fetchSockets();
        return sockets.map(s => s.userId);
    }

    cleanupInactiveSessions() {
        const now = Date.now();
        for (const [roomId, session] of this.callSessions.entries()) {
            if (session.status === 'ringing' && now - session.startTime > 60000) {
                this.callSessions.delete(roomId);
                this.io.to(`room_${roomId}`).emit('call_timeout');
                logger.info(`Chamada na sala ${roomId} encerrada por timeout.`);
            }
        }
    }

    getMetrics() {
        return {
            onlineUsers: this.onlineUsers.size,
            activeRooms: this.activeRooms.size,
            activeCalls: this.callSessions.size,
            uptime: process.uptime()
        };
    }

    shutdown() {
        logger.info('Encerrando servico WebSocket...');
        this.io.close();
    }
}

const socketServiceInstance = new VlogStudentsSocketService();

setInterval(() => {
    socketServiceInstance.cleanupInactiveSessions();
}, 30000);

module.exports = socketServiceInstance;