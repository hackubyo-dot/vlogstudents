/**
 * ============================================================================
 * VLOGSTUDENTS MASTER POINTS CONTROLLER v2.0.0
 * GESTÃO DE VOICES, RANKINGS E RECOMPENSAS ACADÊMICAS
 * ============================================================================
 */

const db = require('../config/dbConfig');

const pointController = {

    /**
     * Retorna o ranking das universidades com maior engajamento
     */
    getUniversityLeaderboard: async (req, res) => {
        try {
            const query = `
                SELECT
                    university_name,
                    SUM(points_total) as total_points,
                    COUNT(id) as student_count,
                    AVG(points_total) as average_points
                FROM users
                WHERE university_name IS NOT NULL
                GROUP BY university_name
                ORDER BY total_points DESC
                LIMIT 20
            `;
            const result = await db.query(query);
            res.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            console.error('[POINTS_ERROR] university_leaderboard:', error.message);
            res.status(500).json({ success: false });
        }
    },

    /**
     * Ranking Global de Alunos (Top Earners)
     */
    getGlobalLeaderboard: async (req, res) => {
        try {
            const query = `
                SELECT
                    id, full_name, avatar_url, university_name, points_total
                FROM users
                WHERE isActive = true
                ORDER BY points_total DESC
                LIMIT 50
            `;
            const result = await db.query(query);
            res.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    /**
     * Registro manual de bônus (Auditoria Master)
     */
    adminCreditPoints: async (req, res) => {
        const { targetUserId, amount, reason } = req.body;

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                'UPDATE users SET points_total = points_total + $1 WHERE id = $2',
                [amount, targetUserId]
            );

            await client.query(
                'INSERT INTO point_transactions (user_id, amount, reason) VALUES ($1, $2, $3)',
                [targetUserId, amount, `ADMIN_ADJUSTMENT: ${reason}`]
            );

            await client.query('COMMIT');
            res.status(200).json({ success: true, message: 'Pontos creditados via comando Master.' });
        } catch (error) {
            await client.query('ROLLBACK');
            res.status(500).json({ success: false });
        } finally {
            client.release();
        }
    },

    /**
     * Consulta estatísticas de convites (Sincronizado com ReferralScreen)
     */
    getReferralStats: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT
                    COUNT(id) as total_invites,
                    COALESCE(SUM(CASE WHEN reason = 'USER_REFERRAL' THEN amount ELSE 0 END), 0) as total_earned
                FROM point_transactions
                WHERE user_id = $1 AND reason = 'USER_REFERRAL'
            `;
            const result = await db.query(query, [userId]);
            res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    }
};

module.exports = pointController;