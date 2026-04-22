const db = require('../config/db');

class EconomyController {
    /**
     * GET /economy/history
     */
    async getHistory(req, res) {
        try {
            const result = await db.query(
                'SELECT * FROM point_transactions WHERE user_id = $1 ORDER BY created_at DESC',
                [req.user.id]
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao buscar extrato.' });
        }
    }

    /**
     * GET /economy/leaderboard
     */
    async getLeaderboard(req, res) {
        try {
            const result = await db.query(
                `SELECT full_name, avatar_url, university_name, points_total
                 FROM users WHERE isactive = true
                 ORDER BY points_total DESC LIMIT 50`
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao buscar ranking.' });
        }
    }
}

module.exports = new EconomyController();