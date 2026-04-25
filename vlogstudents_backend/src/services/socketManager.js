/**
 * ============================================================================
 * VLOGSTUDENTS REALTIME SIGNALING CORE v15.0.0
 * WEBRTC HANDSHAKE | P2P COORDINATION | CALL STATE
 * ============================================================================
 */

const jwt = require('jsonwebtoken');

const initializeSocket = (io) => {
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
        if (!token) return next(new Error('Auth failed'));
        const cleanToken = token.replace('Bearer ', '');
        try {
            const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) { next(new Error('Invalid token')); }
    });

    io.on('connection', (socket) => {
        const userId = socket.user.id;
        socket.join(`user_${userId}`);

        /**
         * MOTOR DE SINALIZAÇÃO WEBRTC
         */

        // 1. Início de Chamada
        socket.on('initiate_video_call', (data) => {
            const { targetUserId, roomId, callerName, callerAvatar } = data;
            console.log(`[WEBRTC] Chamada: ${userId} -> ${targetUserId}`);
            io.to(`user_${targetUserId}`).emit('incoming_video_call', {
                roomId,
                callerId: userId,
                callerName,
                callerAvatar
            });
        });

        // 2. Resposta (Accept/Reject)
        socket.on('respond_video_call', (data) => {
            const { callerId, accept } = data;
            io.to(`user_${callerId}`).emit('call_response', {
                responderId: userId,
                accept
            });
        });

        // 3. Troca de Ofertas SDP (O Coração do WebRTC)
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

        // 4. ICE Candidates (Caminhos de Rede)
        socket.on('webrtc_ice_candidate', (data) => {
            const { targetId, candidate } = data;
            io.to(`user_${targetId}`).emit('webrtc_ice_candidate', {
                fromId: userId,
                candidate
            });
        });

        // 5. Término
        socket.on('terminate_video_call', (data) => {
            const { targetId } = data;
            io.to(`user_${targetId}`).emit('call_ended');
        });

        socket.on('disconnect', () => {
            console.log(`[OFFLINE] User ${userId}`);
        });
    });
};

module.exports = { initializeSocket };
