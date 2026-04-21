/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE CHAT CONTROLLER v2.0.3
 * PERSISTÊNCIA DE DIÁLOGOS, GESTÃO DE SALAS E UNREAD TRACKING
 * ============================================================================
 */

const db = require('../config/dbConfig');

const chatController = {

    /**
     * Lista todas as salas do usuário (DMs e Grupos)
     * Retorna metadados completos para a lista de chat do Flutter
     */
    getMyRooms: async (req, res) => {
        const userId = req.user.id;
        try {
            console.log(`[CHAT_QUERY] Recuperando salas para UID: ${userId}`);

            const query = `
                SELECT 
                    cr.id as chat_room_identification,
                    cr.name as chat_room_name_display,
                    cr.is_group as chat_room_is_group_chat,
                    cr.last_message_preview as chat_room_last_message_preview,
                    cr.last_activity as chat_room_last_activity_timestamp,
                    cp.unread_count,
                    other_u.full_name as other_user_name,
                    other_u.avatar_url as other_user_avatar,
                    other_u.id as other_user_id
                FROM chat_rooms cr
                JOIN chat_participants cp ON cr.id = cp.room_id
                LEFT JOIN chat_participants other_p ON cr.id = other_p.room_id AND other_p.user_id != $1
                LEFT JOIN users other_u ON other_p.user_id = other_u.id
                WHERE cp.user_id = $1
                ORDER BY cr.last_activity DESC
            `;

            const result = await db.query(query, [userId]);

            res.status(200).json({
                success: true,
                count: result.rows.length,
                data: result.rows
            });

        } catch (error) {
            console.error('[CHAT_CONTROLLER_ERROR] getMyRooms:', error.stack);
            res.status(500).json({ success: false, message: 'Falha ao buscar histórico de conversas.' });
        }
    },

    /**
     * Envia mensagem e sincroniza com Realtime
     */
    sendMessage: async (req, res) => {
        const userId = req.user.id;
        const { roomId } = req.params;
        const { content, type = 'text', mediaId } = req.body;

        if (!content && !mediaId) {
            return res.status(400).json({ success: false, message: 'Mensagem vazia não permitida.' });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // 1. Persistência da Mensagem no Neon
            const msgQuery = `
                INSERT INTO chat_messages (room_id, sender_id, content, type, media_id, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING *
            `;
            const msgRes = await client.query(msgQuery, [roomId, userId, content, type, mediaId]);
            const msg = msgRes.rows[0];

            // 2. Atualização da "Capa" da Sala
            const previewText = type === 'text' ? content.substring(0, 50) : 'Arquivo de mídia';
            await client.query(
                'UPDATE chat_rooms SET last_message_preview = $1, last_activity = NOW() WHERE id = $2',
                [previewText, roomId]
            );

            // 3. Gestão de Notificações Internas (Unread)
            await client.query(
                'UPDATE chat_participants SET unread_count = unread_count + 1 WHERE room_id = $1 AND user_id != $2',
                [roomId, userId]
            );

            await client.query('COMMIT');

            // 4. DISPARO REALTIME MASTER
            const io = req.app.get('io');
            if (io) {
                const realtimePayload = {
                    id: msg.id,
                    roomId: parseInt(roomId),
                    senderId: userId,
                    senderName: req.user.fullName,
                    content: msg.content,
                    type: msg.type,
                    mediaUrl: msg.media_id, // Flutter resolverá o link do Drive
                    timestamp: msg.created_at
                };

                // Emite para todos na sala e para o canal privado do destinatário (para notificações)
                io.to(`room_${roomId}`).emit('receive_new_message', realtimePayload);
            }

            res.status(201).json({
                success: true,
                data: msg
            });

        } catch (error) {
            if (client) await client.query('ROLLBACK');
            console.error('[SEND_MESSAGE_ERROR]', error.stack);
            res.status(500).json({ success: false });
        } finally {
            client.release();
        }
    },

    /**
     * Recupera o histórico de mensagens de uma sala específica
     */
    getMessages: async (req, res) => {
        const { roomId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        try {
            const query = `
                SELECT 
                    m.id as message_identification,
                    m.room_id as message_chat_room_id,
                    m.sender_id as message_sender_user_id,
                    u.full_name as sender_name,
                    u.avatar_url as sender_avatar,
                    m.content as message_text_body,
                    m.type as message_type_category,
                    m.media_id as message_media_drive_id,
                    m.created_at as message_created_at_timestamp,
                    m.is_read as message_is_read_status
                FROM chat_messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.room_id = $1
                ORDER BY m.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [roomId, limit, offset]);

            res.status(200).json({
                success: true,
                data: result.rows
            });

        } catch (error) {
            console.error('[GET_MESSAGES_ERROR]', error.stack);
            res.status(500).json({ success: false });
        }
    },

    /**
     * Protocolo de Criação de Sala DM (Conversa Privada)
     */
    createPrivateRoom: async (req, res) => {
        const myId = req.user.id;
        const { targetUserId } = req.body;

        if (myId == targetUserId) return res.status(400).json({ success: false, message: 'Auto-chat não permitido.' });

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // 1. Verifica se já existe uma sala entre esses dois
            const checkQuery = `
                SELECT room_id FROM chat_participants 
                WHERE user_id IN ($1, $2)
                GROUP BY room_id HAVING COUNT(*) = 2
            `;
            const checkRes = await client.query(checkQuery, [myId, targetUserId]);

            if (checkRes.rows.length > 0) {
                return res.status(200).json({ success: true, data: { roomId: checkRes.rows[0].room_id } });
            }

            // 2. Cria a Sala
            const roomRes = await client.query('INSERT INTO chat_rooms (is_group, created_at) VALUES (false, NOW()) RETURNING id');
            const roomId = roomRes.rows[0].id;

            // 3. Adiciona Participantes
            await client.query('INSERT INTO chat_participants (room_id, user_id) VALUES ($1, $2), ($1, $3)', [roomId, myId, targetUserId]);

            await client.query('COMMIT');
            res.status(201).json({ success: true, data: { roomId } });

        } catch (error) {
            await client.query('ROLLBACK');
            res.status(500).json({ success: false });
        } finally {
            client.release();
        }
    },

    /**
     * Limpa o contador de não lidas (Ação de abrir o chat)
     */
    markAsRead: async (req, res) => {
        const userId = req.user.id;
        const { roomId } = req.params;
        try {
            await db.query(
                'UPDATE chat_participants SET unread_count = 0 WHERE room_id = $1 AND user_id = $2',
                [roomId, userId]
            );
            res.status(200).json({ success: true, message: 'Marcado como lido.' });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    }
};

module.exports = chatController;
