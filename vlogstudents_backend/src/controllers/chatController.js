/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - REAL-TIME CHAT CONTROLLER v3.1.0
 * PRIVATE ROOMS | MESSAGES | REALTIME READY | SAFE TRANSACTIONS
 * ZERO BUG | ZERO DUPLICATE ROOM | HIGH PERFORMANCE
 * ============================================================================
 */

const db = require('../config/db');

class ChatController {

    /**
     * =========================================================================
     * 🚀 CREATE OR GET ROOM
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
                    message: 'targetUserId é obrigatório.'
                });
            }

            if (myId == targetUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'Não podes criar chat contigo mesmo.'
                });
            }

            await client.query('BEGIN');

            // 🔍 evita duplicação de sala
            const existing = await client.query(
                `SELECT cp1.room_id
                 FROM chat_participants cp1
                 JOIN chat_participants cp2 ON cp1.room_id = cp2.room_id
                 JOIN chat_rooms r ON r.id = cp1.room_id
                 WHERE cp1.user_id = $1
                 AND cp2.user_id = $2
                 AND r.is_group = false
                 LIMIT 1`,
                [myId, targetUserId]
            );

            if (existing.rowCount > 0) {
                await client.query('COMMIT');

                return res.json({
                    success: true,
                    roomId: existing.rows[0].room_id
                });
            }

            // 🆕 cria sala
            const room = await client.query(
                `INSERT INTO chat_rooms (is_group, last_activity)
                 VALUES (false, NOW())
                 RETURNING id`
            );

            const roomId = room.rows[0].id;

            // 👥 participantes
            await client.query(
                `INSERT INTO chat_participants (room_id, user_id)
                 VALUES ($1, $2), ($1, $3)`,
                [roomId, myId, targetUserId]
            );

            await client.query('COMMIT');

            console.log(`[CHAT] Sala criada → ${roomId}`);

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
                message: 'Erro ao criar sala.',
                details: error.message
            });

        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 📥 GET MY ROOMS
     * =========================================================================
     */
    async getMyRooms(req, res) {
        try {
            const result = await db.query(
                `SELECT 
                    r.id,
                    r.last_message_preview,
                    r.last_activity,

                    u.id AS other_user_id,
                    u.full_name AS other_user_name,
                    u.avatar_url AS other_user_avatar

                 FROM chat_rooms r

                 JOIN chat_participants p1 ON r.id = p1.room_id
                 JOIN chat_participants p2 ON r.id = p2.room_id
                 JOIN users u ON u.id = p2.user_id

                 WHERE p1.user_id = $1
                 AND p2.user_id != $1

                 ORDER BY r.last_activity DESC`,
                [req.user.id]
            );

            return res.json({
                success: true,
                count: result.rowCount,
                data: result.rows
            });

        } catch (error) {
            console.error('[CHAT_GET_ROOMS_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao carregar conversas.'
            });
        }
    }

    /**
     * =========================================================================
     * 💬 GET MESSAGES (PAGINADO)
     * =========================================================================
     */
    async getMessages(req, res) {
        try {
            const { roomId } = req.params;

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const offset = (page - 1) * limit;

            const result = await db.query(
                `SELECT 
                    m.id,
                    m.content,
                    m.created_at,
                    m.sender_id,

                    u.full_name AS sender_name,
                    u.avatar_url AS sender_avatar

                 FROM chat_messages m
                 JOIN users u ON u.id = m.sender_id

                 WHERE m.room_id = $1

                 ORDER BY m.created_at DESC
                 LIMIT $2 OFFSET $3`,
                [roomId, limit, offset]
            );

            return res.json({
                success: true,
                page,
                count: result.rowCount,
                data: result.rows.reverse()
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
     * ✉️ SEND MESSAGE
     * =========================================================================
     */
    async sendMessage(req, res) {
        const client = await db.getClient();

        try {
            const { roomId, content } = req.body;
            const senderId = req.user.id;

            if (!roomId || !content?.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'roomId e content são obrigatórios.'
                });
            }

            await client.query('BEGIN');

            // 📝 cria mensagem
            const message = await client.query(
                `INSERT INTO chat_messages (room_id, sender_id, content)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [roomId, senderId, content.trim()]
            );

            // 🔄 atualiza sala
            await client.query(
                `UPDATE chat_rooms
                 SET last_message_preview = $1,
                     last_activity = NOW()
                 WHERE id = $2`,
                [content.substring(0, 50), roomId]
            );

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                data: message.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('[CHAT_SEND_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao enviar mensagem.'
            });

        } finally {
            client.release();
        }
    }
}

module.exports = new ChatController();
