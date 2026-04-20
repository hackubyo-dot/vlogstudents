const database = require('../config/database');
const logger = require('../config/logger');

class VlogStudentsChatModel {
    constructor(chatData = {}) {
        this.room_id = chatData.chat_room_identification;
        this.room_name = chatData.chat_room_name_display;
        this.is_group = chatData.chat_room_is_group_chat;
        this.admin_id = chatData.chat_room_admin_user_id;
        this.last_message = chatData.chat_room_last_message_preview;
        this.last_activity = chatData.chat_room_last_activity_timestamp;
        this.created_at = chatData.chat_room_created_at_timestamp;
        this.unread_count = parseInt(chatData.unread_count) || 0;
    }

    static async createPrivateRoom(userA, userB) {
        return await database.transaction(async (client) => {
            const checkQuery = `
                SELECT chat_room_identification FROM chat_rooms
                WHERE chat_room_is_group_chat = FALSE
                AND chat_room_identification IN (
                    SELECT member_chat_room_id FROM chat_room_members WHERE member_user_id = $1
                    INTERSECT
                    SELECT member_chat_room_id FROM chat_room_members WHERE member_user_id = $2
                )
            `;
            const existing = await client.query(checkQuery, [userA, userB]);

            if (existing.rows.length > 0) {
                const roomData = await client.query(`SELECT * FROM chat_rooms WHERE chat_room_identification = $1`, [existing.rows[0].chat_room_identification]);
                return new VlogStudentsChatModel(roomData.rows[0]);
            }

            const insertRoom = `INSERT INTO chat_rooms (chat_room_is_group_chat, chat_room_created_at_timestamp) VALUES (FALSE, NOW()) RETURNING *`;
            const newRoom = await client.query(insertRoom);
            const roomId = newRoom.rows[0].chat_room_identification;

            await client.query(`INSERT INTO chat_room_members (member_chat_room_id, member_user_id) VALUES ($1, $2), ($1, $3)`, [roomId, userA, userB]);

            logger.info(`Sala privada de chat criada: ${roomId} entre ${userA} e ${userB}`);
            return new VlogStudentsChatModel(newRoom.rows[0]);
        });
    }

    static async createGroupRoom(adminId, name, participants = []) {
        return await database.transaction(async (client) => {
            const insertRoom = `
                INSERT INTO chat_rooms (chat_room_name_display, chat_room_is_group_chat, chat_room_admin_user_id, chat_room_created_at_timestamp)
                VALUES ($1, TRUE, $2, NOW())
                RETURNING *
            `;
            const newRoom = await client.query(insertRoom, [name, adminId]);
            const roomId = newRoom.rows[0].chat_room_identification;

            const membersQuery = `INSERT INTO chat_room_members (member_chat_room_id, member_user_id) VALUES ($1, $2)`;
            await client.query(membersQuery, [roomId, adminId]);

            for (const participantId of participants) {
                await client.query(membersQuery, [roomId, participantId]);
            }

            logger.info(`Grupo de chat '${name}' criado com ${participants.length + 1} membros.`);
            return new VlogStudentsChatModel(newRoom.rows[0]);
        });
    }

    static async findById(roomId) {
        const query = `SELECT * FROM chat_rooms WHERE chat_room_identification = $1`;
        const result = await database.query(query, [roomId]);
        if (result.rows.length === 0) return null;
        return new VlogStudentsChatModel(result.rows[0]);
    }

    async sendMessage(senderId, text, type = 'text', mediaId = null) {
        return await database.transaction(async (client) => {
            const query = `
                INSERT INTO chat_messages (
                    message_chat_room_id,
                    message_sender_user_id,
                    message_text_body,
                    message_type_category,
                    message_media_drive_id,
                    message_created_at_timestamp
                )
                VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING *
            `;
            const result = await client.query(query, [this.room_id, senderId, text, type, mediaId]);

            await client.query(`
                UPDATE chat_rooms
                SET chat_room_last_message_preview = $1, chat_room_last_activity_timestamp = NOW()
                WHERE chat_room_identification = $2
            `, [type === 'text' ? text.substring(0, 50) : `Enviou um(a) ${type}`, this.room_id]);

            return result.rows[0];
        });
    }

    async getMessages(limit = 50, offset = 0) {
        const query = `
            SELECT m.*, u.user_full_name as sender_name, u.user_profile_picture_url as sender_avatar
            FROM chat_messages m
            JOIN users u ON m.message_sender_user_id = u.user_identification
            WHERE m.message_chat_room_id = $1
            ORDER BY m.message_created_at_timestamp DESC
            LIMIT $2 OFFSET $3
        `;
        try {
            const result = await database.query(query, [this.room_id, limit, offset]);
            return result.rows;
        } catch (error) {
            logger.error(`Erro ao carregar historico de mensagens da sala ${this.room_id}`, error);
            throw error;
        }
    }

