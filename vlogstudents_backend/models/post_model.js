const database = require('../config/database');
const logger = require('../config/logger');

class VlogStudentsPostModel {
    constructor(postData = {}) {
        this.post_id = postData.post_identification;
        this.author_id = postData.post_author_user_id;
        this.username = postData.post_author_username;
        this.content = postData.post_content_body;
        this.drive_key = postData.post_drive_file_key;
        this.type = postData.post_type_category;
        this.likes_count = parseInt(postData.post_likes_count_total) || 0;
        this.comments_count = parseInt(postData.post_comments_count_total) || 0;
        this.is_active = postData.post_visibility_status;
        this.created_at = postData.post_created_at_timestamp;
        this.updated_at = postData.post_updated_at_timestamp;
        this.author_avatar = postData.author_avatar;
        this.is_liked_by_me = postData.is_liked_by_me || false;
    }

    static async create(payload) {
        const { author_id, username, content, drive_key, type } = payload;
        const query = `
            INSERT INTO posts (
                post_author_user_id,
                post_author_username,
                post_content_body,
                post_drive_file_key,
                post_type_category,
                post_created_at_timestamp,
                post_updated_at_timestamp
            )
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING *
        `;
        const values = [author_id, username, content, drive_key, type || 'text'];

        try {
            const result = await database.query(query, values);
            logger.info(`Postagem persistida com sucesso para o estudante ${username}`);
            return new VlogStudentsPostModel(result.rows[0]);
        } catch (error) {
            logger.error(`Falha critica ao salvar postagem do usuario ${author_id}`, error);
            throw error;
        }
    }

    static async findById(id, requesterUserId = null) {
        const query = `
            SELECT p.*, u.user_profile_picture_url AS author_avatar,
            EXISTS(SELECT 1 FROM likes WHERE like_target_post_id = p.post_identification AND like_author_user_id = $2) AS is_liked_by_me
            FROM posts p
            JOIN users u ON p.post_author_user_id = u.user_identification
            WHERE p.post_identification = $1 AND p.post_visibility_status = TRUE
        `;
        try {
            const result = await database.query(query, [id, requesterUserId]);
            if (result.rows.length === 0) return null;
            return new VlogStudentsPostModel(result.rows[0]);
        } catch (error) {
            logger.error(`Erro ao buscar postagem especifica: ${id}`, error);
            throw error;
        }
    }

    static async getGlobalFeed(limit = 20, offset = 0, requesterUserId = null) {
        const query = `
            SELECT p.*, u.user_profile_picture_url AS author_avatar,
            EXISTS(SELECT 1 FROM likes WHERE like_target_post_id = p.post_identification AND like_author_user_id = $3) AS is_liked_by_me
            FROM posts p
            JOIN users u ON p.post_author_user_id = u.user_identification
            WHERE p.post_visibility_status = TRUE
            ORDER BY p.post_created_at_timestamp DESC
            LIMIT $1 OFFSET $2
        `;
        try {
            const result = await database.query(query, [limit, offset, requesterUserId]);
            return result.rows.map(row => new VlogStudentsPostModel(row));
        } catch (error) {
            logger.error('Erro ao processar feed global de postagens', error);
            throw error;
        }
    }

    async updateContent(newContent) {
        const query = `
            UPDATE posts
            SET post_content_body = $1, post_updated_at_timestamp = NOW()
            WHERE post_identification = $2
            RETURNING *
        `;
        try {
            const result = await database.query(query, [newContent, this.post_id]);
            return new VlogStudentsPostModel(result.rows[0]);
        } catch (error) {
            logger.error(`Erro ao atualizar conteudo do post ${this.post_id}`, error);
            throw error;
        }
    }

    async softDelete() {
        const query = `UPDATE posts SET post_visibility_status = FALSE WHERE post_identification = $1`;
        try {
            await database.query(query, [this.post_id]);
            logger.info(`Post ${this.post_id} marcado como inativo.`);
            return true;
        } catch (error) {
            logger.error(`Erro no soft delete do post ${this.post_id}`, error);
            throw error;
        }
    }

    async handleLike(userId) {
        return await database.transaction(async (client) => {
            const checkQuery = `SELECT like_identification FROM likes WHERE like_author_user_id = $1 AND like_target_post_id = $2`;
            const check = await client.query(checkQuery, [userId, this.post_id]);

            if (check.rows.length > 0) {
                await client.query(`DELETE FROM likes WHERE like_identification = $1`, [check.rows[0].like_identification]);
                const update = await client.query(`UPDATE posts SET post_likes_count_total = post_likes_count_total - 1 WHERE post_identification = $1 RETURNING post_likes_count_total`, [this.post_id]);
                return { action: 'unliked', current_likes: update.rows[0].post_likes_count_total };
            } else {
                await client.query(`INSERT INTO likes (like_author_user_id, like_target_post_id, like_created_at_timestamp) VALUES ($1, $2, NOW())`, [userId, this.post_id]);
                const update = await client.query(`UPDATE posts SET post_likes_count_total = post_likes_count_total + 1 WHERE post_identification = $1 RETURNING post_likes_count_total`, [this.post_id]);
                return { action: 'liked', current_likes: update.rows[0].post_likes_count_total };
            }
        });
    }

