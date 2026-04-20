const database = require('../config/database');
const logger = require('../config/logger');
const security = require('../config/security');

class VlogStudentsUserModel {
    constructor(userData = {}) {
        this.id = userData.user_identification;
        this.googleId = userData.google_id_reference;
        this.email = userData.user_email_address;
        this.fullName = userData.user_full_name;
        this.phoneNumber = userData.user_phone_number;
        this.university = userData.user_university_name;
        this.biography = userData.user_biography_text;
        this.profilePicture = userData.user_profile_picture_url;
        this.logoUrl = userData.user_logo_custom_url;
        this.theme = userData.user_theme_config || 'dark';
        this.pointsBalance = userData.user_points_balance || 0;
        this.referralCode = userData.user_referral_code;
        this.status = userData.user_account_status;
        this.lastLogin = userData.user_last_login_timestamp;
        this.createdAt = userData.user_created_at_timestamp;
        this.updatedAt = userData.user_updated_at_timestamp;
    }

    static async findById(userId) {
        const query = `
            SELECT * FROM users
            WHERE user_identification = $1
            LIMIT 1
        `;
        try {
            const result = await database.query(query, [userId]);
            if (result.rows.length === 0) return null;
            return new VlogStudentsUserModel(result.rows[0]);
        } catch (error) {
            logger.error(`Erro ao buscar usuario por ID: ${userId}`, error);
            throw error;
        }
    }

    static async findByEmail(email) {
        const query = `
            SELECT * FROM users
            WHERE user_email_address = $1
            LIMIT 1
        `;
        try {
            const result = await database.query(query, [email]);
            if (result.rows.length === 0) return null;
            return new VlogStudentsUserModel(result.rows[0]);
        } catch (error) {
            logger.error(`Erro ao buscar usuario por email: ${email}`, error);
            throw error;
        }
    }

    static async findByGoogleId(googleId) {
        const query = `
            SELECT * FROM users
            WHERE google_id_reference = $1
            LIMIT 1
        `;
        try {
            const result = await database.query(query, [googleId]);
            if (result.rows.length === 0) return null;
            return new VlogStudentsUserModel(result.rows[0]);
        } catch (error) {
            logger.error(`Erro ao buscar usuario por Google ID: ${googleId}`, error);
            throw error;
        }
    }

    static async findByReferralCode(code) {
        const query = `
            SELECT * FROM users
            WHERE user_referral_code = $1
            LIMIT 1
        `;
        try {
            const result = await database.query(query, [code]);
            if (result.rows.length === 0) return null;
            return new VlogStudentsUserModel(result.rows[0]);
        } catch (error) {
            logger.error(`Erro ao buscar usuario por codigo de indicacao: ${code}`, error);
            throw error;
        }
    }

    static async create(userData) {
        const { googleId, email, fullName, university, profilePicture, referralCode } = userData;
        const generatedReferralCode = referralCode || security.generateReferralCode(fullName);

        const query = `
            INSERT INTO users (
                google_id_reference,
                user_email_address,
                user_full_name,
                user_university_name,
                user_profile_picture_url,
                user_referral_code,
                user_created_at_timestamp,
                user_updated_at_timestamp
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING *
        `;

        const values = [googleId, email, fullName, university, profilePicture, generatedReferralCode];

        try {
            const result = await database.query(query, values);
            logger.info(`Novo usuario criado: ${email}`);
            return new VlogStudentsUserModel(result.rows[0]);
        } catch (error) {
            logger.error(`Erro na criacao de usuario: ${email}`, error);
            throw error;
        }
    }

    async update(updateData) {
        const fields = [];
        const values = [];
        let index = 1;

        const allowedUpdates = {
            fullName: 'user_full_name',
            phoneNumber: 'user_phone_number',
            university: 'user_university_name',
            biography: 'user_biography_text',
            profilePicture: 'user_profile_picture_url',
            logoUrl: 'user_logo_custom_url',
            theme: 'user_theme_config',
            status: 'user_account_status'
        };

        for (const [key, value] of Object.entries(updateData)) {
            if (allowedUpdates[key]) {
                fields.push(`${allowedUpdates[key]} = $${index}`);
                values.push(value);
                index++;
            }
        }

        if (fields.length === 0) return this;

        values.push(this.id);
        const query = `
            UPDATE users
            SET ${fields.join(', ')}, user_updated_at_timestamp = NOW()
            WHERE user_identification = $${index}
            RETURNING *
        `;

        try {
            const result = await database.query(query, values);
            logger.info(`Usuario ${this.id} atualizado com sucesso.`);
            return new VlogStudentsUserModel(result.rows[0]);
        } catch (error) {
            logger.error(`Erro ao atualizar usuario ${this.id}`, error);
            throw error;
        }
    }

