const database = require('../config/database');
const logger = require('../config/logger');
const pointService = require('../services/point_service');
const socketService = require('../services/socket_service');

class VlogStudentsInteractionController {
    async toggleLike(request, response) {
        const userId = request.user.id;
        const { targetId, targetType } = request.body;

        let table = '';
        let targetField = '';
        let countField = '';

        switch (targetType) {
            case 'post': table = 'posts'; targetField = 'like_target_post_id'; countField = 'post_likes_count_total'; break;
            case 'reel': table = 'reels'; targetField = 'like_target_reel_id'; countField = 'reel_likes_count_total'; break;
            case 'comment': table = 'comments'; targetField = 'like_target_comment_id'; countField = 'comment_likes_count_total'; break;
            default: return response.status(400).json({ success: false, message: 'Tipo de alvo invalido.' });
        }

        const client = await database.getPool().connect();
        try {
            await client.query('BEGIN');

            const checkQuery = `SELECT like_identification FROM likes WHERE like_author_user_id = $1 AND ${targetField} = $2`;
            const check = await client.query(checkQuery, [userId, targetId]);

            if (check.rows.length > 0) {
                await client.query('DELETE FROM likes WHERE like_identification = $1', [check.rows[0].like_identification]);
                await client.query(`UPDATE ${table} SET ${countField} = ${countField} - 1 WHERE ${table === 'posts' ? 'post_identification' : table === 'reels' ? 'reel_identification' : 'comment_identification'} = $1`, [targetId]);
                await client.query('COMMIT');
                return response.status(200).json({ success: true, action: 'unliked' });
            } else {
                await client.query(`INSERT INTO likes (like_author_user_id, ${targetField}, like_created_at_timestamp) VALUES ($1, $2, NOW())`, [userId, targetId]);
                await client.query(`UPDATE ${table} SET ${countField} = ${countField} + 1 WHERE ${table === 'posts' ? 'post_identification' : table === 'reels' ? 'reel_identification' : 'comment_identification'} = $1`, [targetId]);

                await pointService.awardPoints(userId, 'REEL_LIKE', targetId.toString());
                await client.query('COMMIT');

                return response.status(200).json({ success: true, action: 'liked' });
            }
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Erro ao alternar Like', error);
            return response.status(500).json({ success: false });
        } finally {
            client.release();
        }
    }

    async addComment(request, response) {
        const userId = request.user.id;
        const { targetId, targetType, text, parentId } = request.body;

        let originField = targetType === 'post' ? 'comment_origin_post_id' : 'comment_origin_reel_id';
        let updateTable = targetType === 'post' ? 'posts' : 'reels';
        let updateField = targetType === 'post' ? 'post_comments_count_total' : 'reel_comments_count_total';
        let pkField = targetType === 'post' ? 'post_identification' : 'reel_identification';

        try {
            const query = `
                INSERT INTO comments (${originField}, comment_author_user_id, comment_text_content, comment_parent_node_id, comment_created_at_timestamp)
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING *
            `;
            const result = await database.query(query, [targetId, userId, text, parentId]);
            const newComment = result.rows[0];

            await database.query(`UPDATE ${updateTable} SET ${updateField} = ${updateField} + 1 WHERE ${pkField} = $1`, [targetId]);
            await pointService.awardPoints(userId, 'REEL_COMMENT', targetId.toString());

            return response.status(201).json({ success: true, data: newComment });
        } catch (error) {
            logger.error('Erro ao adicionar comentario', error);
            return response.status(500).json({ success: false });
        }
    }

