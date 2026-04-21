/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE AUTH ORCHESTRATOR v2.0.0
 * SISTEMA DE IDENTIDADE FEDERADA, JWT E GAMIFICAÇÃO INICIAL
 * ============================================================================
 */

const db = require('../config/dbConfig');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

// Inicialização do Cliente Google para validação de Tokens Cloud
const googleClient = OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authController = {

    /**
     * Autenticação via E-mail e Senha
     */
    login: async (req, res) => {
        const { email, password } = req.body;

        try {
            console.log(`[AUTH_IDENTITY] Tentativa de acesso para: ${email}`);

            // 1. Busca usuário e dados sensíveis
            const userRes = await db.query(
                'SELECT * FROM users WHERE email = $1 AND isActive = true',
                [email.toLowerCase()]
            );

            if (userRes.rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciais acadêmicas não localizadas.'
                });
            }

            const user = userRes.rows[0];

            // 2. Verificação Criptográfica de Senha
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Senha incorreta para este registro.'
                });
            }

            // 3. Geração de Token Master (JWT)
            const token = jwt.sign(
                { id: user.id, email: user.email, fullName: user.full_name },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );

            // 4. Registro de Log de Acesso
            await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

            console.log(`[AUTH_SUCCESS] UID: ${user.id} autenticado.`);

            res.status(200).json({
                success: true,
                data: {
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                        full_name: user.full_name,
                        avatar_url: user.avatar_url,
                        university_name: user.university_name,
                        referral_code: user.referral_code,
                        points_total: user.points_total,
                        theme_pref: user.theme_pref
                    }
                }
            });

        } catch (error) {
            console.error('[AUTH_FATAL_ERROR] login:', error.stack);
            res.status(500).json({ success: false, message: 'Instabilidade no serviço de identidade.' });
        }
    },

    /**
     * Registro de Novo Estudante (Onboarding)
     * Implementa lógica de Referral (Indicação)
     */
    register: async (req, res) => {
        const { fullName, email, password, university, referralCode } = req.body;

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            console.log(`[ONBOARDING] Iniciando cadastro para: ${email}`);

            // 1. Validação de Duplicidade
            const checkUser = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
            if (checkUser.rows.length > 0) {
                return res.status(409).json({ success: false, message: 'Este e-mail já possui um registro ativo.' });
            }

            // 2. Hash de Segurança
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(password, salt);

            // 3. Geração de Código de Indicação Único
            const myReferralCode = `VS_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            // 4. Criação do Usuário no Neon PostgreSQL
            const newUserRes = await client.query(
                `INSERT INTO users (full_name, email, password_hash, university_name, referral_code, points_total, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
                [fullName, email.toLowerCase(), hashedPassword, university, myReferralCode, 0]
            );

            const newUser = newUserRes.rows[0];

            // 5. LÓGICA DE RECOMPENSA POR INDICAÇÃO (Referral Logic)
            if (referralCode) {
                console.log(`[REFERRAL_CHECK] Validando cupom: ${referralCode}`);

                const inviterRes = await client.query('SELECT id FROM users WHERE referral_code = $1', [referralCode]);

                if (inviterRes.rows.length > 0) {
                    const inviterId = inviterRes.rows[0].id;
                    const rewardAmount = 150; // Voices por indicação

                    // Credita para quem convidou
                    await client.query('UPDATE users SET points_total = points_total + $1 WHERE id = $2', [rewardAmount, inviterId]);
                    await client.query(
                        'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
                        [inviterId, rewardAmount, 'USER_REFERRAL', newUser.id]
                    );

                    // Credita para quem entrou (Bônus de boas-vindas)
                    await client.query('UPDATE users SET points_total = points_total + $1 WHERE id = $2', [50, newUser.id]);
                    await client.query(
                        'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
                        [newUser.id, 50, 'WELCOME_BONUS', inviterId]
                    );

                    console.log(`[REFERRAL_SUCCESS] Bônus aplicado a UID: ${inviterId} e UID: ${newUser.id}`);
                }
            }

            await client.query('COMMIT');

            // 6. Resposta com Token Automático
            const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

            res.status(201).json({
                success: true,
                message: 'Conta acadêmica criada com sucesso!',
                data: {
                    token,
                    user: newUser
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[ONBOARDING_ERROR]', error.stack);
            res.status(500).json({ success: false, message: 'Falha ao processar registro acadêmico.' });
        } finally {
            client.release();
        }
    },

    /**
     * Autenticação via Google Cloud (OAuth2)
     * Resolve o erro de "não consigo entrar com google"
     */
    googleAuth: async (req, res) => {
        const { googleToken } = req.body;

        try {
            console.log('[GOOGLE_AUTH] Validando token de federação...');

            const ticket = await googleClient.verifyIdToken({
                idToken: googleToken,
                audience: process.env.GOOGLE_CLIENT_ID
            });

            const payload = ticket.getPayload();
            const { email, name, picture, sub: googleId } = payload;

            // Lógica de UPSERT (Se existe loga, se não existe cria)
            let userRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            let user;

            if (userRes.rows.length === 0) {
                console.log(`[GOOGLE_ONBOARD] Criando novo registro para: ${email}`);
                const myCode = `VSG_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const insertRes = await db.query(
                    `INSERT INTO users (full_name, email, avatar_url, google_id, university_name, referral_code, points_total)
                     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                    [name, email, picture, googleId, 'Estudante Google', myCode, 50]
                );
                user = insertRes.rows[0];
            } else {
                user = userRes.rows[0];
                // Atualiza foto do Google se mudou
                await db.query('UPDATE users SET avatar_url = $1, last_login = NOW() WHERE id = $2', [picture, user.id]);
            }

            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

            res.status(200).json({
                success: true,
                data: { token, user }
            });

        } catch (error) {
            console.error('[GOOGLE_AUTH_ERROR]', error.message);
            res.status(401).json({ success: false, message: 'Falha na validação do Google Identity.' });
        }
    },

    /**
     * Validação de Sessão (Usado no Splash do Flutter)
     */
    validateSession: async (req, res) => {
        try {
            const userRes = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
            if (userRes.rows.length === 0) throw new Error();

            res.status(200).json({
                success: true,
                data: userRes.rows[0]
            });
        } catch (error) {
            res.status(401).json({ success: false, message: 'Sessão expirada.' });
        }
    },

    /**
     * Recuperação de Senha (Fluxo de Código por E-mail)
     */
    requestRecovery: async (req, res) => {
        const { email } = req.body;
        try {
            const user = await db.query('SELECT id FROM users WHERE email = $1', [email]);
            if (user.rows.length === 0) {
                return res.status(200).json({ success: true, message: 'Se o e-mail existir, um código será enviado.' });
            }

            const recoveryCode = Math.floor(100000 + Math.random() * 900000);

            // Grava código temporário (Expira em 15 min)
            await db.query(
                'UPDATE users SET recovery_token = $1, recovery_expires = NOW() + INTERVAL \'15 minutes\' WHERE email = $2',
                [recoveryCode, email]
            );

            // LOGICA DE ENVIO DE EMAIL (Simulação no log para auditoria)
            console.log(`[EMAIL_SYSTEM] Código de recuperação para ${email}: ${recoveryCode}`);

            res.status(200).json({ success: true, message: 'Código de segurança emitido.' });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    verifyRecoveryCode: async (req, res) => {
        const { email, code } = req.body;
        try {
            const result = await db.query(
                'SELECT id FROM users WHERE email = $1 AND recovery_token = $2 AND recovery_expires > NOW()',
                [email, code]
            );

            if (result.rows.length === 0) {
                return res.status(400).json({ success: false, message: 'Código inválido ou expirado.' });
            }

            res.status(200).json({ success: true, message: 'Código validado.' });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    resetPassword: async (req, res) => {
        const { email, code, newPassword } = req.body;
        try {
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            const result = await db.query(
                'UPDATE users SET password_hash = $1, recovery_token = NULL WHERE email = $2 AND recovery_token = $3 RETURNING id',
                [hashedPassword, email, code]
            );

            if (result.rows.length === 0) {
                return res.status(400).json({ success: false, message: 'Falha ao redefinir. Tente o processo novamente.' });
            }

            res.status(200).json({ success: true, message: 'Sua conta foi recuperada.' });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    }
};

module.exports = authController;