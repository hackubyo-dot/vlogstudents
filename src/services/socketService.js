// FILE: src/services/socketService.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * VlogStudents Realtime Engine
 * Gerencia conexões WebSocket, autenticação e eventos globais
 */
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

    console.log('[SOCKET] Motor de Realtime inicializado.');

    // Middleware de Autenticação do Socket
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];

      if (!token) return next(new Error('Acesso negado: Token ausente'));

      try {
        const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
        const decoded = jwt.verify(cleanToken, env.JWT_SECRET);
        socket.user = decoded;
        next();
      } catch (err) {
        next(new Error('Acesso negado: Token inválido'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`[SOCKET] Usuário conectado: ${socket.user.id} (SID: ${socket.id})`);

      // Participar de sala privada
      socket.on('join_room', (roomId) => {
        socket.join(`room_${roomId}`);
        console.log(`[SOCKET] User ${socket.user.id} entrou na sala ${roomId}`);
      });

      // Enviar mensagem em tempo real
      socket.on('send_message', (data) => {
        const { roomId, message } = data;
        this.io.to(`room_${roomId}`).emit('new_message', {
          senderId: socket.user.id,
          content: message,
          timestamp: new Date()
        });
      });

      socket.on('disconnect', () => {
        console.log(`[SOCKET] Usuário desconectado: ${socket.id}`);
      });
    });
  }

  // Método utilitário para emitir notificações fora do contexto do socket
  emitToUser(userId, event, data) {
    if (this.io) {
      this.io.emit(`notification_${userId}`, data);
    }
  }
}

module.exports = new SocketService();