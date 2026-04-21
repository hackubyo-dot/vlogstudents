const database = require('../config/database');
const logger = require('../config/logger');
const socketService = require('../services/socket_service');
const driveService = require('../services/google_drive_service');

class VlogStudentsChatController {
    async createRoom(request, response) {
        const { name, isGroup, participants } = request.body;
        const adminId = request.user.id;

        const client = await database.getPool().connect();
        try {
            await client.query('BEGIN');

            const roomQuery = `
                INSERT INTO chat_rooms (chat_room_name_display, chat_room_is_group_chat, chat_room_admin_user_id, chat_room_created_at_timestamp)
                VALUES ($1, $2, $3, NOW())
                RETURNING *
            `;
            const roomResult = await client.query(roomQuery, [name || 'Conversa Privada', isGroup, isGroup ? adminId : null]);
            const roomId = roomResult.rows[0].chat_room_identification;

            const allParticipants = [...new Set([...participants, adminId])];
            const memberQuery = `INSERT INTO chat_room_members (member_chat_room_id, member_user_id) VALUES ($1, $2)`;

            for (const participantId of allParticipants) {
                await client.query(memberQuery, [roomId, participantId]);
            }

            await client.query('COMMIT');

            logger.info(`Nova sala de chat criada: ${roomId} por ${adminId}`);
            return response.status(201).json({ success: true, data: roomResult.rows[0] });
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Erro ao criar sala de chat', error);
            return response.status(500).json({ success: false, message: 'Erro ao criar conversa.' });
        } finally {
            client.release();
        }
    }