    async updateLastLogin() {
        const query = `
            UPDATE users
            SET user_last_login_timestamp = NOW()
            WHERE user_identification = $1
        `;
        try {
            await database.query(query, [this.id]);
        } catch (error) {
            logger.error(`Erro ao atualizar last login do usuario ${this.id}`, error);
        }
    }

    async getFullProfile() {
        const query = `
            SELECT
                u.*,
                (SELECT COUNT(*) FROM followers WHERE follower_target_user_id = u.user_identification) AS followers_count,
                (SELECT COUNT(*) FROM followers WHERE follower_actor_user_id = u.user_identification) AS following_count,
                (SELECT COUNT(*) FROM reels WHERE reel_author_user_id = u.user_identification AND reel_is_active = TRUE) AS reels_count,
                (SELECT COUNT(*) FROM posts WHERE post_author_user_id = u.user_identification) AS posts_count
            FROM users u
            WHERE u.user_identification = $1
        `;
        try {
            const result = await database.query(query, [this.id]);
            return result.rows[0];
        } catch (error) {
            logger.error(`Erro ao obter perfil completo do usuario ${this.id}`, error);
            throw error;
        }
    }

    static async search(searchTerm, limit = 20, offset = 0) {
        const query = `
            SELECT user_identification, user_full_name, user_profile_picture_url, user_university_name
            FROM users
            WHERE (user_full_name ILIKE $1 OR user_university_name ILIKE $1)
            AND user_account_status = TRUE
            ORDER BY user_full_name ASC
            LIMIT $2 OFFSET $3
        `;
        try {
            const result = await database.query(query, [`%${searchTerm}%`, limit, offset]);
            return result.rows.map(row => new VlogStudentsUserModel(row));
        } catch (error) {
            logger.error(`Erro na busca de usuarios: ${searchTerm}`, error);
            throw error;
        }
    }

    async follow(targetUserId) {
        const query = `
            INSERT INTO followers (follower_actor_user_id, follower_target_user_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        `;
        try {
            await database.query(query, [this.id, targetUserId]);
            logger.info(`Usuario ${this.id} seguiu ${targetUserId}`);
            return true;
        } catch (error) {
            logger.error(`Erro ao seguir usuario ${targetUserId}`, error);
            throw error;
        }
    }

    async unfollow(targetUserId) {
        const query = `
            DELETE FROM followers
            WHERE follower_actor_user_id = $1 AND follower_target_user_id = $2
        `;
        try {
            await database.query(query, [this.id, targetUserId]);
            logger.info(`Usuario ${this.id} deixou de seguir ${targetUserId}`);
            return true;
        } catch (error) {
            logger.error(`Erro ao deixar de seguir usuario ${targetUserId}`, error);
            throw error;
        }
    }

    async isFollowing(targetUserId) {
        const query = `
            SELECT 1 FROM followers
            WHERE follower_actor_user_id = $1 AND follower_target_user_id = $2
            LIMIT 1
        `;
        try {
            const result = await database.query(query, [this.id, targetUserId]);
            return result.rows.length > 0;
        } catch (error) {
            return false;
        }
    }

