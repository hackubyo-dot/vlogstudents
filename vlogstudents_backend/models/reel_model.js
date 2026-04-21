const database = require('../config/database');
const logger = require('../config/logger');
const uploadService = require('../middlewares/upload_middleware');

class VlogStudentsReelModel {
    constructor(reelData = {}) {
        this.id = reelData.reel_identification;
        this.authorId = reelData.reel_author_user_id;
        this.driveFileId = reelData.reel_google_drive_file_id;
        this.title = reelData.reel_title_text;
        this.description = reelData.reel_description_content;
        this.duration = reelData.reel_duration_seconds;
        this.thumbnailId = reelData.reel_thumbnail_drive_id;
        this.views = reelData.reel_views_count_total || 0;
        this.likes = reelData.reel_likes_count_total || 0;
        this.comments = reelData.reel_comments_count_total || 0;
        this.reposts = reelData.reel_reposts_count_total || 0;
        this.isActive = reelData.reel_is_active;
        this.createdAt = reelData.reel_created_at_timestamp;

        this.authorName = reelData.author_name;
        this.authorPicture = reelData.author_picture;
        this.authorUniversity = reelData.author_university;
    }

    static async create(reelData) {
        const { authorId, driveFileId, title, description, duration, thumbnailId } = reelData;
        const query = `
            INSERT INTO reels (
                reel_author_user_id,
                reel_google_drive_file_id,
                reel_title_text,
                reel_description_content,
                reel_duration_seconds,
                reel_thumbnail_drive_id,
                reel_created_at_timestamp
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
        `;
        const values = [authorId, driveFileId, title, description, duration, thumbnailId];

        try {
            const result = await database.query(query, values);
            logger.info(`Novo Reel criado pelo usuario ${authorId}: ${result.rows[0].reel_identification}`);
            return new VlogStudentsReelModel(result.rows[0]);
        } catch (error) {
            logger.error(`Erro ao salvar Reel no banco de dados para usuario ${authorId}`, error);
            throw error;
        }
    }

    static async findById(reelId) {
        const query = `
            SELECT r.*, u.user_full_name as author_name, u.user_profile_picture_url as author_picture, u.user_university_name as author_university
            FROM reels r
            JOIN users u ON r.reel_author_user_id = u.user_identification
            WHERE r.reel_identification = $1
            LIMIT 1
        `;
        try {
            const result = await database.query(query, [reelId]);
            if (result.rows.length === 0) return null;
            return new VlogStudentsReelModel(result.rows[0]);
        } catch (error) {
            logger.error(`Erro ao buscar Reel ${reelId}`, error);
            throw error;
        }
    }

    static async getGlobalFeed(limit = 10, offset = 0, userId = null) {
        const query = `
            SELECT
                r.*,
                u.user_full_name as author_name,
                u.user_profile_picture_url as author_picture,
                u.user_university_name as author_university,
                EXISTS(SELECT 1 FROM likes WHERE like_target_reel_id = r.reel_identification AND like_author_user_id = $3) AS is_liked,
                EXISTS(SELECT 1 FROM reposts WHERE repost_original_reel_id = r.reel_identification AND repost_author_user_id = $3) AS is_reposted
            FROM reels r
            JOIN users u ON r.reel_author_user_id = u.user_identification
            WHERE r.reel_is_active = TRUE
            ORDER BY r.reel_created_at_timestamp DESC
            LIMIT $1 OFFSET $2
        `;
        try {
            const result = await database.query(query, [limit, offset, userId]);
            return result.rows.map(row => new VlogStudentsReelModel(row));
        } catch (error) {
            logger.error('Erro ao buscar feed global de Reels', error);
            throw error;
        }
    }

    static async getTrendingFeed(limit = 10, offset = 0) {
        const query = `
            SELECT r.*, u.user_full_name as author_name, u.user_profile_picture_url as author_picture
            FROM reels r
            JOIN users u ON r.reel_author_user_id = u.user_identification
            WHERE r.reel_is_active = TRUE
            ORDER BY (r.reel_likes_count_total + r.reel_views_count_total + r.reel_reposts_count_total) DESC
            LIMIT $1 OFFSET $2
        `;
        try {
            const result = await database.query(query, [limit, offset]);
            return result.rows.map(row => new VlogStudentsReelModel(row));
        } catch (error) {
            throw error;
        }
    }

    async incrementView() {
        const query = `UPDATE reels SET reel_views_count_total = reel_views_count_total + 1 WHERE reel_identification = $1`;
        try {
            await database.query(query, [this.id]);
            this.views++;
        } catch (error) {
            logger.error(`Erro ao incrementar views do Reel ${this.id}`, error);
        }
    }

    async toggleLike(userId) {
        const checkQuery = `SELECT like_identification FROM likes WHERE like_author_user_id = $1 AND like_target_reel_id = $2`;
        try {
            const check = await database.query(checkQuery, [userId, this.id]);
            if (check.rows.length > 0) {
                await database.query(`DELETE FROM likes WHERE like_identification = $1`, [check.rows[0].like_identification]);
                await database.query(`UPDATE reels SET reel_likes_count_total = reel_likes_count_total - 1 WHERE reel_identification = $1`, [this.id]);
                return { action: 'unliked', count: this.likes - 1 };
            } else {
                await database.query(`INSERT INTO likes (like_author_user_id, like_target_reel_id) VALUES ($1, $2)`, [userId, this.id]);
                await database.query(`UPDATE reels SET reel_likes_count_total = reel_likes_count_total + 1 WHERE reel_identification = $1`, [this.id]);
                return { action: 'liked', count: this.likes + 1 };
            }
        } catch (error) {
            throw error;
        }
    }

