/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - IDENTITY & AUTH CONTROLLER
 * Registro, Login, Recuperação e Validação de Sessão
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
     * ============================================================================
     * REGISTER
     * ============================================================================
     */
    async register(req, res) {
        const client = await db.getClient();

        try {
            // 1. VALIDATION (ZOD)
            const validation = registerSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Dados inválidos.',
                    errors: validation.error.format()
                });
            }

            const { fullName, email, password, university, referralCode } = validation.data;

            // 2. CHECK IF USER EXISTS
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

            // 3. HASH PASSWORD
            const salt = await bcrypt.genSalt(env.BCRYPT_SALT);
            const hashedPassword = await bcrypt.hash(password, salt);

            // 4. GENERATE REFERRAL CODE
            const myReferralCode = `VS_${Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase()}_${Date.now().toString().slice(-3)}`;

            // 5. INSERT USER
            const result = await client.query(
                `INSERT INTO users 
                (full_name, email, password_hash, university_name, referral_code)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, full_name, email, university_name, referral_code, points_total`,
                [fullName, email, hashedPassword, university, myReferralCode]
            );

            const newUser = result.rows[0];

            // 6. WELCOME BONUS
            await pointsService.addPointsTransactional(
                client,
                newUser.id,
                100,
                'Bônus de Boas-vindas'
            );

            // 7. REFERRAL SYSTEM
            if (referralCode) {
                const inviter = await client.query(
                    'SELECT id FROM users WHERE referral_code = $1',
                    [referralCode]
                );

                if (inviter.rowCount > 0) {
                    const inviterId = inviter.rows[0].id;

                    // Quem convidou
                    await pointsService.addPointsTransactional(
                        client,
                        inviterId,
                        50,
                        `Indicação de ${fullName}`,
                        newUser.id
                    );

                    // Novo usuário
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

            // 8. JWT TOKEN
            const token = jwt.sign(
                { id: newUser.id },
                env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            return res.status(201).json({
                success: true,
                message: 'Conta criada com sucesso.',
                token,
                user: {
                    ...newUser,
                    points: newUser.points_total + 125
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[REGISTER ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao criar conta.'
            });

        } finally {
            client.release();
        }
    }

    /**
     * ============================================================================
     * LOGIN
     * ============================================================================
     */
    async login(req, res) {
        try {
            const { email, password } = loginSchema.parse(req.body);

            // 1. FIND USER
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

            // 2. PASSWORD CHECK
            const isMatch = await bcrypt.compare(password, user.password_hash);

            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Senha incorreta.'
                });
            }

            // 3. UPDATE LAST LOGIN
            await db.query(
                'UPDATE users SET last_login = NOW() WHERE id = $1',
                [user.id]
            );

            // 4. GENERATE TOKEN
            const token = jwt.sign(
                { id: user.id },
                env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // 5. REMOVE SENSITIVE DATA
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

            console.error('[LOGIN ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro no login.'
            });
        }
    }

    /**
     * ============================================================================
     * PASSWORD RECOVERY
     * ============================================================================
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

            // Simulação envio email
            console.log(`[RECOVERY TOKEN] ${email} -> ${token}`);

            return res.json({
                success: true,
                message: 'Código de recuperação enviado.'
            });

        } catch (error) {
            console.error('[RECOVERY ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro na recuperação.'
            });
        }
    }
}

module.exports = new AuthController();