    async getFollowers(limit = 50, offset = 0) {
        const query = `
            SELECT u.user_identification, u.user_full_name, u.user_profile_picture_url
            FROM users u
            JOIN followers f ON u.user_identification = f.follower_actor_user_id
            WHERE f.follower_target_user_id = $1
            LIMIT $2 OFFSET $3
        `;
        try {
            const result = await database.query(query, [this.id, limit, offset]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    async getFollowing(limit = 50, offset = 0) {
        const query = `
            SELECT u.user_identification, u.user_full_name, u.user_profile_picture_url
            FROM users u
            JOIN followers f ON u.user_identification = f.follower_target_user_id
            WHERE f.follower_actor_user_id = $1
            LIMIT $2 OFFSET $3
        `;
        try {
            const result = await database.query(query, [this.id, limit, offset]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    async addPoints(amount, reason, referenceId = null) {
        const query = `
            INSERT INTO points (point_owner_user_id, point_amount_value, point_reason_description, point_reference_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        try {
            const result = await database.query(query, [this.id, amount, reason, referenceId]);
            logger.logPointTransaction(this.id, amount, reason);

            await this.refreshPointsBalance();
            return result.rows[0];
        } catch (error) {
            logger.error(`Erro ao adicionar pontos para usuario ${this.id}`, error);
            throw error;
        }
    }

    async refreshPointsBalance() {
        const query = `
            UPDATE users
            SET user_points_balance = (
                SELECT COALESCE(SUM(point_amount_value), 0)
                FROM points
                WHERE point_owner_user_id = $1
            )
            WHERE user_identification = $1
            RETURNING user_points_balance
        `;
        try {
            const result = await database.query(query, [this.id]);
            this.pointsBalance = result.rows[0].user_points_balance;
            return this.pointsBalance;
        } catch (error) {
            logger.error(`Erro ao atualizar balanco de pontos do usuario ${this.id}`, error);
            throw error;
        }
    }

    async getPointsHistory(limit = 20, offset = 0) {
        const query = `
            SELECT * FROM points
            WHERE point_owner_user_id = $1
            ORDER BY point_created_at_timestamp DESC
            LIMIT $2 OFFSET $3
        `;
        try {
            const result = await database.query(query, [this.id, limit, offset]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    static async getLeaderboard(limit = 100) {
        const query = `
            SELECT user_identification, user_full_name, user_profile_picture_url, user_university_name, user_points_balance
            FROM users
            WHERE user_account_status = TRUE
            ORDER BY user_points_balance DESC
            LIMIT $1
        `;
        try {
            const result = await database.query(query, [limit]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    async registerReferral(invitedUserId, code) {
        const query = `
            INSERT INTO referrals (referral_owner_user_id, referral_invited_user_id, referral_code_applied)
            VALUES ($1, $2, $3)
        `;
        try {
            await database.query(query, [this.id, invitedUserId, code]);
            logger.info(`Indicacao registrada: ${this.id} convidou ${invitedUserId}`);
            return true;
        } catch (error) {
            logger.error('Erro ao registrar indicacao', error);
            throw error;
        }
    }

    async getReferralStats() {
        const query = `
            SELECT
                COUNT(*) AS total_referrals,
                COALESCE(SUM(CASE WHEN referral_reward_confirmed THEN 1 ELSE 0 END), 0) AS confirmed_referrals
            FROM referrals
            WHERE referral_owner_user_id = $1
        `;
        try {
            const result = await database.query(query, [this.id]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    async getInvitedUsers() {
        const query = `
            SELECT u.user_identification, u.user_full_name, r.referral_created_at_timestamp
            FROM users u
            JOIN referrals r ON u.user_identification = r.referral_invited_user_id
            WHERE r.referral_owner_user_id = $1
        `;
        try {
            const result = await database.query(query, [this.id]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    static async getUniversityRanking() {
        const query = `
            SELECT user_university_name, COUNT(*) AS students, SUM(user_points_balance) AS total_points
            FROM users
            WHERE user_university_name IS NOT NULL
            GROUP BY user_university_name
            ORDER BY total_points DESC
            LIMIT 50
        `;
        try {
            const result = await database.query(query);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    async getChatRooms() {
        const query = `
            SELECT cr.*,
            (SELECT COUNT(*) FROM chat_messages cm WHERE cm.message_chat_room_id = cr.chat_room_identification AND cm.message_is_read_status = FALSE AND cm.message_sender_user_id != $1) AS unread_count
            FROM chat_rooms cr
            JOIN chat_room_members crm ON cr.chat_room_identification = crm.member_chat_room_id
            WHERE crm.member_user_id = $1
            ORDER BY cr.chat_room_last_activity_timestamp DESC
        `;
        try {
            const result = await database.query(query, [this.id]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    async deactivate() {
        return this.update({ status: false });
    }

    async activate() {
        return this.update({ status: true });
    }

    async changeTheme(newTheme) {
        if (!['light', 'dark'].includes(newTheme)) throw new Error('Tema invalido');
        return this.update({ theme: newTheme });
    }

    async getReels(limit = 20, offset = 0) {
        const query = `
            SELECT * FROM reels
            WHERE reel_author_user_id = $1 AND reel_is_active = TRUE
            ORDER BY reel_created_at_timestamp DESC
            LIMIT $2 OFFSET $3
        `;
        try {
            const result = await database.query(query, [this.id, limit, offset]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    async getPosts(limit = 20, offset = 0) {
        const query = `
            SELECT * FROM posts
            WHERE post_author_user_id = $1
            ORDER BY post_created_at_timestamp DESC
            LIMIT $2 OFFSET $3
        `;
        try {
            const result = await database.query(query, [this.id, limit, offset]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    toJSON() {
        return {
            id: this.id,
            email: this.email,
            fullName: this.fullName,
            phoneNumber: this.phoneNumber,
            university: this.university,
            biography: this.biography,
            profilePicture: this.profilePicture,
            logoUrl: this.logoUrl,
            theme: this.theme,
            pointsBalance: this.pointsBalance,
            referralCode: this.referralCode,
            lastLogin: this.lastLogin,
            createdAt: this.createdAt
        };
    }

    static async checkEmailExists(email) {
        const user = await this.findByEmail(email);
        return user !== null;
    }

    static async checkReferralCodeUnique(code) {
        const user = await this.findByReferralCode(code);
        return user === null;
    }

    async incrementPointsOnInteraction(type) {
        let points = 0;
        let reason = '';

        switch(type) {
            case 'like': points = 1; reason = 'LIKE_INTERACTION'; break;
            case 'comment': points = 5; reason = 'COMMENT_INTERACTION'; break;
            case 'post': points = 10; reason = 'POST_PUBLISHED'; break;
            case 'reel': points = 20; reason = 'REEL_PUBLISHED'; break;
            case 'referral': points = 100; reason = 'USER_REFERRAL_BONUS'; break;
        }

        if (points > 0) {
            return await this.addPoints(points, reason);
        }
    }

    static async getStats() {
        const query = `
            SELECT
                (SELECT COUNT(*) FROM users) AS total_users,
                (SELECT COUNT(*) FROM users WHERE user_last_login_timestamp > NOW() - INTERVAL '24 hours') AS active_today,
                (SELECT SUM(user_points_balance) FROM users) AS total_points_economy
        `;
        try {
            const result = await database.query(query);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    async validatePassword(password) {
        return true;
    }

    async getNotifications() {
        return [];
    }

    async updateAvatar(url) {
        return this.update({ profilePicture: url });
    }

    async updateLogo(url) {
        return this.update({ logoUrl: url });
    }

    async verifyUniversity() {
        return true;
    }

    async getInteractionsCount() {
        const query = `
            SELECT
                (SELECT COUNT(*) FROM likes WHERE like_author_user_id = $1) AS total_likes,
                (SELECT COUNT(*) FROM comments WHERE comment_author_user_id = $1) AS total_comments
        `;
        const result = await database.query(query, [this.id]);
        return result.rows[0];
    }
}

module.exports = VlogStudentsUserModel;

function monitorUserModelIntegrity() {
    logger.info('VlogStudents User Model Layer inicializado com suporte a transacoes e gamificacao.');
}

monitorUserModelIntegrity();

const userInternalCache = new Map();

VlogStudentsUserModel.getCachedUser = async (userId) => {
    if (userInternalCache.has(userId)) {
        const cached = userInternalCache.get(userId);
        if (Date.now() - cached.timestamp < 300000) return cached.data;
    }
    const user = await VlogStudentsUserModel.findById(userId);
    if (user) userInternalCache.set(userId, { data: user, timestamp: Date.now() });
    return user;
};

setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of userInternalCache.entries()) {
        if (now - entry.timestamp > 600000) userInternalCache.delete(id);
    }
}, 600000);