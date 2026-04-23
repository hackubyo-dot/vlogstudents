/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - ECONOMY CONTROLLER v3.0.0 (FULL)
 * POINT SYSTEM | LEADERBOARD | REFERRALS | GAMIFICATION CORE
 * ============================================================================
 */

const db = require('../config/db');

class EconomyController {

    /**
     * =========================================================================
     * 📊 GET /api/v1/economy/history
     * Histórico de transações do usuário
     * =========================================================================
     */
    async getHistory(req, res) {
        try {
            const result = await db.query(
                `SELECT *
                 FROM point_transactions
                 WHERE user_id = $1
                 ORDER BY created_at DESC`,
                [req.user.id]
            );

            return res.json({
                success: true,
                data: result.rows
            });

        } catch (error) {
            console.error('[ECONOMY_HISTORY_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao buscar histórico financeiro.',
                details: error.message
            });
        }
    }

    /**
     * =========================================================================
     * 🏆 GET /api/v1/economy/leaderboard
     * Ranking global de usuários
     * =========================================================================
     */
    async getLeaderboard(req, res) {
        try {
            const result = await db.query(
                `SELECT 
                    id,
                    full_name,
                    avatar_url,
                    university_name,
                    points_total
                 FROM users
                 WHERE isactive = true
                 ORDER BY points_total DESC
                 LIMIT 50`
            );

            return res.json({
                success: true,
                count: result.rowCount,
                data: result.rows
            });

        } catch (error) {
            console.error('[ECONOMY_LEADERBOARD_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao carregar ranking.',
                details: error.message
            });
        }
    }

    /**
     * =========================================================================
     * 🎯 GET /api/v1/users/referrals/stats
     * Estatísticas de convites (indicações)
     * =========================================================================
     */
    async getReferralStats(req, res) {
        try {
            const result = await db.query(
                `SELECT 
                    COUNT(*) AS total_invites,
                    COALESCE(SUM(amount), 0) AS total_earned
                 FROM point_transactions
                 WHERE user_id = $1
                 AND reason ILIKE '%indicação%'`,
                [req.user.id]
            );

            return res.json({
                success: true,
                data: result.rows[0]
            });

        } catch (error) {
            console.error('[ECONOMY_REFERRAL_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao buscar estatísticas de indicação.',
                details: error.message
            });
        }
    }
}

module.exports = new EconomyController();
