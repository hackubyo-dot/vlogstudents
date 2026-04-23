/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - AUTH CONTROLLER v30.0.0 (FINAL ABSOLUTO)
 * Identity | Security | JWT | Referral | Recovery | Zero Error Policy
 * ============================================================================
 */

const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const { registerSchema, loginSchema } = require('../utils/validators');
const pointsService = require('../services/pointsService');

class AuthController {

    /**
     * =========================================================================
     * 🚀 REGISTER
     * =========================================================================
     */
    async register(req, res) {
        const client = await db.getClient();

        try {
            // ✅ VALIDATION
            const validation = registerSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Dados inválidos.',
                    errors: validation.error.format()
                });
            }

            const { fullName, email, password, university, referralCode } = validation.data;

            // 🔍 CHECK USER
            const userCheck = await client.query(
                'SELECT id FROM users WHERE email = $1',
                [email]
            );

            if (userCheck.rowCount > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'E-mail já registrado.'
                });
            }

            await client.query('BEGIN');

            // 🔐 HASH PASSWORD
            const salt = await bcrypt.genSalt(env.BCRYPT_SALT);
            const hashedPassword = await bcrypt.hash(password, salt);

            // 🎟 REFERRAL CODE
            const myReferralCode = `VS_${Math.random().toString(36).substring(2, 8).toUpperCase()}_${Date.now().toString().slice(-3)}`;

            // 👤 CREATE USER
            const result = await client.query(
                `INSERT INTO users 
                (full_name, email, password_hash, university_name, referral_code)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, full_name, email, university_name, referral_code, points_total`,
                [fullName, email, hashedPassword, university, myReferralCode]
            );

            const newUser = result.rows[0];

            // 🎁 BONUS BOAS-VINDAS
            await pointsService.addPointsTransactional(
                client,
                newUser.id,
                100,
                'Bônus de boas-vindas'
            );

            // 🤝 REFERRAL SYSTEM
            if (referralCode) {
                const inviter = await client.query(
                    'SELECT id FROM users WHERE referral_code = $1',
                    [referralCode]
                );

                if (inviter.rowCount > 0) {
                    const inviterId = inviter.rows[0].id;

                    // quem convidou
                    await pointsService.addPointsTransactional(
                        client,
                        inviterId,
                        50,
                        `Indicação de ${fullName}`,
                        newUser.id
                    );

                    // novo usuário
                    await pointsService.addPointsTransactional(
                        client,
                        newUser.id,
                        25,
                        'Bônus por convite',
                        inviterId
                    );
                }
            }

            await client.query('COMMIT');

            // 🔑 TOKEN
            const token = jwt.sign(
                { id: newUser.id },
                env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            return res.status(201).json({
                success: true,
                message: 'Conta criada com sucesso.',
                token,
                user: newUser
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[REGISTER_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao criar conta.'
            });

        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 🔐 LOGIN
     * =========================================================================
     */
    async login(req, res) {
        try {
            const { email, password } = loginSchema.parse(req.body);

            const result = await db.query(
                'SELECT * FROM users WHERE email = $1 AND isactive = true',
                [email]
            );

            if (result.rowCount === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciais inválidas.'
                });
            }

            const user = result.rows[0];

            const isMatch = await bcrypt.compare(password, user.password_hash);

            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Senha incorreta.'
                });
            }

            // 🧠 UPDATE LAST LOGIN
            await db.query(
                'UPDATE users SET last_login = NOW() WHERE id = $1',
                [user.id]
            );

            const token = jwt.sign(
                { id: user.id },
                env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // 🔒 CLEAN DATA
            delete user.password_hash;
            delete user.recovery_token;
            delete user.recovery_expires;

            return res.json({
                success: true,
                message: 'Login realizado.',
                token,
                user
            });

        } catch (error) {
            if (error.name === 'ZodError') {
                return res.status(400).json({
                    success: false,
                    message: 'Dados inválidos.'
                });
            }

            console.error('[LOGIN_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro no login.'
            });
        }
    }

    /**
     * =========================================================================
     * 📩 REQUEST RECOVERY
     * =========================================================================
     */
    async requestRecovery(req, res) {
        try {
            const { email } = req.body;

            const token = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = new Date(Date.now() + 3600000); // 1h

            const result = await db.query(
                `UPDATE users 
                 SET recovery_token = $1, recovery_expires = $2
                 WHERE email = $3
                 RETURNING id`,
                [token, expires, email]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'E-mail não encontrado.'
                });
            }

            console.log(`[RECOVERY TOKEN] ${email} -> ${token}`);

            return res.json({
                success: true,
                message: 'Código enviado.'
            });

        } catch (error) {
            console.error('[RECOVERY_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro na recuperação.'
            });
        }
    }

    /**
     * =========================================================================
     * 🔁 RESET PASSWORD (FINAL FIX)
     * =========================================================================
     */
    async resetPassword(req, res) {
        try {
            const { email, token, newPassword } = req.body;

            if (!email || !token || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Dados incompletos.'
                });
            }

            // 🔍 VALIDAR TOKEN
            const check = await db.query(
                `SELECT id FROM users 
                 WHERE email = $1 
                 AND recovery_token = $2 
                 AND recovery_expires > NOW()`,
                [email, token]
            );

            if (check.rowCount === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Código inválido ou expirado.'
                });
            }

            // 🔐 HASH NOVA SENHA
            const salt = await bcrypt.genSalt(env.BCRYPT_SALT);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // 💾 UPDATE PASSWORD
            await db.query(
                `UPDATE users 
                 SET password_hash = $1,
                     recovery_token = NULL,
                     recovery_expires = NULL
                 WHERE email = $2`,
                [hashedPassword, email]
            );

            return res.json({
                success: true,
                message: 'Senha redefinida com sucesso.'
            });

        } catch (error) {
            console.error('[RESET_PASSWORD_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao redefinir senha.'
            });
        }
    }
}

module.exports = new AuthController();
