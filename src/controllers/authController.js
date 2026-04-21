/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE AUTH CONTROLLER v3.0.0
 * ORQUESTRADOR DE IDENTIDADE ACADÊMICA E SEGURANÇA
 * ============================================================================
 */

const db = require('../config/dbConfig');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

// Instanciação correta da classe Google com o operador 'new'
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authController = {

    /**
     * Autenticação padrão via E-mail e Senha
     */
    login: async (req, res) => {
        const { email, password } = req.body;
        try {
            console.log(`[AUTH] Tentativa de login: ${email}`);
            
            const userRes = await db.query(
                'SELECT * FROM users WHERE email = $1 AND isactive = true', 
                [email.toLowerCase().trim()]
            );

            if (userRes.rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Usuário não localizado.' });
            }

            const user = userRes.rows[0];
            const isMatch = await bcrypt.compare(password, user.password_hash);

            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
            }

            const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });

            res.status(200).json({
                success: true,
                data: {
                    token,
                    user: {
                        user_identification: user.id,
                        user_full_name: user.full_name,
                        user_email_address: user.email,
                        user_profile_picture_url: user.avatar_url,
                        user_university_name: user.university_name,
                        user_points_balance: user.points_total
                    }
                }
            });
        } catch (error) {
            console.error('[AUTH_ERROR] login:', error.stack);
            res.status(500).json({ success: false, message: 'Erro interno no Kernel de Identidade.' });
        }
    },

    /**
     * Registro de Novo Aluno (Onboarding)
     */
    register: async (req, res) => {
        const { fullName, email, password, university, referralCode } = req.body;
        const client = await db.connect();
        try {
            await client.query('BEGIN');

            const check = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
            if (check.rows.length > 0) {
                return res.status(409).json({ success: false, message: 'E-mail já cadastrado.' });
            }

            const salt = await bcrypt.genSalt(12);
            const hashed = await bcrypt.hash(password, salt);
            const myReferralCode = `VS_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            const result = await client.query(
                `INSERT INTO users (full_name, email, password_hash, university_name, referral_code, points_total, created_at, isactive)
                 VALUES ($1, $2, $3, $4, $5, 0, NOW(), true) RETURNING *`,
                [fullName.trim(), email.toLowerCase().trim(), hashed, university.trim(), myReferralCode]
            );

            const newUser = result.rows[0];

            if (referralCode) {
                const inviter = await client.query('SELECT id FROM users WHERE referral_code = $1', [referralCode.trim()]);
                if (inviter.rows.length > 0) {
                    await client.query('UPDATE users SET points_total = points_total + 150 WHERE id = $1', [inviter.rows[0].id]);
                    await client.query('UPDATE users SET points_total = 50 WHERE id = $1', [newUser.id]);
                }
            }

            await client.query('COMMIT');
            const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

            res.status(201).json({
                success: true,
                data: {
                    token,
                    user: {
                        user_identification: newUser.id,
                        user_full_name: newUser.full_name,
                        user_email_address: newUser.email,
                        user_university_name: newUser.university_name,
                        user_points_balance: newUser.points_total
                    }
                }
            });
        } catch (error) {
            await client.query('ROLLBACK');
            res.status(500).json({ success: false });
        } finally {
            client.release();
        }
    },

    /**
     * Autenticação via Google Cloud
     */
    googleAuth: async (req, res) => {
        const { googleToken } = req.body;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: googleToken,
                audience: process.env.GOOGLE_CLIENT_ID
            });
            const { email, name, picture, sub: googleId } = ticket.getPayload();

            let userRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            let user;

            if (userRes.rows.length === 0) {
                const myCode = `VSG_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const insert = await db.query(
                    `INSERT INTO users (full_name, email, avatar_url, google_id, university_name, referral_code, points_total, isactive)
                     VALUES ($1, $2, $3, $4, $5, $6, 50, true) RETURNING *`,
                    [name, email, picture, googleId, 'Estudante Google', myCode]
                );
                user = insert.rows[0];
            } else {
                user = userRes.rows[0];
            }

            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
            res.status(200).json({
                success: true,
                data: { token, user: { user_identification: user.id, user_full_name: user.full_name, user_email_address: user.email } }
            });
        } catch (error) {
            res.status(401).json({ success: false, message: 'Falha no Google Auth.' });
        }
    },

    /**
     * Solicitação de Recuperação (Request)
     */
    requestRecovery: async (req, res) => {
        const { email } = req.body;
        try {
            const recoveryCode = Math.floor(100000 + Math.random() * 900000);
            await db.query(
                'UPDATE users SET recovery_token = $1, recovery_expires = NOW() + INTERVAL \'15 minutes\' WHERE email = $2',
                [recoveryCode, email.toLowerCase().trim()]
            );
            console.log(`[RECOVERY] Código para ${email}: ${recoveryCode}`);
            res.status(200).json({ success: true, message: 'Código enviado.' });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    /**
     * Validação do Código de 6 dígitos
     */
    verifyRecoveryCode: async (req, res) => {
        const { email, code } = req.body;
        try {
            const result = await db.query(
                'SELECT id FROM users WHERE email = $1 AND recovery_token = $2 AND recovery_expires > NOW()',
                [email.toLowerCase().trim(), code]
            );
            if (result.rows.length === 0) {
                return res.status(400).json({ success: false, message: 'Código inválido.' });
            }
            res.status(200).json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    /**
     * Troca efetiva da senha
     */
    resetPassword: async (req, res) => {
        const { email, code, newPassword } = req.body;
        try {
            const hashed = await bcrypt.hash(newPassword, 12);
            const result = await db.query(
                'UPDATE users SET password_hash = $1, recovery_token = NULL WHERE email = $2 AND recovery_token = $3 RETURNING id',
                [hashed, email.toLowerCase().trim(), code]
            );
            if (result.rows.length === 0) return res.status(400).json({ success: false });
            res.status(200).json({ success: true, message: 'Senha alterada.' });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    /**
     * Validação de Sessão para Splash Screen
     */
    validateSession: async (req, res) => {
        try {
            const userRes = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
            if (userRes.rows.length === 0) return res.status(401).json({ success: false });
            const user = userRes.rows[0];
            res.status(200).json({
                success: true,
                data: {
                    user_identification: user.id,
                    user_full_name: user.full_name,
                    user_email_address: user.email,
                    user_profile_picture_url: user.avatar_url,
                    user_points_balance: user.points_total
                }
            });
        } catch (error) {
            res.status(401).json({ success: false });
        }
    }
};

module.exports = authController;
