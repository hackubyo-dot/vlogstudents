const database = require('../config/database');
const logger = require('../config/logger');
const driveService = require('../services/google_drive_service');
const pointService = require('../services/point_service');
const socketService = require('../services/socket_service');
const { AppError } = require('../middlewares/error_middleware');

class VlogStudentsReelController {
    async createReel(request, response) {
        const userId = request.user.id;
        const { title, description, duration } = request.body;
        const videoFile = request.file;

        if (!videoFile) {
            return response.status(400).json({ success: false, message: 'Arquivo de video obrigatorio.' });
        }

        const client = await database.getPool().connect();
        try {
            await client.query('BEGIN');

            const uploadResult = await driveService.uploadFile(
                videoFile.buffer,
                videoFile.originalname,
                videoFile.mimetype
            );

            const query = `
                INSERT INTO reels (
                    reel_author_user_id,
                    reel_google_drive_file_id,
                    reel_title_text,
                    reel_description_content,
                    reel_duration_seconds,
                    reel_created_at_timestamp
                )
                VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING *
            `;
            const values = [userId, uploadResult.fileId, title, description, duration || 0];
            const result = await client.query(query, values);
            const newReel = result.rows[0];

            await pointService.awardPoints(userId, 'REEL_POST', newReel.reel_identification.toString());

            await client.query('COMMIT');

            logger.info(`Novo Reel publicado: ${newReel.reel_identification} por ${userId}`);

            socketService.io.emit('new_reel_published', {
                reelId: newReel.reel_identification,
                authorId: userId,
                title: newReel.reel_title_text
            });

            return response.status(201).json({
                success: true,
                message: 'Reel publicado com sucesso.',
                data: newReel
            });
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Erro ao criar Reel', error);
            return response.status(500).json({ success: false, message: 'Erro interno ao processar Reel.' });
        } finally {
            client.release();
        }
    }

