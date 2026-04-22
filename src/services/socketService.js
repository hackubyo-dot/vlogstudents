const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

class SocketService {
    constructor() {
        this.io = null;
    }

    init(server) {
        this.io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        // Middleware de Autenticação do Socket
        this.io.use((socket, next) => {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error("Auth Error: Token Missing"));

            try {
                const decoded = jwt.verify(token, env.jwtSecret);
                socket.userId = decoded.id;
                next();
            } catch (err) {
                next(new Error("Auth Error: Invalid Token"));
            }
        });

        this.io.on('connection', (socket) => {
            console.log(`[REALTIME] Usuário Conectado: ${socket.userId} (Socket: ${socket.id})`);

            // Entrar em uma sala de chat específica
            socket.on('join_room', (roomId) => {
                socket.join(`room_${roomId}`);
                console.log(`[CHAT] Usuário ${socket.userId} entrou na sala ${roomId}`);
            });

            // Sair de uma sala
            socket.on('leave_room', (roomId) => {
                socket.leave(`room_${roomId}`);
                console.log(`[CHAT] Usuário ${socket.userId} saiu da sala ${roomId}`);
            });

            // Evento de "Digitando..."
            socket.on('typing', (data) => {
                // data: { roomId, isTyping: true/false }
                socket.to(`room_${data.roomId}`).emit('user_typing', {
                    userId: socket.userId,
                    isTyping: data.isTyping
                });
            });

            socket.on('disconnect', () => {
                console.log(`[REALTIME] Usuário Desconectado: ${socket.id}`);
            });
        });
    }

    /**
     * Envia uma mensagem em tempo real para uma sala
     * @param {String} roomId
     * @param {Object} messagePayload
     */
    emitNewMessage(roomId, messagePayload) {
        if (this.io) {
            this.io.to(`room_${roomId}`).emit('new_message', messagePayload);
        }
    }

    /**
     * Notificação Global ou de Sistema
     */
    emitNotification(userId, data) {
        if (this.io) {
            // Envia para o socket específico do usuário (se estiver conectado)
            this.io.emit(`notification_${userId}`, data);
        }
    }
}

module.exports = new SocketService();