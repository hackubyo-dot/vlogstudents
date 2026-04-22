const db = require('../config/db');

class ChatController {
    async createRoom(req, res, next) {
        const client = await db.getClient();
        try {
            const { name, participants, isGroup } = req.body; // participants: [id, id]
            await client.query('BEGIN');

            const room = await client.query(
                'INSERT INTO chat_rooms (name, is_group) VALUES ($1, $2) RETURNING id',
                [name || null, isGroup || false]
            );

            const roomId = room.rows[0].id;
            const allParticipants = [...new Set([...participants, req.user.id])];

            for (const userId of allParticipants) {
                await client.query(
                    'INSERT INTO chat_participants (room_id, user_id) VALUES ($1, $2)',
                    [roomId, userId]
                );
            }

            await client.query('COMMIT');
            res.status(201).json({ success: true, roomId });
        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }

    async listRooms(req, res, next) {
        try {
            const result = await db.query(
                `SELECT r.* FROM chat_rooms r
                 JOIN chat_participants p ON r.id = p.room_id
                 WHERE p.user_id = $1 ORDER BY r.last_activity DESC`,
                [req.user.id]
            );
            res.json({ success: true, rooms: result.rows });
        } catch (error) {
            next(error);
        }
    }

    async sendMessage(req, res, next) {
        try {
            const { roomId, content, type, mediaUrl } = req.body;

            const result = await db.query(
                `INSERT INTO chat_messages (room_id, sender_id, content, type, media_url)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [roomId, req.user.id, content, type || 'text', mediaUrl || null]
            );

            // Atualizar preview da sala
            await db.query(
                'UPDATE chat_rooms SET last_message_preview = $1, last_activity = NOW() WHERE id = $2',
                [content.substring(0, 50), roomId]
            );

            res.status(201).json({ success: true, message: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }

    async getMessages(req, res, next) {
        try {
            const { roomId } = req.params;
            const result = await db.query(
                `SELECT m.*, u.full_name as sender_name FROM chat_messages m
                 JOIN users u ON m.sender_id = u.id
                 WHERE m.room_id = $1 ORDER BY m.created_at ASC`,
                [roomId]
            );
            res.json({ success: true, messages: result.rows });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ChatController();