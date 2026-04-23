/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - REAL-TIME CHAT CONTROLLER v3.0.0 (FULL)
 * PRIVATE ROOMS | MESSAGES | REALTIME READY | SAFE TRANSACTIONS
 * ============================================================================
 */

const db = require('../config/db');

class ChatController {

    /**
     * =========================================================================
     * 🚀 POST /api/v1/chat/rooms/create
     * Cria ou reutiliza sala privada entre dois usuários
     * =========================================================================
     */
    async createOrGetRoom(req, res) {
        const client = await db.getClient();

        try {
            const { targetUserId } = req.body;
            const myId = req.user.id;

            if (!targetUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID do usuário alvo é obrigatório.'
                });
            }

            if (myId == targetUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'Auto-chat não é permitido.'
                });
            }

            await client.query('BEGIN');

            // 🔍 Verifica se já existe sala entre os dois
            const existing = await client.query(
                `SELECT cp1.room_id
                 FROM chat_participants cp1
                 JOIN chat_participants cp2 ON cp1.room_id = cp2.room_id
                 JOIN chat_rooms r ON cp1.room_id = r.id
                 WHERE cp1.user_id = $1 
                 AND cp2.user_id = $2 
                 AND r.is_group = false`,
                [myId, targetUserId]
            );

            if (existing.rowCount > 0) {
                await client.query('COMMIT');

                return res.json({
                    success: true,
                    roomId: existing.rows[0].room_id
                });
            }

            // 🆕 Criar nova sala
            const room = await client.query(
                `INSERT INTO chat_rooms (is_group, last_activity)
                 VALUES (false, NOW())
                 RETURNING id`
            );

            const roomId = room.rows[0].id;

            // 👥 Inserir participantes
            await client.query(
                `INSERT INTO chat_participants (room_id, user_id)
                 VALUES ($1, $2), ($1, $3)`,
                [roomId, myId, targetUserId]
            );

            await client.query('COMMIT');

            console.log(`[CHAT] Sala criada ${roomId}`);

            return res.status(201).json({
                success: true,
                message: 'Sala criada com sucesso.',
                roomId
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('[CHAT_CREATE_ROOM_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao criar sala de chat.',
                details: error.message
            });

        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 📥 GET /api/v1/chat/rooms
     * Lista todas as conversas do usuário
     * =========================================================================
     */
    async getMyRooms(req, res) {
        try {
            const result = await db.query(
                `SELECT 
                    r.*,
                    u.full_name AS other_user_name,
                    u.avatar_url AS other_user_avatar,
                    u.id AS other_user_id

                 FROM chat_rooms r
                 JOIN chat_participants p1 ON r.id = p1.room_id
                 JOIN chat_participants p2 ON r.id = p2.room_id
                 JOIN users u ON p2.user_id = u.id

                 WHERE p1.user_id = $1
                 AND p2.user_id != $1

                 ORDER BY r.last_activity DESC`,
                [req.user.id]
            );

            return res.json({
                success: true,
                data: result.rows
            });

        } catch (error) {
            console.error('[CHAT_GET_ROOMS_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao buscar conversas.'
            });
        }
    }

    /**
     * =========================================================================
     * 💬 GET /api/v1/chat/rooms/:roomId/messages
     * Busca mensagens (últimas 100)
     * =========================================================================
     */
    async getMessages(req, res) {
        try {
            const { roomId } = req.params;

            const result = await db.query(
                `SELECT 
                    m.*,
                    u.full_name AS sender_name
                 FROM chat_messages m
                 JOIN users u ON m.sender_id = u.id
                 WHERE m.room_id = $1
                 ORDER BY m.created_at DESC
                 LIMIT 100`,
                [roomId]
            );

            return res.json({
                success: true,
                data: result.rows.reverse() // mantém ordem cronológica
            });

        } catch (error) {
            console.error('[CHAT_GET_MESSAGES_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao carregar mensagens.'
            });
        }
    }

    /**
     * =========================================================================
     * ✉️ POST /api/v1/chat/messages
     * Envia mensagem
     * =========================================================================
     */
    async sendMessage(req, res) {
        try {
            const { roomId, content } = req.body;
            const senderId = req.user.id;

            if (!roomId || !content) {
                return res.status(400).json({
                    success: false,
                    message: 'roomId e content são obrigatórios.'
                });
            }

            const message = await db.query(
                `INSERT INTO chat_messages (room_id, sender_id, content)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [roomId, senderId, content]
            );

            // 🔄 Atualiza atividade da sala
            await db.query(
                `UPDATE chat_rooms
                 SET last_message_preview = $1,
                     last_activity = NOW()
                 WHERE id = $2`,
                [content.substring(0, 50), roomId]
            );

            return res.status(201).json({
                success: true,
                data: message.rows[0]
            });

        } catch (error) {
            console.error('[CHAT_SEND_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao enviar mensagem.'
            });
        }
    }
}

module.exports = new ChatController();
