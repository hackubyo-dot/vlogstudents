const db = require('../config/db');

class PointsService {
    /**
     * Adiciona pontos a um usuário com rastro de auditoria
     */
    async addPoints(userId, amount, reason, referenceId = null) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // 1. Atualiza saldo do usuário
            await client.query(
                'UPDATE users SET points_total = points_total + $1, updated_at = NOW() WHERE id = $2',
                [amount, userId]
            );

            // 2. Registra a transação
            await client.query(
                `INSERT INTO point_transactions (user_id, amount, reason, reference_id)
                 VALUES ($1, $2, $3, $4)`,
                [userId, amount, reason, referenceId]
            );

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[POINTS SERVICE ERROR]', error);
            return false;
        } finally {
            client.release();
        }
    }
}

module.exports = new PointsService();