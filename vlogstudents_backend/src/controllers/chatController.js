const db = require('../config/db');

class ChatController {
    /**
     * POST /chat/rooms/create
     * Cria uma sala entre o usuário logado e outro
     */
    async createOrGetRoom(req, res) {
        const client = await db.getClient();
        try {
            const { targetId } = req.body;
            await client.query('BEGIN');

            // Verificar se já existe uma sala privada entre os dois
            const existing = await client.query(
                `SELECT room_id FROM chat_participants cp1
                 JOIN chat_participants cp2 ON cp1.room_id = cp2.room_id
                 WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND
                 (SELECT is_group FROM chat_rooms WHERE id = cp1.room_id) = false`,
                [req.user.id, targetId]
            );

            if (existing.rowCount > 0) {
                await client.query('COMMIT');
                return res.json({ success: true, roomId: existing.rows[0].room_id });
            }

            // Criar nova sala
            const room = await client.query('INSERT INTO chat_rooms (is_group) VALUES (false) RETURNING id');
            const roomId = room.rows[0].id;

            // Adicionar participantes
            await client.query('INSERT INTO chat_participants (room_id, user_id) VALUES ($1, $2), ($1, $3)',
                [roomId, req.user.id, targetId]);

            await client.query('COMMIT');
            res.status(201).json({ success: true, roomId });
        } catch (error) {
            await client.query('ROLLBACK');
            res.status(500).json({ success: false, message: 'Erro ao criar sala de chat.' });
        } finally {
            client.release();
        }
    }

    async getMyRooms(req, res) {
        try {
            const result = await db.query(
                `SELECT r.*,
                u.full_name as other_user_name, u.avatar_url as other_user_avatar, u.id as other_user_id
                FROM chat_rooms r
                JOIN chat_participants p1 ON r.id = p1.room_id
                JOIN chat_participants p2 ON r.id = p2.room_id
                JOIN users u ON p2.user_id = u.id
                WHERE p1.user_id = $1 AND p2.user_id != $1
                ORDER BY r.last_activity DESC`,
                [req.user.id]
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao buscar salas.' });
        }
    }

    async getMessages(req, res) {
        try {
            const { roomId } = req.params;
            const result = await db.query(
                'SELECT * FROM chat_messages WHERE room_id = $1 ORDER BY created_at DESC LIMIT 100',
                [roomId]
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao buscar mensagens.' });
        }
    }

    async sendMessage(req, res) {
        try {
            const { roomId, content } = req.body;
            const result = await db.query(
                'INSERT INTO chat_messages (room_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
                [roomId, req.user.id, content]
            );
            await db.query('UPDATE chat_rooms SET last_message_preview = $1, last_activity = NOW() WHERE id = $2', [content, roomId]);
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao enviar.' });
        }
    }
}

module.exports = new ChatController();