    async addComment(userId, text, parentId = null) {
        return await database.transaction(async (client) => {
            const query = `
                INSERT INTO comments (
                    comment_origin_post_id,
                    comment_author_user_id,
                    comment_text_content,
                    comment_parent_node_id,
                    comment_created_at_timestamp
                )
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING *
            `;
            const result = await client.query(query, [this.post_id, userId, text, parentId]);
            await client.query(`UPDATE posts SET post_comments_count_total = post_comments_count_total + 1 WHERE post_identification = $1`, [this.post_id]);
            logger.info(`Novo comentario adicionado ao post ${this.post_id} pelo usuario ${userId}`);
            return result.rows[0];
        });
    }

    async getComments(limit = 50, offset = 0) {
        const query = `
            SELECT c.*, u.user_full_name, u.user_profile_picture_url
            FROM comments c
            JOIN users u ON c.comment_author_user_id = u.user_identification
            WHERE c.comment_origin_post_id = $1
            ORDER BY c.comment_created_at_timestamp ASC
            LIMIT $2 OFFSET $3
        `;
        try {
            const result = await database.query(query, [this.post_id, limit, offset]);
            return result.rows;
        } catch (error) {
            logger.error(`Erro ao recuperar comentarios do post ${this.post_id}`, error);
            throw error;
        }
    }

    static async getPostsByUniversity(universityName, limit = 20, offset = 0) {
        const query = `
            SELECT p.*, u.user_profile_picture_url AS author_avatar
            FROM posts p
            JOIN users u ON p.post_author_user_id = u.user_identification
            WHERE u.user_university_name = $1 AND p.post_visibility_status = TRUE
            ORDER BY p.post_created_at_timestamp DESC
            LIMIT $2 OFFSET $3
        `;
        try {
            const result = await database.query(query, [universityName, limit, offset]);
            return result.rows.map(row => new VlogStudentsPostModel(row));
        } catch (error) {
            logger.error(`Erro ao buscar postagens da universidade: ${universityName}`, error);
            throw error;
        }
    }

    static async getTrendingPosts(limit = 10) {
        const query = `
            SELECT p.*, u.user_profile_picture_url AS author_avatar
            FROM posts p
            JOIN users u ON p.post_author_user_id = u.user_identification
            WHERE p.post_visibility_status = TRUE
            AND p.post_created_at_timestamp > NOW() - INTERVAL '7 days'
            ORDER BY (p.post_likes_count_total * 2 + p.post_comments_count_total * 5) DESC
            LIMIT $1
        `;
        try {
            const result = await database.query(query, [limit]);
            return result.rows.map(row => new VlogStudentsPostModel(row));
        } catch (error) {
            logger.error('Erro ao obter postagens em alta', error);
            throw error;
        }
    }

