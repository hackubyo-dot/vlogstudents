/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - AUTH CONTROLLER v32.0.0 (ULTIMATE EDITION)
 * IDENTITY MANAGER | GOOGLE FEDERATION | NEON DB SYNC | ECONOMY ENGINE
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Este controlador gerencia o ciclo de vida completo da identidade:
 * - Google Federated Identity: Login/Registro automático via Google Cloud.
 * - Registro Tradicional: Com sistema de bônus e indicação (Referral).
 * - Login Seguro: Bcrypt + JWT de 7 dias.
 * - Disaster Recovery: Sistema de PIN de recuperação de 6 dígitos.
 * - Motor de Pontos: Integração transacional com o Neon DB.
 * ============================================================================
 */

const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { OAuth2Client } = require('google-auth-library');

// Inicialização do Cliente Google para validação de tokens JWT do Google
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const pointsService = require('../services/pointsService');
const { registerSchema, loginSchema } = require('../utils/validators');

class AuthController {

    /**
     * =========================================================================
     * 🌐 GOOGLE AUTH ENGINE (LOGIN/REGISTER AUTOMÁTICO)
     * Elimina atrito: Se não existe, cria. Se existe, loga.
     * =========================================================================
     */
    async googleAuth(req, res) {
        const pgClient = await db.getClient();
        try {
            const { idToken } = req.body;

            if (!idToken) {
                return res.status(400).json({ success: false, message: 'ID Token ausente.' });
            }

            // 1. Validar a integridade do Token com o Google Cloud
            const ticket = await googleClient.verifyIdToken({
                idToken: idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            const { email, name, picture, sub: googleId } = payload;

            await pgClient.query('BEGIN');

            // 2. Verificar existência do registro acadêmico pelo E-mail
            let userResult = await pgClient.query(
                'SELECT * FROM users WHERE email = $1',
                [email.toLowerCase()]
            );

            let user;
            let isNewUser = false;

            if (userResult.rowCount === 0) {
                // 3. REGISTRO AUTOMÁTICO (Primeiro acesso via Google)
                isNewUser = true;
                
                // Senha dummy para manter compatibilidade com o esquema legacy
                const dummyPassword = await bcrypt.hash(googleId + env.JWT_SECRET, 10);
                
                // Geração de Referral Code Único para Google Users
                const referralCode = `VS_G_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

                const insertResult = await pgClient.query(
                    `INSERT INTO users 
                    (full_name, email, password_hash, avatar_url, university_name, referral_code, points_total)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING *`,
                    [name, email.toLowerCase(), dummyPassword, picture, 'Campus Google', referralCode, 0]
                );
                user = insertResult.rows[0];

                // 🎁 BÔNUS DE BOAS-VINDAS GOOGLE (100 Voices)
                await pointsService.addPointsTransactional(
                    pgClient,
                    user.id,
                    100,
                    'Boas-vindas (Google Identity)'
                );
            } else {
                // 4. LOGIN (Usuário já existe na base Neon)
                user = userResult.rows[0];
                
                // Sincronização de Avatar: Atualizar se o do Google for mais recente
                if (picture && user.avatar_url !== picture) {
                    await pgClient.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [picture, user.id]);
                    user.avatar_url = picture;
                }
            }

            // Atualiza timestamp de último login
            await pgClient.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

            await pgClient.query('COMMIT');

            // 5. Geração de Token de Acesso VlogStudents (Válido por 7 dias)
            const token = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: '7d' });

            // Proteção de Dados: Remove hash de senha da resposta
            delete user.password_hash;
            delete user.recovery_token;
            delete user.recovery_expires;

            return res.json({
                success: true,
                message: isNewUser ? 'Registro via Google concluído.' : 'Bem-vindo de volta!',
                token,
                user: {
                    ...user,
                    points_total: isNewUser ? 100 : user.points_total
                }
            });

        } catch (error) {
            await pgClient.query('ROLLBACK');
            console.error('[GOOGLE_AUTH_FATAL]', error);
            return res.status(401).json({ success: false, message: 'Falha na autenticação federada.' });
        } finally {
            pgClient.release();
        }
    }

    /**
     * =========================================================================
     * 🚀 REGISTER TRADICIONAL
     * Com suporte a indicação (Referral) e bônus de boas-vindas.
     * =========================================================================
     */
    async register(req, res) {
        const client = await db.getClient();

        try {
            // Validação de Esquema Zod
            const validation = registerSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Dados inválidos.',
                    errors: validation.error.format()
                });
            }

            const { fullName, email, password, university, referralCode } = validation.data;

            // Auditoria de E-mail Único
            const userCheck = await client.query(
                'SELECT id FROM users WHERE email = $1',
                [email.toLowerCase()]
            );

            if (userCheck.rowCount > 0) {
                return res.status(409).json({ success: false, message: 'Este e-mail já possui um registro ativo.' });
            }

            await client.query('BEGIN');

            // Criptografia AES de Senha
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Geração de Código de Indicação Personalizado
            const myReferralCode = `VS_${Math.random().toString(36).substring(2, 8).toUpperCase()}_${Date.now().toString().slice(-3)}`;

            // Inserção do novo estudante
            const result = await client.query(
                `INSERT INTO users 
                (full_name, email, password_hash, university_name, referral_code)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, full_name, email, university_name, referral_code, points_total`,
                [fullName, email.toLowerCase(), hashedPassword, university, myReferralCode]
            );

            const newUser = result.rows[0];

            // 🎁 BÔNUS DE ENTRADA (100 Voices)
            await pointsService.addPointsTransactional(client, newUser.id, 100, 'Bônus de boas-vindas');

            // 🤝 SISTEMA DE INDICAÇÃO (REFERRAL SYNC)
            if (referralCode) {
                const inviter = await client.query(
                    'SELECT id, full_name FROM users WHERE referral_code = $1',
                    [referralCode.trim()]
                );

                if (inviter.rowCount > 0) {
                    const inviterData = inviter.rows[0];

                    // Quem convidou recebe 50 Voices
                    await pointsService.addPointsTransactional(
                        client, inviterData.id, 50, `Indicação: ${fullName}`, newUser.id
                    );

                    // Quem foi convidado recebe +25 Voices extras
                    await pointsService.addPointsTransactional(
                        client, newUser.id, 25, 'Bônus de indicação aceita', inviterData.id
                    );
                }
            }

            await client.query('COMMIT');

            const token = jwt.sign({ id: newUser.id }, env.JWT_SECRET, { expiresIn: '7d' });

            return res.status(201).json({
                success: true,
                message: 'Registro acadêmico concluído!',
                token,
                user: newUser
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[REGISTER_ERROR]', error);
            return res.status(500).json({ success: false, message: 'Erro crítico no processamento de registro.' });
        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 🔐 LOGIN TRADICIONAL
     * Validação Bcrypt com atualização de metadados.
     * =========================================================================
     */
    async login(req, res) {
        try {
            const { email, password } = loginSchema.parse(req.body);

            const result = await db.query(
                'SELECT * FROM users WHERE email = $1 AND isactive = true',
                [email.toLowerCase()]
            );

            if (result.rowCount === 0) {
                return res.status(401).json({ success: false, message: 'Registro não localizado ou inativo.' });
            }

            const user = result.rows[0];
            const isMatch = await bcrypt.compare(password, user.password_hash);

            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Credenciais inválidas para este campus.' });
            }

            // Log de acesso
            await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

            const token = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: '7d' });

            // Sanitização de resposta
            delete user.password_hash;
            delete user.recovery_token;
            delete user.recovery_expires;

            return res.json({
                success: true,
                message: 'Login autorizado.',
                token,
                user
            });

        } catch (error) {
            console.error('[LOGIN_ERROR]', error);
            return res.status(error.name === 'ZodError' ? 400 : 500).json({
                success: false,
                message: error.name === 'ZodError' ? 'Dados mal formatados.' : 'Erro interno no gateway de login.'
            });
        }
    }

    /**
     * =========================================================================
     * 📩 REQUEST RECOVERY (PIN SYSTEM)
     * Gera um código OTP de 6 dígitos para o e-mail.
     * =========================================================================
     */
    async requestRecovery(req, res) {
        try {
            const { email } = req.body;
            if (!email) return res.status(400).json({ success: false, message: 'E-mail é obrigatório.' });

            // Gera PIN de 6 dígitos
            const pin = Math.floor(100000 + Math.random() * 900000).toString();
            const expiry = new Date(Date.now() + 3600000); // Expira em 1 hora

            const result = await db.query(
                `UPDATE users 
                 SET recovery_token = $1, recovery_expires = $2
                 WHERE email = $3 AND isactive = true
                 RETURNING id`,
                [pin, expiry, email.toLowerCase()]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'Conta não localizada.' });
            }

            // Auditoria (Em produção, aqui dispararia o serviço de SendGrid/Nodemailer)
            console.log(`[SECURITY_PIN] Destino: ${email} | PIN: ${pin}`);

            return res.json({
                success: true,
                message: 'Código de segurança enviado para o e-mail cadastrado.'
            });

        } catch (error) {
            console.error('[RECOVERY_ERROR]', error);
            return res.status(500).json({ success: false, message: 'Erro ao processar recuperação de senha.' });
        }
    }

    /**
     * =========================================================================
     * 🔁 RESET PASSWORD
     * Validação do PIN e atualização da Password Hash.
     * =========================================================================
     */
    async resetPassword(req, res) {
        try {
            const { email, token, newPassword } = req.body;

            if (!email || !token || !newPassword) {
                return res.status(400).json({ success: false, message: 'Parâmetros de reset incompletos.' });
            }

            // Validação de PIN e Tempo
            const check = await db.query(
                `SELECT id FROM users 
                 WHERE email = $1 
                 AND recovery_token = $2 
                 AND recovery_expires > NOW()`,
                [email.toLowerCase(), token]
            );

            if (check.rowCount === 0) {
                return res.status(400).json({ success: false, message: 'Código inválido, expirado ou e-mail incorreto.' });
            }

            // Atualização de Segurança
            const salt = await bcrypt.genSalt(12);
            const hashedNewPassword = await bcrypt.hash(newPassword, salt);

            await db.query(
                `UPDATE users 
                 SET password_hash = $1,
                     recovery_token = NULL,
                     recovery_expires = NULL
                 WHERE email = $2`,
                [hashedNewPassword, email.toLowerCase()]
            );

            return res.json({
                success: true,
                message: 'Chave mestra atualizada. Prossiga para o login.'
            });

        } catch (error) {
            console.error('[RESET_FATAL]', error);
            return res.status(500).json({ success: false, message: 'Erro ao redefinir credenciais.' });
        }
    }
}

module.exports = new AuthController();

/**
 * ============================================================================
 * FIM DO AUTH CONTROLLER ENTERPRISE v32.0.0
 * ESTE CÓDIGO É PROPRIEDADE INTELECTUAL DO ECOSSISTEMA VLOGSTUDENTS.
 * PRODUZIDO POR MASTER SOFTWARE ENGINEER.
 * ============================================================================
 */
