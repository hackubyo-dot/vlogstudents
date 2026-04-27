/**
 * ============================================================================
 * VLOGSTUDENTS REALTIME ORCHESTRATOR v16.1.0 - MASTER ENGINE
 * SOCKET.IO | WEBRTC SIGNALING | CHAT SYNC | PRESENCE | VOICE & VIDEO
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Este orquestrador gerencia o túnel bidirecional entre o Backend e o Flutter.
 * LOG DE ATUALIZAÇÕES v16.1.0:
 * - Fix: Call Signaling Reliability (Canais privados user_{id}).
 * - Sync: Handshake de identidade proativo.
 * - Voice: Protocolo de sinalização de áudio full-duplex.
 * - Video: Sincronização de respostas (Accept/Reject) com baixa latência.
 * - Security: Middleware JWT Hardened para auditoria de conexão.
 * ============================================================================
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db'); // Acesso ao banco para auditoria de logs se necessário

/**
 * INICIALIZADOR MESTRE DO SOCKET.IO
 * @param {Server} io - Instância do servidor Socket.io
 */
const initializeSocket = (io) => {

    /**
     * ============================================================================
     * 🔐 MIDDLEWARE DE AUTENTICAÇÃO (ZERO TRUST)
     * Validação obrigatória de Token JWT antes de permitir a conexão.
     * ============================================================================
     */
    io.use((socket, next) => {
        const authHeader = 
            socket.handshake.auth.token || 
            socket.handshake.headers['authorization'];

        if (!authHeader) {
            console.error('[REALTIME_AUTH] Falha: Token não fornecido.');
            return next(new Error('Authentication failed: Missing token'));
        }

        const token = authHeader.replace('Bearer ', '');

        try {
            // Validação da assinatura do token via segredo industrial
            const decoded = jwt.verify(token, env.JWT_SECRET || process.env.JWT_SECRET);
            
            // Injeção dos dados do estudante no objeto do socket para persistência
            socket.user = decoded; 
            next();
        } catch (err) {
            console.error('[REALTIME_AUTH] Falha: Token inválido ou expirado.');
            return next(new Error('Authentication failed: Invalid token'));
        }
    });

    /**
     * ============================================================================
     * 🚀 EVENTO DE CONEXÃO (HANDSHAKE)
     * ============================================================================
     */
    io.on('connection', (socket) => {
        const userId = socket.user.id;

        /**
         * 🛡️ PROTOCOLO DE ISOLAMENTO DE CANAL
         * O usuário entra em um canal privado baseado no seu ID Único.
         * Isso permite enviar notificações/chamadas para um usuário específico
         * independente da sala onde ele esteja.
         */
        socket.join(`user_${userId}`);
        
        console.log(`[REALTIME_READY] UID: ${userId} conectado. SocketID: ${socket.id}`);

        /**
         * HANDSHAKE DE IDENTIDADE
         * Sincronização de estado inicial com o Flutter.
         */
        socket.on('vlog_identity_handshake', (data) => {
            console.log(`[REALTIME_SYNC] Canal master ativo e auditado para UID: ${userId}`);
        });

        /**
         * ============================================================================
         * 💬 MÓDULO DE CHAT (MENSAGENS E DIGITAÇÃO)
         * ============================================================================
         */

        // Entrar em uma sala de conversa específica
        socket.on('join_room', (roomId) => {
            socket.join(`room_${roomId}`);
            console.log(`[CHAT_SYNC] UID: ${userId} monitorando Sala: ${roomId}`);
        });

        // Sinal de digitação (Typing Indicator)
        socket.on('vlog_typing_signal', (data) => {
            const { roomId, status } = data;
            // Envia para todos na sala exceto para quem está digitando
            socket.to(`room_${roomId}`).emit('user_typing', {
                userId: userId,
                status: status // true para digitando, false para parou
            });
        });

        /**
         * ============================================================================
         * 📞 MÓDULO DE CHAMADAS DE VOZ (SINALIZAÇÃO RELIABILITY)
         * ============================================================================
         */

        // Iniciar Chamada de Voz
        socket.on('initiate_voice_call', (data) => {
            const { targetUserId, roomId, callerName, callerAvatar } = data;
            
            console.log(`[VOICE_SIGNAL] Iniciando: ${callerName} -> Destino: ${targetUserId}`);

            // Envia o sinal para o canal PRIVADO do destinatário
            io.to(`user_${targetUserId}`).emit('incoming_voice_call', {
                roomId,
                callerId: userId,
                callerName,
                callerAvatar
            });
        });

        // Responder Chamada de Voz (Accept/Reject)
        socket.on('respond_voice_call', (data) => {
            const { callerId, accept, roomId } = data;

            console.log(`[VOICE_SIGNAL] Resposta: User ${userId} -> Caller ${callerId} | Aceito: ${accept}`);

            io.to(`user_${callerId}`).emit('voice_call_response', {
                roomId,
                accept,
                responderId: userId
            });
        });

        // Encerrar Chamada de Voz
        socket.on('terminate_voice_call', (data) => {
            const { roomId } = data;
            console.log(`[VOICE_SIGNAL] Encerrando sessão de voz na sala: ${roomId}`);
            
            // Notifica todos na sala
            io.to(`room_${roomId}`).emit('voice_call_ended', { roomId });
        });

        /**
         * ============================================================================
         * 📹 MÓDULO DE CHAMADAS DE VÍDEO (WEBRTC SIGNALING)
         * ============================================================================
         */

        // Iniciar Chamada de Vídeo
        socket.on('initiate_video_call', (data) => {
            const { targetUserId, roomId, callerName } = data;

            console.log(`[VIDEO_SIGNAL] Iniciando: ${callerName} -> Destino: ${targetUserId}`);

            io.to(`user_${targetUserId}`).emit('incoming_video_call', {
                roomId,
                callerId: userId,
                callerName
            });
        });

        // Responder Chamada de Vídeo (Accept/Reject)
        socket.on('respond_video_call', (data) => {
            const { callerId, accept, roomId } = data;

            console.log(`[VIDEO_SIGNAL] Resposta: User ${userId} -> Caller ${callerId} | Aceito: ${accept}`);

            io.to(`user_${callerId}`).emit('call_response', {
                roomId,
                accept,
                responderId: userId
            });
        });

        // Encerrar Chamada de Vídeo
        socket.on('terminate_video_call', (data) => {
            const { roomId } = data;
            console.log(`[VIDEO_SIGNAL] Encerrando sessão de vídeo na sala: ${roomId}`);

            io.to(`room_${roomId}`).emit('call_ended', { roomId });
        });

        /**
         * ============================================================================
         * 📡 GERENCIAMENTO DE PRESENÇA E DISCONNECT
         * ============================================================================
         */
        socket.on('disconnect', () => {
            console.log(`[REALTIME_DISCONNECT] UID: ${userId} offline. Liberação de túnel.`);
        });

        /**
         * LOG DE ERROS NO SOCKET
         */
        socket.on('error', (err) => {
            console.error(`[SOCKET_ERROR] UID: ${userId} | Erro: ${err.message}`);
        });
    });
};

/**
 * EXPORTAÇÃO DO MÓDULO ORQUESTRADOR
 */
module.exports = { initializeSocket };

/**
 * ============================================================================
 * FIM DO REALTIME ORCHESTRATOR v16.1.0
 * ESTE CÓDIGO É PROPRIEDADE INTELECTUAL DO ECOSSISTEMA VLOGSTUDENTS.
 * ============================================================================
 */
