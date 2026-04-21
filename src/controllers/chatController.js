/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE CHAT CONTROLLER v2.0.5
 * PERSISTÊNCIA E GESTÃO DE SALAS REALTIME
 * ============================================================================
 */

const db = require('../config/dbConfig');

const chatController = {

    getMyRooms: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT cr.*, cp.unread_count, u.full_name as other_user_name, u.avatar_url as other_user_avatar, u.id as other_user_id
                FROM chat_rooms cr
                JOIN chat_participants cp ON cr.id = cp.room_id
                JOIN chat_participants op ON cr.id = op.room_id AND op.user_id != $1
                JOIN users u ON op.user_id = u.id
                WHERE cp.user_id = $1
                ORDER BY cr.last_activity DESC
            `;
            const result = await db.query(query, [userId]);
            res.status(200).json({ success: true, data: result.rows });
        } catch (error) { res.status(500).json({ success: false }); }
    },

    getMessages: async (req, res) => {
        const { roomId } = req.params;
        try {
            const query = `SELECT * FROM chat_messages WHERE room_id = $1 ORDER BY created_at DESC LIMIT 50`;
            const result = await db.query(query, [roomId]);
            res.status(200).json({ success: true, data: result.rows });
        } catch (error) { res.status(500).json({ success: false }); }
    },

    sendMessage: async (req, res) => {
        const userId = req.user.id;
        const { roomId } = req.params;
        const { content } = req.body;
        try {
            const query = `INSERT INTO chat_messages (room_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *`;
            const result = await db.query(query, [roomId, userId, content]);
            
            await db.query('UPDATE chat_rooms SET last_message_preview = $1, last_activity = NOW() WHERE id = $2', [content, roomId]);
            await db.query('UPDATE chat_participants SET unread_count = unread_count + 1 WHERE room_id = $1 AND user_id != $2', [roomId, userId]);

            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) { res.status(500).json({ success: false }); }
    },

    markAsRead: async (req, res) => {
        const userId = req.user.id;
        const { roomId } = req.params;
        try {
            await db.query('UPDATE chat_participants SET unread_count = 0 WHERE room_id = $1 AND user_id = $2', [roomId, userId]);
            res.json({ success: true });
        } catch (error) { res.status(500).json({ success: false }); }
    },

    createRoom: async (req, res) => {
        const myId = req.user.id;
        const { targetUserId } = req.body;
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            const roomRes = await client.query('INSERT INTO chat_rooms (is_group) VALUES (false) RETURNING id');
            const roomId = roomRes.rows[0].id;
            await client.query('INSERT INTO chat_participants (room_id, user_id) VALUES ($1, $2), ($1, $3)', [roomId, myId, targetUserId]);
            await client.query('COMMIT');
            res.status(201).json({ success: true, data: { id: roomId } });
        } catch (error) { await client.query('ROLLBACK'); res.status(500).json({ success: false }); }
        finally { client.release(); }
    }
};

module.exports = chatController;
