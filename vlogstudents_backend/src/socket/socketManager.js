/**
 * ============================================================================
 * VLOGSTUDENTS REALTIME ENGINE (Socket.io)
 * ORQUESTRAÇÃO DE MENSAGENS, CHAMADAS E PRESENÇA
 * ============================================================================
 */

const jwt = require('jsonwebtoken');
const db = require('../config/db');

const initializeSocket = (io) => {

    /**
     * ============================================================================
     * MIDDLEWARE DE AUTENTICAÇÃO
     * ============================================================================
     */
    io.use((socket, next) => {
        const token =
            socket.handshake.auth.token ||
            socket.handshake.headers['authorization'];

        if (!token) return next(new Error('Auth failed'));

        const cleanToken = token.replace('Bearer ', '');

        try {
            const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            return next(new Error('Invalid token'));
        }
    });

    /**
     * ============================================================================
     * CONEXÃO PRINCIPAL
     * ============================================================================
     */
    io.on('connection', (socket) => {
        const userId = socket.user.id;

        console.log(
            `[REALTIME_CONNECT] Estudante conectado: ${userId} (SocketID: ${socket.id})`
        );

        /**
         * Canal privado do usuário
         */
        socket.join(`user_${userId}`);

        /**
         * ============================================================================
         * HANDSHAKE
         * ============================================================================
         */
        socket.on('vlog_identity_handshake', (data) => {
            console.log(
                `[REALTIME_SYNC] Canal master ativo para UID: ${data.userId}`
            );
        });

        /**
         * ============================================================================
         * CHAT (SALAS)
         * ============================================================================
         */
        socket.on('join_room', (roomId) => {
            socket.join(`room_${roomId}`);
            console.log(
                `[CHAT_SYNC] UID ${userId} entrou na sala ${roomId}`
            );
        });

        /**
         * Indicador de digitação
         */
        socket.on('vlog_typing_signal', (data) => {
            socket.to(`room_${data.targetId}`).emit('user_typing', {
                userId: userId,
                status: data.status,
            });
        });

        /**
         * ============================================================================
         * CHAMADAS DE VÍDEO
         * ============================================================================
         */
        socket.on('initiate_video_call', (data) => {
            const { targetUserId, roomId, callerName } = data;

            console.log(
                `[VIDEO_CALL] Iniciando chamada: ${callerName} -> ${targetUserId}`
            );

            io.to(`user_${targetUserId}`).emit('incoming_video_call', {
                roomId,
                callerId: userId,
                callerName,
            });
        });

        socket.on('respond_video_call', (data) => {
            const { roomId, accept, callerId } = data;

            io.to(`user_${callerId}`).emit('call_response', {
                roomId,
                accept,
                responderId: userId,
            });
        });

        socket.on('terminate_video_call', (data) => {
            const { roomId } = data;

            io.to(`room_${roomId}`).emit('call_ended', { roomId });
        });

        /**
         * ============================================================================
         * CHAMADAS DE VOZ (NOVO - INTEGRADO)
         * ============================================================================
         */
        socket.on('initiate_voice_call', (data) => {
            const { targetUserId, roomId, callerName, callerAvatar } = data;

            console.log(
                `[VOICE_CALL_INIT] De: ${callerName} Para: ${targetUserId}`
            );

            io.to(`user_${targetUserId}`).emit('incoming_voice_call', {
                roomId,
                callerId: userId,
                callerName,
                callerAvatar,
            });
        });

        socket.on('respond_voice_call', (data) => {
            const { roomId, accept, callerId } = data;

            console.log(
                `[VOICE_CALL_RESPONSE] ${userId} respondeu chamada de ${callerId} -> ${accept}`
            );

            io.to(`user_${callerId}`).emit('voice_call_response', {
                roomId,
                accept,
                responderId: userId,
            });
        });

        socket.on('terminate_voice_call', (data) => {
            const { roomId } = data;

            console.log(
                `[VOICE_CALL_END] Sala encerrada: ${roomId}`
            );

            io.to(`room_${roomId}`).emit('voice_call_ended', {
                roomId,
            });
        });

        /**
         * ============================================================================
         * DESCONEXÃO
         * ============================================================================
         */
        socket.on('disconnect', () => {
            console.log(
                `[REALTIME_DISCONNECT] Estudante offline: ${userId}`
            );
        });
    });
};

module.exports = { initializeSocket };