    async addComment(userId, text, parentId = null) {
        const query = `
            INSERT INTO comments (comment_origin_reel_id, comment_author_user_id, comment_text_content, comment_parent_node_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        try {
            const result = await database.query(query, [this.id, userId, text, parentId]);
            await database.query(`UPDATE reels SET reel_comments_count_total = reel_comments_count_total + 1 WHERE reel_identification = $1`, [this.id]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    async getComments(limit = 30, offset = 0) {
        const query = `
            SELECT c.*, u.user_full_name as author_name, u.user_profile_picture_url as author_picture
            FROM comments c
            JOIN users u ON c.comment_author_user_id = u.user_identification
            WHERE c.comment_origin_reel_id = $1 AND c.comment_parent_node_id IS NULL
            ORDER BY c.comment_created_at_timestamp DESC
            LIMIT $2 OFFSET $3
        `;
        try {
            const result = await database.query(query, [this.id, limit, offset]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    async repost(userId, quote = null) {
        const query = `
            INSERT INTO reposts (repost_author_user_id, repost_original_reel_id, repost_content_quote)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        try {
            const result = await database.query(query, [userId, this.id, quote]);
            await database.query(`UPDATE reels SET reel_reposts_count_total = reel_reposts_count_total + 1 WHERE reel_identification = $1`, [this.id]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    async delete() {
        try {
            await uploadService.remover(this.driveFileId);
            if (this.thumbnailId) await uploadService.remover(this.thumbnailId);
            await database.query(`DELETE FROM reels WHERE reel_identification = $1`, [this.id]);
            logger.info(`Reel ${this.id} removido completamente.`);
            return true;
        } catch (error) {
            logger.error(`Erro ao deletar Reel ${this.id}`, error);
            throw error;
        }
    }

    static async getByHashtag(hashtag, limit = 20, offset = 0) {
        const query = `
            SELECT r.*, u.user_full_name as author_name
            FROM reels r
            JOIN users u ON r.reel_author_user_id = u.user_identification
            WHERE r.reel_description_content ILIKE $1 AND r.reel_is_active = TRUE
            LIMIT $2 OFFSET $3
        `;
        try {
            const result = await database.query(query, [`%#${hashtag}%`, limit, offset]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    static async getAuthorReels(authorId, limit = 20, offset = 0) {
        const query = `
            SELECT * FROM reels
            WHERE reel_author_user_id = $1 AND reel_is_active = TRUE
            ORDER BY reel_created_at_timestamp DESC
            LIMIT $2 OFFSET $3
        `;
        try {
            const result = await database.query(query, [authorId, limit, offset]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    async updateMetadata(title, description) {
        const query = `
            UPDATE reels
            SET reel_title_text = $1, reel_description_content = $2
            WHERE reel_identification = $3
            RETURNING *
        `;
        try {
            const result = await database.query(query, [title, description, this.id]);
            return new VlogStudentsReelModel(result.rows[0]);
        } catch (error) {
            throw error;
        }
    }

    static async getEngagedReels(userId, limit = 5) {
        const query = `
            SELECT r.* FROM reels r
            JOIN likes l ON r.reel_identification = l.like_target_reel_id
            WHERE l.like_author_user_id = $1
            ORDER BY r.reel_created_at_timestamp DESC
            LIMIT $2
        `;
        try {
            const result = await database.query(query, [userId, limit]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    toJSON() {
        return {
            id: this.id,
            authorId: this.authorId,
            author: {
                name: this.authorName,
                picture: this.authorPicture,
                university: this.authorUniversity
            },
            title: this.title,
            description: this.description,
            videoUrl: `/api/v1/media/${this.driveFileId}`,
            thumbnailUrl: this.thumbnailId ? `/api/v1/media/${this.thumbnailId}` : null,
            stats: {
                views: this.views,
                likes: this.likes,
                comments: this.comments,
                reposts: this.reposts
            },
            createdAt: this.createdAt
        };
    }

    static async getStats() {
        const query = `
            SELECT
                COUNT(*) as total_reels,
                SUM(reel_views_count_total) as total_views,
                AVG(reel_duration_seconds) as avg_duration
            FROM reels
        `;
        const result = await database.query(query);
        return result.rows[0];
    }

    async hide() {
        const query = `UPDATE reels SET reel_is_active = FALSE WHERE reel_identification = $1`;
        return await database.query(query, [this.id]);
    }

    async show() {
        const query = `UPDATE reels SET reel_is_active = TRUE WHERE reel_identification = $1`;
        return await database.query(query, [this.id]);
    }

    static async getRecommendations(userId, limit = 10) {
        const query = `
            SELECT r.*, u.user_full_name as author_name
            FROM reels r
            JOIN users u ON r.reel_author_user_id = u.user_identification
            WHERE r.reel_author_user_id != $1
            AND r.reel_is_active = TRUE
            ORDER BY RANDOM()
            LIMIT $2
        `;
        const result = await database.query(query, [userId, limit]);
        return result.rows;
    }
}

module.exports = VlogStudentsReelModel;

function monitorReelModelIntegrity() {
    logger.info('VlogStudents Reel Model Layer inicializado para processamento de video vertical.');
}

monitorReelModelIntegrity();