    async getComments(request, response) {
        const { targetId, targetType } = request.query;
        let originField = targetType === 'post' ? 'comment_origin_post_id' : 'comment_origin_reel_id';

        try {
            const query = `
                SELECT c.*, u.user_full_name, u.user_profile_picture_url
                FROM comments c
                JOIN users u ON c.comment_author_user_id = u.user_identification
                WHERE c.${originField} = $1
                ORDER BY c.comment_created_at_timestamp ASC
            `;
            const result = await database.query(query, [targetId]);
            return response.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async reportContent(request, response) {
        const { targetId, targetType, reason } = request.body;
        const userId = request.user.id;
        logger.security(`CONTEUDO DENUNCIADO: User ${userId} denunciou ${targetType} ID ${targetId}. Motivo: ${reason}`);
        return response.status(200).json({ success: true, message: 'Sua denuncia sera analisada pela equipe de moderacao.' });
    }

    async getPointsSummary(request, response) {
        const userId = request.user.id;
        try {
            const history = await pointService.getDetailedHistory(userId, 1, 10);
            const stats = await pointService.getUserStatistics(userId);
            return response.status(200).json({ success: true, data: { history, stats } });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async getLeaderboard(request, response) {
        try {
            const data = await pointService.getGlobalLeaderboard(50);
            return response.status(200).json({ success: true, data });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async getReferralStatus(request, response) {
        const userId = request.user.id;
        try {
            const stats = await pointService.getReferralStats(userId);
            const code = await pointService.getReferralCode(userId);
            return response.status(200).json({ success: true, data: { ...stats, code } });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async shareContent(request, response) {
        const { targetId, targetType } = request.body;
        const userId = request.user.id;
        await pointService.awardPoints(userId, 'REPOST', targetId.toString());
        return response.status(200).json({ success: true, pointsAdded: 10 });
    }

    async deleteComment(request, response) {
        const { commentId } = request.params;
        const userId = request.user.id;
        try {
            const check = await database.query('SELECT comment_author_user_id FROM comments WHERE comment_identification = $1', [commentId]);
            if (check.rows[0].comment_author_user_id !== userId) return response.status(403).json({ success: false });

            await database.query('DELETE FROM comments WHERE comment_identification = $1', [commentId]);
            return response.status(200).json({ success: true });
        } catch (error) {
            return response.status(500).json({ success: false });
        }
    }

    async getLikeStatus(request, response) {
        const { targetId, targetType } = request.query;
        const userId = request.user.id;
        let targetField = targetType === 'post' ? 'like_target_post_id' : 'like_target_reel_id';
        const result = await database.query(`SELECT 1 FROM likes WHERE like_author_user_id = $1 AND ${targetField} = $2`, [userId, targetId]);
        return response.status(200).json({ success: true, isLiked: result.rows.length > 0 });
    }

    async getPostLikes(request, response) {
        const { id } = request.params;
        const query = `SELECT u.user_full_name, u.user_profile_picture_url FROM users u JOIN likes l ON u.user_identification = l.like_author_user_id WHERE l.like_target_post_id = $1`;
        const result = await database.query(query, [id]);
        return response.status(200).json({ success: true, data: result.rows });
    }

    async getReelLikes(request, response) {
        const { id } = request.params;
        const query = `SELECT u.user_full_name, u.user_profile_picture_url FROM users u JOIN likes l ON u.user_identification = l.like_author_user_id WHERE l.like_target_reel_id = $1`;
        const result = await database.query(query, [id]);
        return response.status(200).json({ success: true, data: result.rows });
    }

    async getActivityFeed(request, response) {
        const userId = request.user.id;
        const query = `SELECT * FROM points WHERE point_owner_user_id = $1 ORDER BY point_created_at_timestamp DESC LIMIT 20`;
        const result = await database.query(query, [userId]);
        return response.status(200).json({ success: true, data: result.rows });
    }

    async getUniversityStats(request, response) {
        const data = await pointService.getUniversityRanking();
        return response.status(200).json({ success: true, data });
    }

    async processSystemReward(request, response) {
        const { userId, amount, reason } = request.body;
        await pointService.handleAdminManualAdjustment(userId, amount, reason, request.user.id);
        return response.status(200).json({ success: true });
    }

    async getNotifications(request, response) {
        return response.status(200).json({ success: true, data: [] });
    }

    async markNotificationRead(request, response) {
        return response.status(200).json({ success: true });
    }

    async getGlobalStats(request, response) {
        const data = await pointService.getEconomyDashboard();
        return response.status(200).json({ success: true, data });
    }

    async getWeeklyProgress(request, response) {
        const data = await pointService.getWeeklyProgress(request.user.id);
        return response.status(200).json({ success: true, data });
    }

    async auditIntegrity(request, response) {
        const data = await pointService.auditUserPoints(request.user.id);
        return response.status(200).json({ success: true, data });
    }

    async syncPoints(request, response) {
        await pointService.syncUserPoints(request.user.id);
        return response.status(200).json({ success: true });
    }

    async getReferralCode(request, response) {
        const code = await pointService.getReferralCode(request.user.id);
        return response.status(200).json({ success: true, code });
    }

    async getBadgeStatus(request, response) {
        const stats = await pointService.getUserStatistics(request.user.id);
        return response.status(200).json({ success: true, badge: stats.level });
    }

    async checkSpamStatus(request, response) {
        const isSpam = await pointService.detectSpamInteractions(request.user.id);
        return response.status(200).json({ success: true, isSpam });
    }

    async registerShare(request, response) {
        const { id, type } = request.body;
        await pointService.handleContentSharing(request.user.id, id);
        return response.status(200).json({ success: true });
    }

    async getDailyQuota(request, response) {
        const quota = await pointService.getTopEarnersToday();
        return response.status(200).json({ success: true, data: quota });
    }

    async resetDailyQuotas(request, response) {
        await pointService.resetDailyQuotas();
        return response.status(200).json({ success: true });
    }

    async logInteraction(targetId, type, userId) {
        logger.info(`Interacao registrada: Alvo ${targetId} (${type}) por User ${userId}`);
    }

    async checkIntegrity() {
        await pointService.checkSystemIntegrity();
    }
}

module.exports = new VlogStudentsInteractionController();