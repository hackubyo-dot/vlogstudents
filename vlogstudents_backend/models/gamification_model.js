const database = require('../config/database');
const logger = require('../config/logger');

class VlogStudentsGamificationModel {
    constructor(data = {}) {
        this.transaction_id = data.point_transaction_identification;
        this.user_id = data.point_owner_user_id;
        this.amount = data.point_amount_value;
        this.reason = data.point_reason_description;
        this.reference_id = data.point_reference_id;
        this.created_at = data.point_created_at_timestamp;
    }

    static async awardPoints(userId, amount, reason, referenceId = null) {
        const query = `
            INSERT INTO points (point_owner_user_id, point_amount_value, point_reason_description, point_reference_id, point_created_at_timestamp)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *
        `;
        try {
            const result = await database.query(query, [userId, amount, reason, referenceId]);
            logger.info(`Pontos concedidos: Usuario ${userId} recebeu ${amount} VS por ${reason}`);

            await database.query(`
                UPDATE users SET user_points_balance = user_points_balance + $1
                WHERE user_identification = $2
            `, [amount, userId]);

            return new VlogStudentsGamificationModel(result.rows[0]);
        } catch (error) {
            logger.error(`Erro ao processar transacao de pontos para usuario ${userId}`, error);
            throw error;
        }
    }

    static async getUserBalance(userId) {
        const query = `SELECT user_points_balance FROM users WHERE user_identification = $1`;
        try {
            const result = await database.query(query, [userId]);
            return result.rows.length > 0 ? result.rows[0].user_points_balance : 0;
        } catch (error) {
            return 0;
        }
    }

    static async getTransactionHistory(userId, limit = 50, offset = 0) {
        const query = `
            SELECT * FROM points
            WHERE point_owner_user_id = $1
            ORDER BY point_created_at_timestamp DESC
            LIMIT $2 OFFSET $3
        `;
        try {
            const result = await database.query(query, [userId, limit, offset]);
            return result.rows.map(row => new VlogStudentsGamificationModel(row));
        } catch (error) {
            throw error;
        }
    }

    static async getLeaderboard(limit = 100) {
        const query = `
            SELECT user_identification, user_full_name, user_profile_picture_url, user_university_name, user_points_balance
            FROM users
            WHERE user_account_status = TRUE
            ORDER BY user_points_balance DESC
            LIMIT $1
        `;
        try {
            const result = await database.query(query, [limit]);
            return result.rows;
        } catch (error) {
            logger.error('Erro ao gerar leaderboard global', error);
            throw error;
        }
    }