    async getFeed(request, response) {
        const { page = 1, limit = 10 } = request.query;
        const userId = request.user.id;
        const offset = (page - 1) * limit;

        try {
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
            const result = await database.query(query, [limit, offset, userId]);

            return response.status(200).json({
                success: true,
                data: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            logger.error('Erro ao carregar feed de Reels', error);
            return response.status(500).json({ success: false, message: 'Erro ao carregar feed.' });
        }
    }

    async getTrending(request, response) {
        try {
            const query = `
                SELECT r.*, u.user_full_name as author_name, u.user_profile_picture_url as author_picture
                FROM reels r
                JOIN users u ON r.reel_author_user_id = u.user_identification
                WHERE r.reel_is_active = TRUE
                ORDER BY (r.reel_likes_count_total + r.reel_views_count_total) DESC
                LIMIT 10
            `;
            const result = await database.query(query);
            return response.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao carregar tendências.' });
        }
    }

    async trackView(request, response) {
        const { id } = request.params;
        const userId = request.user.id;

        try {
            await database.query('UPDATE reels SET reel_views_count_total = reel_views_count_total + 1 WHERE reel_identification = $1', [id]);
            await pointService.awardPoints(userId, 'WATCH_TIME', id);

            return response.status(200).json({ success: true });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async toggleLike(request, response) {
        const { id } = request.params;
        const userId = request.user.id;

        const client = await database.getPool().connect();
        try {
            await client.query('BEGIN');

            const check = await client.query('SELECT like_identification FROM likes WHERE like_author_user_id = $1 AND like_target_reel_id = $2', [userId, id]);

            if (check.rows.length > 0) {
                await client.query('DELETE FROM likes WHERE like_identification = $1', [check.rows[0].like_identification]);
                await client.query('UPDATE reels SET reel_likes_count_total = reel_likes_count_total - 1 WHERE reel_identification = $1', [id]);
                await client.query('COMMIT');
                return response.status(200).json({ success: true, action: 'unliked' });
            } else {
                await client.query('INSERT INTO likes (like_author_user_id, like_target_reel_id) VALUES ($1, $2)', [userId, id]);
                await client.query('UPDATE reels SET reel_likes_count_total = reel_likes_count_total + 1 WHERE reel_identification = $1', [id]);
                await pointService.awardPoints(userId, 'REEL_LIKE', id);
                await client.query('COMMIT');
                return response.status(200).json({ success: true, action: 'liked' });
            }
        } catch (error) {
            await client.query('ROLLBACK');
            return response.status(500).json({ success: false });
        } finally {
            client.release();
        }
    }

    async addComment(request, response) {
        const { id } = request.params;
        const { text, parentId } = request.body;
        const userId = request.user.id;

        try {
            const query = `
                INSERT INTO comments (comment_origin_reel_id, comment_author_user_id, comment_text_content, comment_parent_node_id)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;
            const result = await database.query(query, [id, userId, text, parentId]);
            await database.query('UPDATE reels SET reel_comments_count_total = reel_comments_count_total + 1 WHERE reel_identification = $1', [id]);
            await pointService.awardPoints(userId, 'REEL_COMMENT', id);

            return response.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao comentar.' });
        }
    }

    async getComments(request, response) {
        const { id } = request.params;
        try {
            const query = `
                SELECT c.*, u.user_full_name as author_name, u.user_profile_picture_url as author_picture
                FROM comments c
                JOIN users u ON c.comment_author_user_id = u.user_identification
                WHERE c.comment_origin_reel_id = $1
                ORDER BY c.comment_created_at_timestamp DESC
            `;
            const result = await database.query(query, [id]);
            return response.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async repost(request, response) {
        const { id } = request.params;
        const userId = request.user.id;
        const { quote } = request.body;

        try {
            const query = `INSERT INTO reposts (repost_author_user_id, repost_original_reel_id, repost_content_quote) VALUES ($1, $2, $3)`;
            await database.query(query, [userId, id, quote]);
            await database.query('UPDATE reels SET reel_reposts_count_total = reel_reposts_count_total + 1 WHERE reel_identification = $1', [id]);
            await pointService.awardPoints(userId, 'REPOST', id);

            return response.status(200).json({ success: true, message: 'Reel repostado.' });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async deleteReel(request, response) {
        const { id } = request.params;
        const userId = request.user.id;

        try {
            const reel = await database.query('SELECT reel_google_drive_file_id FROM reels WHERE reel_identification = $1 AND reel_author_user_id = $2', [id, userId]);
            if (reel.rows.length === 0) {
                return response.status(403).json({ success: false, message: 'Permissao negada.' });
            }

            await driveService.deleteFile(reel.rows[0].reel_google_drive_file_id);
            await database.query('DELETE FROM reels WHERE reel_identification = $1', [id]);

            return response.status(200).json({ success: true, message: 'Reel removido.' });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async getAuthorReels(request, response) {
        const { authorId } = request.params;
        try {
            const query = `SELECT * FROM reels WHERE reel_author_user_id = $1 AND reel_is_active = TRUE ORDER BY reel_created_at_timestamp DESC`;
            const result = await database.query(query, [authorId]);
            return response.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async searchByHashtag(request, response) {
        const { tag } = request.query;
        try {
            const query = `SELECT * FROM reels WHERE reel_description_content ILIKE $1 AND reel_is_active = TRUE`;
            const result = await database.query(query, [`%#${tag}%`]);
            return response.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async updateMetadata(request, response) {
        const { id } = request.params;
        const { title, description } = request.body;
        const userId = request.user.id;

        try {
            const query = `UPDATE reels SET reel_title_text = $1, reel_description_content = $2 WHERE reel_identification = $3 AND reel_author_user_id = $4 RETURNING *`;
            const result = await database.query(query, [title, description, id, userId]);
            if (result.rows.length === 0) return response.status(403).json({ success: false });
            return response.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async getReelStats(request, response) {
        const { id } = request.params;
        try {
            const query = `SELECT reel_views_count_total, reel_likes_count_total, reel_comments_count_total, reel_reposts_count_total FROM reels WHERE reel_identification = $1`;
            const result = await database.query(query, [id]);
            return response.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async downloadReel(request, response) {
        const { id } = request.params;
        try {
            const result = await database.query('SELECT reel_google_drive_file_id FROM reels WHERE reel_identification = $1', [id]);
            const stream = await driveService.getFileStream(result.rows[0].reel_google_drive_file_id);
            stream.pipe(response);
        } catch (error) {
            return response.status(404).json({ success: false });
        }
    }

    async getRecommendations(request, response) {
        const userId = request.user.id;
        try {
            const query = `SELECT r.* FROM reels r WHERE r.reel_author_user_id != $1 AND r.reel_is_active = TRUE ORDER BY RANDOM() LIMIT 5`;
            const result = await database.query(query, [userId]);
            return response.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async hideReel(request, response) {
        const { id } = request.params;
        await database.query('UPDATE reels SET reel_is_active = FALSE WHERE reel_identification = $1 AND reel_author_user_id = $2', [id, request.user.id]);
        return response.status(200).json({ success: true });
    }

    async shareReel(request, response) {
        const { id } = request.params;
        return response.status(200).json({ success: true, shareLink: `https://vlogstudents.com/reels/${id}` });
    }

    async getAuthorStats(request, response) {
        const { authorId } = request.params;
        const query = `SELECT SUM(reel_views_count_total) as views, SUM(reel_likes_count_total) as likes FROM reels WHERE reel_author_user_id = $1`;
        const result = await database.query(query, [authorId]);
        return response.status(200).json({ success: true, data: result.rows[0] });
    }

    async getEngagementScore(request, response) {
        const { id } = request.params;
        const query = `SELECT (reel_likes_count_total + reel_comments_count_total + reel_reposts_count_total) as score FROM reels WHERE reel_identification = $1`;
        const result = await database.query(query, [id]);
        return response.status(200).json({ success: true, score: result.rows[0].score });
    }

    async bulkDelete(request, response) {
        const { ids } = request.body;
        for (const id of ids) {
            await this.deleteReel({ params: { id }, user: request.user }, { status: () => ({ json: () => {} }) });
        }
        return response.status(200).json({ success: true });
    }

    async getMostViewed(request, response) {
        const query = `SELECT * FROM reels ORDER BY reel_views_count_total DESC LIMIT 5`;
        const result = await database.query(query);
        return response.status(200).json({ success: true, data: result.rows });
    }

    async verifyReelOwnership(request, response) {
        const { id } = request.params;
        const result = await database.query('SELECT 1 FROM reels WHERE reel_identification = $1 AND reel_author_user_id = $2', [id, request.user.id]);
        return response.status(200).json({ success: true, owner: result.rows.length > 0 });
    }

    async getCommentsCount(request, response) {
        const { id } = request.params;
        const result = await database.query('SELECT reel_comments_count_total FROM reels WHERE reel_identification = $1', [id]);
        return response.status(200).json({ success: true, count: result.rows[0].reel_comments_count_total });
    }

    async reportReel(request, response) {
        const { id } = request.params;
        const { reason } = request.body;
        logger.warn(`Reel ${id} denunciado: ${reason}`);
        return response.status(200).json({ success: true });
    }

    async pinComment(request, response) {
        return response.status(200).json({ success: true });
    }

    async getThumbnail(request, response) {
        const { id } = request.params;
        const result = await database.query('SELECT reel_thumbnail_drive_id FROM reels WHERE reel_identification = $1', [id]);
        if (result.rows[0].reel_thumbnail_drive_id) {
            const stream = await driveService.getFileStream(result.rows[0].reel_thumbnail_drive_id);
            stream.pipe(response);
        } else {
            return response.status(404).send('No thumbnail');
        }
    }

    async getReelsByUniversity(request, response) {
        const { university } = request.params;
        const query = `SELECT r.* FROM reels r JOIN users u ON r.reel_author_user_id = u.user_identification WHERE u.user_university_name = $1`;
        const result = await database.query(query, [university]);
        return response.status(200).json({ success: true, data: result.rows });
    }

    async updateVisibility(request, response) {
        const { id } = request.params;
        const { visible } = request.body;
        await database.query('UPDATE reels SET reel_is_active = $1 WHERE reel_identification = $2', [visible, id]);
        return response.status(200).json({ success: true });
    }

    async getReelsBatch(request, response) {
        const { ids } = request.query;
        const query = `SELECT * FROM reels WHERE reel_identification = ANY($1::int[])`;
        const result = await database.query(query, [ids.split(',').map(Number)]);
        return response.status(200).json({ success: true, data: result.rows });
    }

    async logReelActivity(id, userId, activity) {
        logger.info(`Atividade no Reel ${id} por ${userId}: ${activity}`);
    }

    async checkReelIntegrity(id) {
        const result = await database.query('SELECT reel_google_drive_file_id FROM reels WHERE reel_identification = $1', [id]);
        return result.rows.length > 0;
    }

    async getDurationAverage(request, response) {
        const result = await database.query('SELECT AVG(reel_duration_seconds) FROM reels');
        return response.status(200).json({ success: true, average: result.rows[0].avg });
    }

    async archiveReel(request, response) {
        return this.hideReel(request, response);
    }
}

module.exports = new VlogStudentsReelController();