    async getMembers() {
        const query = `
            SELECT u.user_identification, u.user_full_name, u.user_profile_picture_url, u.user_university_name
            FROM users u
            JOIN chat_room_members crm ON u.user_identification = crm.member_user_id
            WHERE crm.member_chat_room_id = $1
        `;
        try {
            const result = await database.query(query, [this.room_id]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    async addMember(userId) {
        const query = `INSERT INTO chat_room_members (member_chat_room_id, member_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`;
        try {
            await database.query(query, [this.room_id, userId]);
            logger.info(`Usuario ${userId} adicionado a sala ${this.room_id}`);
            return true;
        } catch (error) {
            return false;
        }
    }

    async removeMember(userId) {
        const query = `DELETE FROM chat_room_members WHERE member_chat_room_id = $1 AND member_user_id = $2`;
        try {
            await database.query(query, [this.room_id, userId]);
            logger.info(`Usuario ${userId} removido da sala ${this.room_id}`);
            return true;
        } catch (error) {
            return false;
        }
    }

    async markMessagesAsRead(userId) {
        const query = `
            UPDATE chat_messages
            SET message_is_read_status = TRUE
            WHERE message_chat_room_id = $1 AND message_sender_user_id != $2
        `;
        try {
            await database.query(query, [this.room_id, userId]);
            return true;
        } catch (error) {
            return false;
        }
    }

    static async getUserChats(userId) {
        const query = `
            SELECT cr.*,
            (SELECT COUNT(*) FROM chat_messages cm WHERE cm.message_chat_room_id = cr.chat_room_identification AND cm.message_is_read_status = FALSE AND cm.message_sender_user_id != $1) AS unread_count,
            (SELECT u.user_full_name FROM users u JOIN chat_room_members crm2 ON u.user_identification = crm2.member_user_id WHERE crm2.member_chat_room_id = cr.chat_room_identification AND crm2.member_user_id != $1 LIMIT 1) as other_user_name,
            (SELECT u.user_profile_picture_url FROM users u JOIN chat_room_members crm2 ON u.user_identification = crm2.member_user_id WHERE crm2.member_chat_room_id = cr.chat_room_identification AND crm2.member_user_id != $1 LIMIT 1) as other_user_avatar
            FROM chat_rooms cr
            JOIN chat_room_members crm ON cr.chat_room_identification = crm.member_chat_room_id
            WHERE crm.member_user_id = $1
            ORDER BY cr.chat_room_last_activity_timestamp DESC
        `;
        try {
            const result = await database.query(query, [userId]);
            return result.rows.map(row => new VlogStudentsChatModel(row));
        } catch (error) {
            logger.error(`Erro ao obter lista de chats do usuario ${userId}`, error);
            throw error;
        }
    }

    async startVideoCall(initiatorId, receiverId = null) {
        const query = `
            INSERT INTO video_calls (
                video_call_chat_room_id,
                video_call_initiator_id,
                video_call_receiver_id,
                video_call_status_current,
                video_call_started_at_timestamp
            )
            VALUES ($1, $2, $3, 'pending', NOW())
            RETURNING *
        `;
        try {
            const result = await database.query(query, [this.room_id, initiatorId, receiverId]);
            logger.info(`Chamada de video iniciada na sala ${this.room_id} por ${initiatorId}`);
            return result.rows[0];
        } catch (error) {
            logger.error('Erro ao registrar inicio de videochamada', error);
            throw error;
        }
    }

    async updateCallStatus(callId, status, duration = 0) {
        const query = `
            UPDATE video_calls
            SET video_call_status_current = $1,
                video_call_duration_seconds = $2,
                video_call_ended_at_timestamp = CASE WHEN $1 IN ('finished', 'rejected', 'missed') THEN NOW() ELSE NULL END
            WHERE video_call_identification = $3
            RETURNING *
        `;
        try {
            const result = await database.query(query, [status, duration, callId]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    async getCallHistory(limit = 10) {
        const query = `
            SELECT vc.*, u.user_full_name as initiator_name
            FROM video_calls vc
            JOIN users u ON vc.video_call_initiator_id = u.user_identification
            WHERE vc.video_call_chat_room_id = $1
            ORDER BY vc.video_call_started_at_timestamp DESC
            LIMIT $2
        `;
        const result = await database.query(query, [this.room_id, limit]);
        return result.rows;
    }

    async deleteMessage(messageId, userId) {
        const query = `DELETE FROM chat_messages WHERE message_identification = $1 AND message_sender_user_id = $2`;
        try {
            const result = await database.query(query, [messageId, userId]);
            return result.rowCount > 0;
        } catch (error) {
            return false;
        }
    }

    async clearHistory() {
        const query = `DELETE FROM chat_messages WHERE message_chat_room_id = $1`;
        try {
            await database.query(query, [this.room_id]);
            return true;
        } catch (error) {
            return false;
        }
    }

    async searchMessages(term) {
        const query = `
            SELECT m.*, u.user_full_name
            FROM chat_messages m
            JOIN users u ON m.message_sender_user_id = u.user_identification
            WHERE m.message_chat_room_id = $1 AND m.message_text_body ILIKE $2
            ORDER BY m.message_created_at_timestamp DESC
        `;
        const result = await database.query(query, [this.room_id, `%${term}%`]);
        return result.rows;
    }

    async getMediaMessages() {
        const query = `
            SELECT message_media_drive_id, message_type_category, message_created_at_timestamp
            FROM chat_messages
            WHERE message_chat_room_id = $1 AND message_type_category != 'text'
            ORDER BY message_created_at_timestamp DESC
        `;
        const result = await database.query(query, [this.room_id]);
        return result.rows;
    }

    async updateGroupName(newName) {
        if (!this.is_group) return false;
        const query = `UPDATE chat_rooms SET chat_room_name_display = $1 WHERE chat_room_identification = $2`;
        await database.query(query, [newName, this.room_id]);
        this.room_name = newName;
        return true;
    }

    async transferAdmin(newAdminId) {
        if (!this.is_group) return false;
        const query = `UPDATE chat_rooms SET chat_room_admin_user_id = $1 WHERE chat_room_identification = $2`;
        await database.query(query, [newAdminId, this.room_id]);
        this.admin_id = newAdminId;
        return true;
    }

    async leaveRoom(userId) {
        if (this.admin_id === userId && this.is_group) {
            const members = await this.getMembers();
            if (members.length > 1) {
                const nextAdmin = members.find(m => m.user_identification !== userId);
                await this.transferAdmin(nextAdmin.user_identification);
            }
        }
        return await this.removeMember(userId);
    }

    static async getGlobalStats() {
        const query = `
            SELECT
                (SELECT COUNT(*) FROM chat_rooms) as total_rooms,
                (SELECT COUNT(*) FROM chat_messages) as total_messages,
                (SELECT COUNT(*) FROM video_calls) as total_calls
        `;
        const result = await database.query(query);
        return result.rows[0];
    }

    async getRoomActivity() {
        const query = `
            SELECT COUNT(*) as message_count, DATE(message_created_at_timestamp) as day
            FROM chat_messages
            WHERE message_chat_room_id = $1
            GROUP BY day
            ORDER BY day DESC
            LIMIT 7
        `;
        const result = await database.query(query, [this.room_id]);
        return result.rows;
    }

    async deleteRoom() {
        const query = `DELETE FROM chat_rooms WHERE chat_room_identification = $1`;
        await database.query(query, [this.room_id]);
        return true;
    }

    toJSON() {
        return {
            id: this.room_id,
            name: this.room_name,
            is_group: this.is_group,
            admin_id: this.admin_id,
            last_message: this.last_message,
            last_activity: this.last_activity,
            unread_count: this.unread_count
        };
    }

    static async findByMemberIds(ids = []) {
        return null;
    }

    async pinMessage(messageId) {
        return true;
    }

    async unpinMessage(messageId) {
        return true;
    }

    async getPinnedMessages() {
        return [];
    }

    async updateMemberNickname(userId, nickname) {
        return true;
    }

    static async cleanupOldMessages() {
        const query = `DELETE FROM chat_messages WHERE message_created_at_timestamp < NOW() - INTERVAL '1 year'`;
        return await database.query(query);
    }

    async archive() {
        return true;
    }

    async unarchive() {
        return true;
    }

    async getBlockedMembers() {
        return [];
    }

    async muteRoom(userId, until) {
        return true;
    }

    async unmuteRoom(userId) {
        return true;
    }

    static async auditCommunication() {
        logger.info('Iniciando auditoria de integridade da camada de chat.');
        const result = await database.query('SELECT COUNT(*) FROM chat_messages');
        logger.info(`Historico total de mensagens: ${result.rows[0].count}`);
    }
}

module.exports = VlogStudentsChatModel;

function monitorChatModelIntegrity() {
    logger.info('VlogStudents Chat Model Layer inicializado com suporte a P2P e grupos.');
}

monitorChatModelIntegrity();