/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE REALTIME ORCHESTRATOR v2.0.3
 * PROTOCOLO DE MENSAGENS, SINALIZAÇÃO WEBRTC E GESTÃO DE PRESENÇA
 * ============================================================================
 */

const jwt = require('jsonwebtoken');
const db = require('../config/dbConfig');

const initializeSocket = (io) => {
    
    console.log('[SOCKET_CORE] Barramento Realtime inicializado e aguardando conexões...');

    /**
     * MIDDLEWARE DE SEGURANÇA DO SOCKET
     * Garante que apenas estudantes autenticados entrem no barramento.
     */
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
        
        if (!token) {
            console.error('[SOCKET_AUTH_FAIL] Tentativa de conexão sem token.');
            return next(new Error('Authentication error: Token missing'));
        }

        const cleanToken = token.replace('Bearer ', '');
        try {
            const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
            socket.user = decoded; // Injeta UID, e-mail e nome no socket
            next();
        } catch (err) {
            console.error('[SOCKET_AUTH_FAIL] Token inválido ou expirado.');
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.user.id;
        const userName = socket.user.fullName;

        console.log(`[REALTIME_CONNECT] Estudante conectado: ${userName} (UID: ${userId})`);

        // Join no canal privado do usuário para receber notificações push/global
        socket.join(`user_${userId}`);

        /**
         * HANDSHAKE DE IDENTIDADE
         * Sincroniza o estado do Flutter com o backend pós-conexão.
         */
        socket.on('vlog_identity_handshake', (data) => {
            console.log(`[REALTIME_SYNC] Handshake confirmado para UID: ${data.userId}`);
            // Aqui poderíamos marcar o usuário como "Online" no banco de dados
        });

        /**
         * GESTÃO DE SALAS (ROOMS)
         * O aluno entra nas salas de chat para ouvir mensagens específicas.
         */
        socket.on('join_room', (roomId) => {
            if (!roomId) return;
            socket.join(`room_${roomId}`);
            console.log(`[CHAT_SYNC] UID ${userId} monitorando Sala: ${roomId}`);
        });

        socket.on('leave_room', (roomId) => {
            socket.leave(`room_${roomId}`);
            console.log(`[CHAT_SYNC] UID ${userId} saiu da monitoria da Sala: ${roomId}`);
        });

        /**
         * INDICADOR DE DIGITAÇÃO (Typing Indicator)
         * Fluxo: Flutter -> Socket -> Broadcast para outros membros da sala.
         */
        socket.on('vlog_typing_signal', (data) => {
            const { targetId, status } = data; // targetId é o roomId
            socket.to(`room_${targetId}`).emit('user_typing_update', {
                userId: userId,
                typing: status
            });
        });

        /**
         * ====================================================================
         * PROTOCOLO DE CHAMADA DE VÍDEO (SIGNALING KERNEL)
         * Responsável por conectar os dois pares WebRTC.
         * ====================================================================
         */

        // 1. Iniciar Chamada
        socket.on('initiate_video_call', (data) => {
            const { targetUserId, roomId, callerName, callerAvatar } = data;
            
            console.log(`[VIDEO_CALL_REQUEST] ${callerName} ligando para UID: ${targetUserId}`);

            // Envia o convite via Socket para o canal privado do destinatário
            io.to(`user_${targetUserId}`).emit('incoming_video_call', {
                roomId,
                callerId: userId,
                callerName: callerName,
                callerAvatar: callerAvatar
            });
        });

        // 2. Responder Chamada (Aceitar/Recusar)
        socket.on('respond_video_call', (data) => {
            const { roomId, accept, callerId } = data;
            
            console.log(`[VIDEO_CALL_RESPONSE] UID: ${userId} ${accept ? 'ACEITOU' : 'RECUSOU'} a chamada.`);

            io.to(`user_${callerId}`).emit('call_response', {
                roomId,
                accept,
                responderId: userId
            });
        });

        // 3. Troca de Sinalização WebRTC (Offer/Answer/IceCandidates)
        // Vital para o funcionamento técnico do vídeo no Flutter
        socket.on('webrtc_signal', (data) => {
            const { signal, targetUserId, roomId } = data;
            
            // Repassa o sinal técnico de rede para o outro par
            io.to(`user_${targetUserId}`).emit('receive_webrtc_signal', {
                signal,
                senderId: userId,
                roomId
            });
        });

        // 4. Encerrar Chamada
        socket.on('terminate_video_call', (data) => {
            const { roomId, targetUserId } = data;
            console.log(`[VIDEO_CALL_END] Chamada encerrada na Sala: ${roomId}`);

            if (targetUserId) {
                io.to(`user_${targetUserId}`).emit('call_ended', { roomId });
            }
            io.to(`room_${roomId}`).emit('call_ended', { roomId });
        });

        /**
         * GESTÃO DE DESCONEXÃO
         */
        socket.on('disconnect', (reason) => {
            console.log(`[REALTIME_DISCONNECT] Estudante offline: ${userName} (Motivo: ${reason})`);
        });

        /**
         * TRATAMENTO DE ERROS NO CANAL
         */
        socket.on('error', (err) => {
            console.error(`[SOCKET_ERROR] Falha no pipe de dados UID ${userId}:`, err.message);
        });
    });
};

module.exports = { initializeSocket };