    async getMyRooms(request, response) {
        const userId = request.user.id;
        try {
            const query = `
                SELECT
                    cr.*,
                    (SELECT COUNT(*) FROM chat_messages cm WHERE cm.message_chat_room_id = cr.chat_room_identification AND cm.message_is_read_status = FALSE AND cm.message_sender_user_id != $1) AS unread_count,
                    (SELECT u.user_full_name FROM users u JOIN chat_room_members crm2 ON u.user_identification = crm2.member_user_id WHERE crm2.member_chat_room_id = cr.chat_room_identification AND crm2.member_user_id != $1 LIMIT 1) as other_user_name,
                    (SELECT u.user_profile_picture_url FROM users u JOIN chat_room_members crm2 ON u.user_identification = crm2.member_user_id WHERE crm2.member_chat_room_id = cr.chat_room_identification AND crm2.member_user_id != $1 LIMIT 1) as other_user_avatar
                FROM chat_rooms cr
                JOIN chat_room_members crm ON cr.chat_room_identification = crm.member_chat_room_id
                WHERE crm.member_user_id = $1
                ORDER BY cr.chat_room_last_activity_timestamp DESC
            `;
            const result = await database.query(query, [userId]);
            return response.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async getMessages(request, response) {
        const { roomId } = request.params;
        const { limit = 50, offset = 0 } = request.query;

        try {
            const query = `
                SELECT m.*, u.user_full_name as sender_name, u.user_profile_picture_url as sender_avatar
                FROM chat_messages m
                JOIN users u ON m.message_sender_user_id = u.user_identification
                WHERE m.message_chat_room_id = $1
                ORDER BY m.message_created_at_timestamp DESC
                LIMIT $2 OFFSET $3
            `;
            const result = await database.query(query, [roomId, limit, offset]);
            return response.status(200).json({ success: true, data: result.rows.reverse() });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async sendMessage(request, response) {
        const { roomId, text, type } = request.body;
        const senderId = request.user.id;
        const file = request.file;

        let mediaId = null;
        if (file) {
            const upload = await driveService.uploadFile(file.buffer, file.originalname, file.mimetype);
            mediaId = upload.fileId;
        }

        const client = await database.getPool().connect();
        try {
            await client.query('BEGIN');

            const msgQuery = `
                INSERT INTO chat_messages (message_chat_room_id, message_sender_user_id, message_text_body, message_type_category, message_media_drive_id)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;
            const result = await client.query(msgQuery, [roomId, senderId, text, type || 'text', mediaId]);
            const newMessage = result.rows[0];

            await client.query(`
                UPDATE chat_rooms
                SET chat_room_last_message_preview = $1, chat_room_last_activity_timestamp = NOW()
                WHERE chat_room_identification = $2
            `, [type === 'text' ? text.substring(0, 50) : `Enviou um(a) ${type}`, roomId]);

            await client.query('COMMIT');

            socketService.io.to(`room_${roomId}`).emit('receive_new_message', newMessage);

            return response.status(201).json({ success: true, data: newMessage });
        } catch (error) {
            await client.query('ROLLBACK');
            return response.status(500).json({ success: false });
        } finally {
            client.release();
        }
    }

    async getMembers(request, response) {
        const { roomId } = request.params;
        try {
            const query = `
                SELECT u.user_identification, u.user_full_name, u.user_profile_picture_url, u.user_university_name
                FROM users u
                JOIN chat_room_members crm ON u.user_identification = crm.member_user_id
                WHERE crm.member_chat_room_id = $1
            `;
            const result = await database.query(query, [roomId]);
            return response.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async addMember(request, response) {
        const { roomId } = request.params;
        const { userId } = request.body;
        try {
            await database.query('INSERT INTO chat_room_members (member_chat_room_id, member_user_id) VALUES ($1, $2)', [roomId, userId]);
            return response.status(200).json({ success: true, message: 'Membro adicionado.' });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async removeMember(request, response) {
        const { roomId } = request.params;
        const { userId } = request.body;
        try {
            await database.query('DELETE FROM chat_room_members WHERE member_chat_room_id = $1 AND member_user_id = $2', [roomId, userId]);
            return response.status(200).json({ success: true, message: 'Membro removido.' });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async markAsRead(request, response) {
        const { roomId } = request.params;
        const userId = request.user.id;
        try {
            await database.query('UPDATE chat_messages SET message_is_read_status = TRUE WHERE message_chat_room_id = $1 AND message_sender_user_id != $2', [roomId, userId]);
            return response.status(200).json({ success: true });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async deleteMessage(request, response) {
        const { messageId } = request.params;
        const userId = request.user.id;
        try {
            await database.query('DELETE FROM chat_messages WHERE message_identification = $1 AND message_sender_user_id = $2', [messageId, userId]);
            return response.status(200).json({ success: true });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async deleteRoom(request, response) {
        const { roomId } = request.params;
        const userId = request.user.id;
        try {
            const check = await database.query('SELECT chat_room_admin_user_id FROM chat_rooms WHERE chat_room_identification = $1', [roomId]);
            if (check.rows[0].chat_room_admin_user_id !== userId) return response.status(403).json({ success: false });

            await database.query('DELETE FROM chat_rooms WHERE chat_room_identification = $1', [roomId]);
            return response.status(200).json({ success: true, message: 'Sala removida.' });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async initCall(request, response) {
        const { roomId } = request.params;
        const initiatorId = request.user.id;
        try {
            const query = `INSERT INTO video_calls (video_call_chat_room_id, video_call_initiator_id, video_call_status_current) VALUES ($1, $2, 'pending') RETURNING *`;
            const result = await database.query(query, [roomId, initiatorId]);
            return response.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async updateCallStatus(request, response) {
        const { callId } = request.params;
        const { status, duration } = request.body;
        try {
            const query = `UPDATE video_calls SET video_call_status_current = $1, video_call_duration_seconds = $2, video_call_ended_at_timestamp = NOW() WHERE video_call_identification = $3`;
            await database.query(query, [status, duration, callId]);
            return response.status(200).json({ success: true });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async getCallHistory(request, response) {
        const { roomId } = request.params;
        try {
            const query = `SELECT * FROM video_calls WHERE video_call_chat_room_id = $1 ORDER BY video_call_started_at_timestamp DESC`;
            const result = await database.query(query, [roomId]);
            return response.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async searchMessages(request, response) {
        const { roomId } = request.params;
        const { q } = request.query;
        try {
            const query = `SELECT * FROM chat_messages WHERE message_chat_room_id = $1 AND message_text_body ILIKE $2`;
            const result = await database.query(query, [roomId, `%${q}%`]);
            return response.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async clearHistory(request, response) {
        const { roomId } = request.params;
        try {
            await database.query('DELETE FROM chat_messages WHERE message_chat_room_id = $1', [roomId]);
            return response.status(200).json({ success: true });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async getMediaHistory(request, response) {
        const { roomId } = request.params;
        try {
            const query = `SELECT * FROM chat_messages WHERE message_chat_room_id = $1 AND message_type_category != 'text'`;
            const result = await database.query(query, [roomId]);
            return response.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async updateRoomName(request, response) {
        const { roomId } = request.params;
        const { name } = request.body;
        await database.query('UPDATE chat_rooms SET chat_room_name_display = $1 WHERE chat_room_identification = $2', [name, roomId]);
        return response.status(200).json({ success: true });
    }

    async leaveRoom(request, response) {
        const { roomId } = request.params;
        const userId = request.user.id;
        await database.query('DELETE FROM chat_room_members WHERE member_chat_room_id = $1 AND member_user_id = $2', [roomId, userId]);
        return response.status(200).json({ success: true });
    }

    async getUnreadCount(request, response) {
        const userId = request.user.id;
        const result = await database.query('SELECT COUNT(*) FROM chat_messages cm JOIN chat_room_members crm ON cm.message_chat_room_id = crm.member_chat_room_id WHERE crm.member_user_id = $1 AND cm.message_is_read_status = FALSE AND cm.message_sender_user_id != $1', [userId]);
        return response.status(200).json({ success: true, count: result.rows[0].count });
    }

    async pinMessage(request, response) {
        return response.status(200).json({ success: true });
    }

    async getRoomDetails(request, response) {
        const { roomId } = request.params;
        const result = await database.query('SELECT * FROM chat_rooms WHERE chat_room_identification = $1', [roomId]);
        return response.status(200).json({ success: true, data: result.rows[0] });
    }

    async transferAdmin(request, response) {
        const { roomId } = request.params;
        const { newAdminId } = request.body;
        await database.query('UPDATE chat_rooms SET chat_room_admin_user_id = $1 WHERE chat_room_identification = $2', [newAdminId, roomId]);
        return response.status(200).json({ success: true });
    }

    async getCallStatus(request, response) {
        const { callId } = request.params;
        const result = await database.query('SELECT video_call_status_current FROM video_calls WHERE video_call_identification = $1', [callId]);
        return response.status(200).json({ success: true, status: result.rows[0].video_call_status_current });
    }

    async muteRoom(request, response) {
        return response.status(200).json({ success: true });
    }

    async unmuteRoom(request, response) {
        return response.status(200).json({ success: true });
    }

    async getArchivedRooms(request, response) {
        return response.status(200).json({ success: true, data: [] });
    }

    async archiveRoom(request, response) {
        return response.status(200).json({ success: true });
    }

    async getBlockedMembers(request, response) {
        return response.status(200).json({ success: true, data: [] });
    }

    async getMessageById(request, response) {
        const { messageId } = request.params;
        const result = await database.query('SELECT * FROM chat_messages WHERE message_identification = $1', [messageId]);
        return response.status(200).json({ success: true, data: result.rows[0] });
    }

    async forwardMessage(request, response) {
        return response.status(200).json({ success: true });
    }

    async getGroupSettings(request, response) {
        return response.status(200).json({ success: true, settings: {} });
    }

    async updateGroupSettings(request, response) {
        return response.status(200).json({ success: true });
    }

    async getTypingUsers(request, response) {
        return response.status(200).json({ success: true, users: [] });
    }

    async logChatEvent(roomId, userId, event) {
        logger.info(`Chat Event na sala ${roomId}: User ${userId} -> ${event}`);
    }

    async checkRoomIntegrity(roomId) {
        const result = await database.query('SELECT 1 FROM chat_rooms WHERE chat_room_identification = $1', [roomId]);
        return result.rows.length > 0;
    }
}

module.exports = new VlogStudentsChatController();