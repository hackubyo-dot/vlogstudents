/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - REAL-TIME CHAT CONTROLLER
 * Gestão de Mensagens, Salas Privadas e Participantes
 * ============================================================================
 */
const db = require('../config/db');

class ChatController {
    /**
     * @route   POST /api/v1/chat/rooms/create
     * @desc    Inicia uma nova conversa entre dois estudantes
     */
    async createOrGetRoom(req, res) {
        const client = await db.getClient();
        try {
            const { targetUserId } = req.body;
            const myId = req.user.id;

            if (myId == targetUserId) return res.status(400).json({ message: "Auto-chat não permitido." });

            await client.query('BEGIN');

            // 1. Verificar se já existe uma sala privada entre os dois
            const checkRoom = await client.query(
                `SELECT cp1.room_id 
                 FROM chat_participants cp1
                 JOIN chat_participants cp2 ON cp1.room_id = cp2.room_id
                 JOIN chat_rooms r ON cp1.room_id = r.id
                 WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND r.is_group = false`,
                [myId, targetUserId]
            );

            if (checkRoom.rowCount > 0) {
                await client.query('COMMIT');
                return res.json({ success: true, roomId: checkRoom.rows[0].room_id });
            }

            // 2. Criar Nova Sala
            const newRoom = await client.query(
                'INSERT INTO chat_rooms (is_group, last_activity) VALUES (false, NOW()) RETURNING id'
            );
            const roomId = newRoom.rows[0].id;

            // 3. Vincular Participantes
            await client.query(
                'INSERT INTO chat_participants (room_id, user_id) VALUES ($1, $2), ($1, $3)',
                [roomId, myId, targetUserId]
            );

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                message: 'Canal de chat estabelecido.',
                roomId: roomId
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[CHAT_ROOM_CREATE_ERROR]', error);
            return res.status(500).json({ success: false, message: 'Erro ao criar sala de conversa.' });
        } finally {
            client.release();
        }
    }

    /**
     * @route   GET /api/v1/chat/rooms
     * @desc    Lista todas as conversas ativas do usuário
     */
    async getMyRooms(req, res) {
        try {
            const result = await db.query(
                `SELECT r.*, 
                u.full_name as other_user_name, 
                u.avatar_url as other_user_avatar, 
                u.id as other_user_id
                FROM chat_rooms r
                JOIN chat_participants p1 ON r.id = p1.room_id
                JOIN chat_participants p2 ON r.id = p2.room_id
                JOIN users u ON p2.user_id = u.id
                WHERE p1.user_id = $1 AND p2.user_id != $1
                ORDER BY r.last_activity DESC`,
                [req.user.id]
            );

            return res.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('[CHAT_GET_ROOMS_ERROR]', error);
            return res.status(500).json({ success: false, message: 'Erro ao buscar histórico de conversas.' });
        }
    }

    /**
     * @route   GET /api/v1/chat/rooms/:roomId/messages
     */
    async getMessages(req, res) {
        try {
            const { roomId } = req.params;
            const result = await db.query(
                `SELECT m.*, u.full_name as sender_name 
                 FROM chat_messages m
                 JOIN users u ON m.sender_id = u.id
                 WHERE m.room_id = $1 
                 ORDER BY m.created_at DESC LIMIT 100`,
                [roomId]
            );

            return res.json({
                success: true,
                data: result.rows.reverse()
            });
        } catch (error) {
            console.error('[CHAT_GET_MESSAGES_ERROR]', error);
            return res.status(500).json({ success: false, message: 'Erro ao carregar mensagens.' });
        }
    }
}

module.exports = new ChatController();