    async getLikesList() {
        const query = `
            SELECT u.user_identification, u.user_full_name, u.user_profile_picture_url
            FROM users u
            JOIN likes l ON u.user_identification = l.like_author_user_id
            WHERE l.like_target_post_id = $1
        `;
        try {
            const result = await database.query(query, [this.post_id]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    static async countUserPosts(userId) {
        const query = `SELECT COUNT(*) FROM posts WHERE post_author_user_id = $1 AND post_visibility_status = TRUE`;
        const result = await database.query(query, [userId]);
        return parseInt(result.rows[0].count);
    }

    static async searchPosts(term, limit = 20) {
        const query = `
            SELECT p.*, u.user_profile_picture_url AS author_avatar
            FROM posts p
            JOIN users u ON p.post_author_user_id = u.user_identification
            WHERE p.post_content_body ILIKE $1 AND p.post_visibility_status = TRUE
            ORDER BY p.post_created_at_timestamp DESC
            LIMIT $2
        `;
        const result = await database.query(query, [`%${term}%`, limit]);
        return result.rows.map(row => new VlogStudentsPostModel(row));
    }

    async getAuthorDetails() {
        const query = `SELECT * FROM users WHERE user_identification = $1`;
        const result = await database.query(query, [this.author_id]);
        return result.rows[0];
    }

    async getDetailedAnalytics() {
        const query = `
            SELECT
                (SELECT COUNT(*) FROM likes WHERE like_target_post_id = $1) as likes,
                (SELECT COUNT(*) FROM comments WHERE comment_origin_post_id = $1) as comments,
                post_created_at_timestamp as created
            FROM posts
            WHERE post_identification = $1
        `;
        const result = await database.query(query, [this.post_id]);
        return result.rows[0];
    }

    static async cleanupObsoletePosts() {
        const query = `DELETE FROM posts WHERE post_visibility_status = FALSE AND post_updated_at_timestamp < NOW() - INTERVAL '30 days'`;
        return await database.query(query);
    }

    async pinPost() {
        return true;
    }

    async reportPost(userId, reason) {
        logger.warn(`Post ${this.post_id} denunciado por ${userId}. Motivo: ${reason}`);
        return true;
    }

    async getPostGallery() {
        const query = `SELECT post_drive_file_key FROM posts WHERE post_author_user_id = $1 AND post_type_category = 'image'`;
        const result = await database.query(query, [this.author_id]);
        return result.rows;
    }

    toJSON() {
        return {
            id: this.post_id,
            author_id: this.author_id,
            username: this.username,
            avatar: this.author_avatar,
            content: this.content,
            media_key: this.drive_key,
            media_url: this.drive_key ? `/api/v1/media/${this.drive_key}` : null,
            type: this.type,
            likes: this.likes_count,
            comments: this.comments_count,
            is_liked: this.is_liked_by_me,
            created_at: this.created_at
        };
    }

    static async batchUpdatePoints() {
        return true;
    }

    async archive() {
        const query = `UPDATE posts SET post_visibility_status = FALSE WHERE post_identification = $1`;
        return await database.query(query, [this.post_id]);
    }

    static async getRecentMentions(username) {
        const query = `SELECT * FROM posts WHERE post_content_body ILIKE $1`;
        const result = await database.query(query, [`%@${username}%`]);
        return result.rows;
    }

    async getRelatedPosts() {
        const query = `SELECT * FROM posts WHERE post_author_user_id = $1 AND post_identification != $2 LIMIT 3`;
        const result = await database.query(query, [this.author_id, this.post_id]);
        return result.rows;
    }

    static async getSummary() {
        const query = `SELECT COUNT(*) as total, post_type_category FROM posts GROUP BY post_type_category`;
        const result = await database.query(query);
        return result.rows;
    }

    async validateIntegrity() {
        if (!this.author_id || !this.username) return false;
        return true;
    }

    async lockComments() {
        return true;
    }

    async unlockComments() {
        return true;
    }

    static async verifyQuota(userId) {
        const count = await this.countUserPosts(userId);
        return count < 50;
    }

    async markAsFeatured() {
        return true;
    }

    async removeFeatured() {
        return true;
    }

    static async exportUserData(userId) {
        const query = `SELECT * FROM posts WHERE post_author_user_id = $1`;
        const result = await database.query(query, [userId]);
        return result.rows;
    }

    async syncWithCloud() {
        return true;
    }

    static async getEngagementRate(postId) {
        const post = await this.findById(postId);
        if (!post) return 0;
        return (post.likes_count + post.comments_count) / 100;
    }

    async transferOwnership(newAuthorId) {
        const query = `UPDATE posts SET post_author_user_id = $1 WHERE post_identification = $2`;
        return await database.query(query, [newAuthorId, this.post_id]);
    }

    async getMediaMetadata() {
        return {
            id: this.drive_key,
            type: this.type,
            post_id: this.post_id
        };
    }

    static async filterByDateRange(start, end) {
        const query = `SELECT * FROM posts WHERE post_created_at_timestamp BETWEEN $1 AND $2`;
        const result = await database.query(query, [start, end]);
        return result.rows;
    }

    async addTag(tagName) {
        return true;
    }

    async removeTag(tagName) {
        return true;
    }

    static async getTopContributors() {
        const query = `
            SELECT post_author_user_id, COUNT(*) as post_count
            FROM posts
            GROUP BY post_author_user_id
            ORDER BY post_count DESC
            LIMIT 5
        `;
        const result = await database.query(query);
        return result.rows;
    }

    async checkSpam() {
        return false;
    }

    static async getInactiveUsersPosts() {
        const query = `
            SELECT p.* FROM posts p
            JOIN users u ON p.post_author_user_id = u.user_identification
            WHERE u.user_last_login_timestamp < NOW() - INTERVAL '30 days'
        `;
        const result = await database.query(query);
        return result.rows;
    }

    async boost() {
        return true;
    }

    async getRevisionHistory() {
        return [];
    }

    static async systemAudit() {
        logger.info('Iniciando auditoria de integridade da tabela de posts.');
        const result = await database.query('SELECT COUNT(*) FROM posts');
        logger.info(`Total de postagens no sistema: ${result.rows[0].count}`);
    }
}

module.exports = VlogStudentsPostModel;

function monitorPostModelIntegrity() {
    logger.info('VlogStudents Post Model Layer inicializado para processamento de feed textual e midia.');
}

monitorPostModelIntegrity();