/**
 * ============================================================================
 * VLOGSTUDENTS MASTER AUTH CONTROLLER v2.0.8
 * ORQUESTRADOR DE IDENTIDADE COM LOG DE AUDITORIA ATIVO
 * ============================================================================
 */

const db = require('../config/dbConfig');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authController = {

    login: async (req, res) => {
        const { email, password } = req.body;
        console.log(`[AUTH_LOG] Tentativa de Login: ${email}`);

        try {
            // Unificação de nomes de colunas (PostgreSQL converte para lowercase se não citado)
            const userRes = await db.query(
                'SELECT * FROM users WHERE email = $1 AND isactive = true', 
                [email.toLowerCase().trim()]
            );

            if (userRes.rows.length === 0) {
                console.log(`[AUTH_FAIL] Usuário não encontrado: ${email}`);
                return res.status(401).json({ success: false, message: 'Registro não localizado.' });
            }

            const user = userRes.rows[0];
            const isMatch = await bcrypt.compare(password, user.password_hash);

            if (!isMatch) {
                console.log(`[AUTH_FAIL] Senha incorreta para: ${email}`);
                return res.status(401).json({ success: false, message: 'Senha inválida.' });
            }

            const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });

            console.log(`[AUTH_SUCCESS] UID ${user.id} logado.`);

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
            console.error('[AUTH_CRITICAL]', error.stack);
            res.status(500).json({ success: false, message: 'Erro no Kernel de Autenticação.' });
        }
    },

    register: async (req, res) => {
        const { fullName, email, password, university, referralCode } = req.body;
        console.log(`[AUTH_LOG] Novo registro solicitado: ${email}`);

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            const check = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
            if (check.rows.length > 0) {
                return res.status(409).json({ success: false, message: 'E-mail já em uso.' });
            }

            const salt = await bcrypt.genSalt(12);
            const hashed = await bcrypt.hash(password, salt);
            const myCode = `VS_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            const result = await client.query(
                `INSERT INTO users (full_name, email, password_hash, university_name, referral_code, points_total, created_at, isactive)
                 VALUES ($1, $2, $3, $4, $5, 0, NOW(), true) RETURNING *`,
                [fullName.trim(), email.toLowerCase().trim(), hashed, university.trim(), myCode]
            );

            const newUser = result.rows[0];

            // Referral Logic
            if (referralCode) {
                const inviter = await client.query('SELECT id FROM users WHERE referral_code = $1', [referralCode.trim()]);
                if (inviter.rows.length > 0) {
                    await client.query('UPDATE users SET points_total = points_total + 150 WHERE id = $1', [inviter.rows[0].id]);
                    await client.query('UPDATE users SET points_total = 50 WHERE id = $1', [newUser.id]);
                    console.log(`[REFERRAL_SYNC] Bônus aplicado via código: ${referralCode}`);
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
            console.error('[REGISTRATION_FATAL]', error.stack);
            res.status(500).json({ success: false });
        } finally {
            client.release();
        }
    }
};

module.exports = authController;