    static async getUniversityRanking() {
        const query = `
            SELECT user_university_name, SUM(user_points_balance) as total_university_points, COUNT(*) as students_count
            FROM users
            WHERE user_university_name IS NOT NULL
            GROUP BY user_university_name
            ORDER BY total_university_points DESC
            LIMIT 50
        `;
        try {
            const result = await database.query(query);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    static async createReferral(referrerId, invitedId, code) {
        const query = `
            INSERT INTO referrals (referral_owner_user_id, referral_invited_user_id, referral_code_applied, referral_created_at_timestamp)
            VALUES ($1, $2, $3, NOW())
            RETURNING *
        `;
        try {
            const result = await database.query(query, [referrerId, invitedId, code]);

            await this.awardPoints(referrerId, 100, 'REFERRAL_SUCCESS', invitedId.toString());
            await this.awardPoints(invitedId, 50, 'WELCOME_BONUS', referrerId.toString());

            logger.info(`Referencia confirmada: ${referrerId} indicou ${invitedId}`);
            return result.rows[0];
        } catch (error) {
            logger.error('Erro ao processar indicacao', error);
            throw error;
        }
    }

    static async getReferralStats(userId) {
        const query = `
            SELECT
                COUNT(*) as total_invited,
                (SELECT user_referral_code FROM users WHERE user_identification = $1) as my_code
            FROM referrals
            WHERE referral_owner_user_id = $1
        `;
        try {
            const result = await database.query(query, [userId]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    static async getDailyPointsStats() {
        const query = `
            SELECT DATE(point_created_at_timestamp) as day, SUM(point_amount_value) as total_awarded
            FROM points
            GROUP BY day
            ORDER BY day DESC
            LIMIT 30
        `;
        const result = await database.query(query);
        return result.rows;
    }

    static async deductPoints(userId, amount, reason) {
        const currentBalance = await this.getUserBalance(userId);
        if (currentBalance < amount) throw new Error('Saldo de pontos insuficiente para esta operacao.');

        const query = `
            INSERT INTO points (point_owner_user_id, point_amount_value, point_reason_description, point_created_at_timestamp)
            VALUES ($1, $2, $3, NOW())
            RETURNING *
        `;
        const result = await database.query(query, [userId, -amount, reason]);

        await database.query(`
            UPDATE users SET user_points_balance = user_points_balance - $1
            WHERE user_identification = $2
        `, [amount, userId]);

        return result.rows[0];
    }

    static async getMostCommonReasons() {
        const query = `
            SELECT point_reason_description, COUNT(*), SUM(point_amount_value)
            FROM points
            GROUP BY point_reason_description
            ORDER BY COUNT(*) DESC
        `;
        const result = await database.query(query);
        return result.rows;
    }

    static async validateReferralCode(code) {
        const query = `SELECT user_identification FROM users WHERE user_referral_code = $1 LIMIT 1`;
        const result = await database.query(query, [code]);
        return result.rows.length > 0 ? result.rows[0].user_identification : null;
    }

    static async getMonthlyTopUsers() {
        const query = `
            SELECT p.point_owner_user_id, u.user_full_name, SUM(p.point_amount_value) as monthly_points
            FROM points p
            JOIN users u ON p.point_owner_user_id = u.user_identification
            WHERE p.point_created_at_timestamp > NOW() - INTERVAL '30 days'
            AND p.point_amount_value > 0
            GROUP BY p.point_owner_user_id, u.user_full_name
            ORDER BY monthly_points DESC
            LIMIT 10
        `;
        const result = await database.query(query);
        return result.rows;
    }

    static async getReferralTree(userId) {
        const query = `
            SELECT u.user_full_name, u.user_university_name, r.referral_created_at_timestamp
            FROM users u
            JOIN referrals r ON u.user_identification = r.referral_invited_user_id
            WHERE r.referral_owner_user_id = $1
            ORDER BY r.referral_created_at_timestamp DESC
        `;
        const result = await database.query(query, [userId]);
        return result.rows;
    }

    static async auditPointsIntegrity() {
        const query = `
            SELECT u.user_identification, u.user_full_name, u.user_points_balance,
            (SELECT SUM(point_amount_value) FROM points WHERE point_owner_user_id = u.user_identification) as calculated_sum
            FROM users u
            WHERE u.user_points_balance != (SELECT COALESCE(SUM(point_amount_value), 0) FROM points WHERE point_owner_user_id = u.user_identification)
        `;
        const result = await database.query(query);
        return result.rows;
    }

    static async fixIntegrityIssues() {
        const issues = await this.auditPointsIntegrity();
        for (const issue of issues) {
            await database.query(`UPDATE users SET user_points_balance = $1 WHERE user_identification = $2`, [issue.calculated_sum || 0, issue.user_identification]);
            logger.warn(`Integridade de pontos corrigida para usuario ${issue.user_identification}`);
        }
        return true;
    }

    static async getGlobalEconomyReport() {
        const query = `
            SELECT
                (SELECT COUNT(*) FROM points WHERE point_amount_value > 0) as total_earnings,
                (SELECT COUNT(*) FROM points WHERE point_amount_value < 0) as total_redemptions,
                (SELECT SUM(point_amount_value) FROM points WHERE point_amount_value > 0) as total_vs_minted,
                (SELECT SUM(ABS(point_amount_value)) FROM points WHERE point_amount_value < 0) as total_vs_burned
        `;
        const result = await database.query(query);
        return result.rows[0];
    }

    static async getActiveUserBonus(userId) {
        return 0;
    }

    static async checkReferralEligibility(invitedEmail) {
        const query = `SELECT 1 FROM users WHERE user_email_address = $1`;
        const result = await database.query(query, [invitedEmail]);
        return result.rows.length === 0;
    }

    static async getReferralConversionRate() {
        return 1.0;
    }

    static async getPointsByHour() {
        const query = `
            SELECT EXTRACT(HOUR FROM point_created_at_timestamp) as hour, COUNT(*)
            FROM points
            GROUP BY hour
            ORDER BY hour ASC
        `;
        const result = await database.query(query);
        return result.rows;
    }

    static async getUserRank(userId) {
        const query = `
            SELECT rank FROM (
                SELECT user_identification, RANK() OVER (ORDER BY user_points_balance DESC) as rank
                FROM users
            ) as ranking
            WHERE user_identification = $1
        `;
        const result = await database.query(query, [userId]);
        return result.rows.length > 0 ? parseInt(result.rows[0].rank) : null;
    }

    static async getMilestones() {
        return [
            { name: 'Iniciante', points: 100 },
            { name: 'Engajado', points: 500 },
            { name: 'Influenciador', points: 2000 },
            { name: 'Lenda Academica', points: 10000 }
        ];
    }

    static async resetLeaderboard() {
        return false;
    }

    static async syncAllPoints() {
        return await this.fixIntegrityIssues();
    }

    toJSON() {
        return {
            transaction_id: this.transaction_id,
            amount: this.amount,
            reason: this.reason,
            reference: this.reference_id,
            timestamp: this.created_at
        };
    }

    static async getRetentionMetrics() {
        return {};
    }

    static async systemAudit() {
        logger.info('Iniciando auditoria de integridade da economia de pontos.');
        const stats = await this.getGlobalEconomyReport();
        logger.info(`Economia VlogStudents: VS Minted: ${stats.total_vs_minted} | VS Burned: ${stats.total_vs_burned}`);
    }
}

module.exports = VlogStudentsGamificationModel;

function monitorGamificationModelIntegrity() {
    logger.info('VlogStudents Gamification Model Layer inicializado para controle de economia VS.');
}

monitorGamificationModelIntegrity();