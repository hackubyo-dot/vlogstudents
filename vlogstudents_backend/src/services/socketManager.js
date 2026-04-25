/**
 * ============================================================================
 * VLOGSTUDENTS REALTIME ORCHESTRATOR v16.0.0
 * WEBRTC SIGNALING | INSTANT REACTIONS | CHAT HUB
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * ============================================================================
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');

const initializeSocket = (io) => {

    // MIDDLEWARE DE AUTENTICAÇÃO JWT (SECURITY SHIELD)
    io.use((socket, next) => {
        const authHeader = socket.handshake.auth.token || socket.handshake.headers['authorization'];

        if (!authHeader) {
            console.error('[SOCKET_AUTH_FAIL] Token não fornecido.');
            return next(new Error('Authentication error: Token missing'));
        }

        const token = authHeader.replace('Bearer ', '');

        try {
            const decoded = jwt.verify(token, env.JWT_SECRET);
            socket.user = decoded; // Injeta UID do Neon DB no socket
            next();
        } catch (err) {
            console.error('[SOCKET_AUTH_FAIL] Token inválido ou expirado.');
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.user.id;
        console.log(`[REALTIME_CONNECT] UID: ${userId} | SID: ${socket.id}`);

        // 1. CANAL DE NOTIFICAÇÕES PRIVADO (GLOBAL)
        socket.join(`user_${userId}`);

        // 2. HANDSHAKE DE SINCRONIZAÇÃO FLUTTER
        socket.on('vlog_identity_handshake', (data) => {
            console.log(`[REALTIME_SYNC] Sincronizado: ${data.userId}`);
            socket.emit('sync_confirmed', { serverTime: new Date() });
        });

        // 3. ENTRAR EM SALAS DE CHAT (REQUISITO PARA MENSAGENS E TYPING)
        socket.on('join_room', (roomId) => {
            socket.join(`room_${roomId}`);
            console.log(`[CHAT_SYNC] UID ${userId} entrou na sala ${roomId}`);
        });

        // 4. INDICADOR DE DIGITAÇÃO (OPTIMISTIC UX)
        socket.on('vlog_typing_signal', (data) => {
            // data = { targetId: roomId, status: bool }
            socket.to(`room_${data.targetId}`).emit('user_typing', {
                userId: userId,
                status: data.status
            });
        });

        /**
         * ====================================================================
         * MOTOR DE SINALIZAÇÃO WEBRTC (VIDEO CALLS)
         * ====================================================================
         */

        // INICIAR CHAMADA
        socket.on('initiate_video_call', (data) => {
            const { targetUserId, roomId, callerName } = data;
            console.log(`[VIDEO_CALL_INIT] De: ${callerName} Para: ${targetUserId}`);

            io.to(`user_${targetUserId}`).emit('incoming_video_call', {
                roomId,
                callerId: userId,
                callerName
            });
        });

        // RESPOSTA À CHAMADA (ACCEPT/REJECT)
        socket.on('respond_video_call', (data) => {
            const { callerId, accept, roomId } = data;
            console.log(`[VIDEO_CALL_RESPONSE] UID: ${userId} Accept: ${accept}`);

            io.to(`user_${callerId}`).emit('call_response', {
                roomId,
                accept,
                responderId: userId
            });
        });

        // TROCA DE SDP (OFFER/ANSWER)
        socket.on('webrtc_offer', (data) => {
            const { targetId, offer } = data;
            io.to(`user_${targetId}`).emit('webrtc_offer', {
                fromId: userId,
                offer
            });
        });

        socket.on('webrtc_answer', (data) => {
            const { targetId, answer } = data;
            io.to(`user_${targetId}`).emit('webrtc_answer', {
                fromId: userId,
                answer
            });
        });

        // TROCA DE ICE CANDIDATES (NETWORK PATHS)
        socket.on('webrtc_ice_candidate', (data) => {
            const { targetId, candidate } = data;
            io.to(`user_${targetId}`).emit('webrtc_ice_candidate', {
                fromId: userId,
                candidate
            });
        });

        // ENCERRAR CHAMADA
        socket.on('terminate_video_call', (data) => {
            const { roomId, targetId } = data;
            console.log(`[VIDEO_CALL_END] UID: ${userId} encerrou.`);
            
            if (targetId) {
                io.to(`user_${targetId}`).emit('call_ended', { roomId });
            }
            socket.to(`room_${roomId}`).emit('call_ended', { roomId });
        });

        /**
         * ====================================================================
         * REAÇÕES INSTANTÂNEAS (SOCIAL ENGINE)
         * ====================================================================
         */
        socket.on('comment_reaction_push', (data) => {
            // Broadcast das reações em tempo real para quem está no feed
            socket.broadcast.emit('new_reaction', {
                commentId: data.commentId,
                reaction: data.reaction,
                userId: userId
            });
        });

        // 5. DISCONNECT PROTOCOL
        socket.on('disconnect', (reason) => {
            console.log(`[REALTIME_DISCONNECT] UID: ${userId} Offline. Reason: ${reason}`);
        });
    });
};

module.exports = { initializeSocket };
