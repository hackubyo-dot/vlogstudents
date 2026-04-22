/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - POINTS & ECONOMY SERVICE
 * Gestão de Transações de "Voices" (Pontos)
 * ============================================================================
 */
const db = require('../config/db');

class PointsService {
    /**
     * Adiciona pontos a um usuário dentro de uma transação ativa do Postgres
     */
    async addPointsTransactional(client, userId, amount, reason, referenceId = null) {
        try {
            console.log(`[ECONOMY] Creditando ${amount} pontos para UserID ${userId}. Razão: ${reason}`);

            // 1. Atualizar saldo master do usuário
            await client.query(
                'UPDATE users SET points_total = points_total + $1, updated_at = NOW() WHERE id = $2',
                [amount, userId]
            );

            // 2. Registrar no histórico de transações para transparência/extrato
            await client.query(
                `INSERT INTO point_transactions (user_id, amount, reason, reference_id)
                 VALUES ($1, $2, $3, $4)`,
                [userId, amount, reason, referenceId ? referenceId.toString() : null]
            );

            return true;
        } catch (error) {
            console.error('[POINTS_SERVICE_ERROR]', error);
            throw error; // Repassa para o rollback do controller
        }
    }

    /**
     * Busca saldo atualizado de um usuário
     */
    async getBalance(userId) {
        const result = await db.query('SELECT points_total FROM users WHERE id = $1', [userId]);
        return result.rows[0]?.points_total || 0;
    }

    /**
     * Busca histórico de transações paginado
     */
    async getHistory(userId, limit = 50) {
        const result = await db.query(
            'SELECT * FROM point_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
            [userId, limit]
        );
        return result.rows;
    }
}

module.exports = new PointsService();
