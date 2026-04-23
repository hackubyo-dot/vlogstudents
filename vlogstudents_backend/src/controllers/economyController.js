/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - ECONOMY CONTROLLER v3.2.0
 * POINT SYSTEM | LEADERBOARD | REFERRALS | PAGINATION | SCALABLE
 * ============================================================================
 */

const db = require('../config/db');

class EconomyController {

    /**
     * =========================================================================
     * 📊 GET HISTORY (PAGINADO)
     * =========================================================================
     */
    async getHistory(req, res) {
        try {
            const userId = req.user.id;

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            const result = await db.query(
                `SELECT 
                    id,
                    amount,
                    reason,
                    reference_id,
                    created_at
                 FROM point_transactions
                 WHERE user_id = $1
                 ORDER BY created_at DESC
                 LIMIT $2 OFFSET $3`,
                [userId, limit, offset]
            );

            return res.json({
                success: true,
                page,
                count: result.rowCount,
                data: result.rows
            });

        } catch (error) {
            console.error('[ECONOMY_HISTORY_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao carregar histórico.'
            });
        }
    }

    /**
     * =========================================================================
     * 🏆 LEADERBOARD (COM POSIÇÃO DO USER)
     * =========================================================================
     */
    async getLeaderboard(req, res) {
        try {
            const userId = req.user.id;

            const page = parseInt(req.query.page) || 1;
            const limit = 50;
            const offset = (page - 1) * limit;

            // ranking global
            const leaderboard = await db.query(
                `SELECT 
                    id,
                    full_name,
                    avatar_url,
                    university_name,
                    points_total
                 FROM users
                 WHERE isactive = true
                 ORDER BY points_total DESC
                 LIMIT $1 OFFSET $2`,
                [limit, offset]
            );

            // 🔥 posição do utilizador (IMPORTANTE)
            const myRank = await db.query(
                `SELECT rank FROM (
                    SELECT 
                        id,
                        RANK() OVER (ORDER BY points_total DESC) as rank
                    FROM users
                    WHERE isactive = true
                ) ranked
                WHERE id = $1`,
                [userId]
            );

            return res.json({
                success: true,
                page,
                count: leaderboard.rowCount,
                my_rank: myRank.rows[0]?.rank || null,
                data: leaderboard.rows
            });

        } catch (error) {
            console.error('[ECONOMY_LEADERBOARD_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao carregar ranking.'
            });
        }
    }

    /**
     * =========================================================================
     * 🎯 REFERRAL STATS (MELHORADO)
     * =========================================================================
     */
    async getReferralStats(req, res) {
        try {
            const userId = req.user.id;

            const result = await db.query(
                `SELECT 
                    COUNT(*) FILTER (WHERE amount > 0) AS total_invites,
                    COALESCE(SUM(amount), 0) AS total_earned,
                    MAX(created_at) AS last_invite
                 FROM point_transactions
                 WHERE user_id = $1
                 AND reason ILIKE '%indicação%'`,
                [userId]
            );

            return res.json({
                success: true,
                data: result.rows[0]
            });

        } catch (error) {
            console.error('[ECONOMY_REFERRAL_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao carregar dados de indicação.'
            });
        }
    }
}

module.exports = new EconomyController();
