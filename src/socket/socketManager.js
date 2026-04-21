/**
 * ============================================================================
 * VLOGSTUDENTS REALTIME ENGINE (Socket.io)
 * ORQUESTRAÇÃO DE MENSAGENS, CHAMADAS E PRESENÇA
 * ============================================================================
 */

const jwt = require('jsonwebtoken');
const db = require('../config/dbConfig');

const initializeSocket = (io) => {

    // Middleware de Autenticação do Socket
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];

        if (!token) return next(new Error('Auth failed'));

        const cleanToken = token.replace('Bearer ', '');
        try {
            const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.user.id;
        console.log(`[REALTIME_CONNECT] Estudante conectado: ${userId} (SocketID: ${socket.id})`);

        // Join no canal privado do usuário para notificações globais
        socket.join(`user_${userId}`);

        /**
         * Handshake de Identidade (Sincronização com Flutter)
         */
        socket.on('vlog_identity_handshake', (data) => {
            console.log(`[REALTIME_SYNC] Canal master ativo para UID: ${data.userId}`);
        });

        /**
         * Lógica de Chat: Entrar em uma sala específica
         */
        socket.on('join_room', (roomId) => {
            socket.join(`room_${roomId}`);
            console.log(`[CHAT_SYNC] UID ${userId} entrou na sala ${roomId}`);
        });

        /**
         * Sinal de Digitação (Typing Indicator)
         */
        socket.on('vlog_typing_signal', (data) => {
            // data = { targetId (roomId), status (bool) }
            socket.to(`room_${data.targetId}`).emit('user_typing', {
                userId: userId,
                status: data.status
            });
        });

        /**
         * PROTOCOLO DE CHAMADA DE VÍDEO (Sinalização)
         */
        socket.on('initiate_video_call', (data) => {
            const { targetUserId, roomId, callerName } = data;
            console.log(`[VIDEO_CALL] Iniciando chamada: ${callerName} -> ${targetUserId}`);

            // Envia convite para o canal privado do destinatário
            io.to(`user_${targetUserId}`).emit('incoming_video_call', {
                roomId,
                callerId: userId,
                callerName
            });
        });

        socket.on('respond_video_call', (data) => {
            const { roomId, accept, callerId } = data;
            io.to(`user_${callerId}`).emit('call_response', {
                roomId,
                accept,
                responderId: userId
            });
        });

        socket.on('terminate_video_call', (data) => {
            const { roomId } = data;
            io.to(`room_${roomId}`).emit('call_ended', { roomId });
        });

        /**
         * Desconexão
         */
        socket.on('disconnect', () => {
            console.log(`[REALTIME_DISCONNECT] Estudante offline: ${userId}`);
        });
    });
};

module.exports = { initializeSocket };