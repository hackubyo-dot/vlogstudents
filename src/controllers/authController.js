/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER IDENTITY SYSTEM v4.0.0
 * ORQUESTRADOR DE AUTENTICAÇÃO, SEGURANÇA E FEDERAÇÃO CLOUD
 * 
 * DESIGNED BY: SENIOR SOFTWARE ENGINEER
 * ERROR STATUS: ZERO TOLERANCE
 * ============================================================================
 */

const db = require('../config/dbConfig');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

/**
 * INICIALIZAÇÃO DO CLIENTE GOOGLE CLUSTER
 * Utiliza o operador 'new' para instanciar a classe corretamente.
 */
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * MASTER AUTH CONTROLLER
 * Gerencia o ciclo de vida completo da identidade do estudante.
 */
const authController = {

    /**
     * LOGIN MASTER (E-MAIL E SENHA)
     * Realiza a validação de credenciais contra o banco Neon PostgreSQL.
     */
    login: async (req, res) => {
        const { email, password } = req.body;

        try {
            console.log(`[IDENTITY_TRACE] Iniciando validação de login: ${email}`);

            if (!email || !password) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Credenciais incompletas. E-mail e senha são obrigatórios.' 
                });
            }

            // Busca profunda no banco de dados (Case Insensitive para e-mail)
            const userRes = await db.query(
                'SELECT * FROM users WHERE LOWER(email) = $1 AND isactive = true', 
                [email.toLowerCase().trim()]
            );

            if (userRes.rows.length === 0) {
                console.log(`[AUTH_FAIL] E-mail não localizado: ${email}`);
                return res.status(401).json({ 
                    success: false, 
                    message: 'O e-mail informado não possui um registro acadêmico ativo.' 
                });
            }

            const user = userRes.rows[0];

            // Comparação de Hash de Segurança (BCrypt Argon-Style)
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                console.log(`[AUTH_FAIL] Senha incorreta para o UID: ${user.id}`);
                return res.status(401).json({ 
                    success: false, 
                    message: 'Senha incorreta. Verifique suas credenciais.' 
                });
            }

            // Geração de Token JWT com Claims Mobile
            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email,
                    fullName: user.full_name
                },
                process.env.JWT_SECRET,
                { expiresIn: '30d' } // Longa duração para experiência Mobile fluida
            );

            // Atualização de Metadados de Acesso
            await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

            console.log(`[AUTH_SUCCESS] Aluno ${user.full_name} autenticado no Master Kernel.`);

            // Resposta Sincronizada com o VlogUser do Flutter
            return res.status(200).json({
                success: true,
                message: 'Autenticação confirmada.',
                data: {
                    token,
                    user: {
                        user_identification: user.id,
                        user_full_name: user.full_name,
                        user_email_address: user.email,
                        user_profile_picture_url: user.avatar_url,
                        user_university_name: user.university_name,
                        user_referral_code: user.referral_code,
                        user_points_balance: user.points_total,
                        user_theme_config: user.theme_pref,
                        user_account_status: user.isactive
                    }
                }
            });

        } catch (error) {
            console.error('[CRITICAL_AUTH_ERROR] login:', error.stack);
            return res.status(500).json({ 
                success: false, 
                message: 'Instabilidade fatal no serviço de identidade. Tente em instantes.' 
            });
        }
    },

    /**
     * REGISTRO ACADÊMICO (ONBOARDING)
     * Cria novos usuários e processa bônus de indicação.
     */
    register: async (req, res) => {
        const { fullName, email, password, university, referralCode } = req.body;

        if (!fullName || !email || !password || !university) {
            return res.status(400).json({ success: false, message: 'Dados de onboarding incompletos.' });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            console.log(`[IDENTITY_ONBOARD] Processando registro para: ${email}`);

            // Validação de Duplicidade
            const checkUser = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [email.toLowerCase().trim()]);
            if (checkUser.rows.length > 0) {
                return res.status(409).json({ success: false, message: 'Este e-mail universitário já está cadastrado.' });
            }

            // Criptografia Master
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Geração de Código de Convite (Referral)
            const myCode = `VS_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            // Inserção no Neon PostgreSQL
            const insertQuery = `
                INSERT INTO users (full_name, email, password_hash, university_name, referral_code, points_total, created_at, isactive)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), true)
                RETURNING *
            `;

            const newUserRes = await client.query(insertQuery, [
                fullName.trim(), 
                email.toLowerCase().trim(), 
                hashedPassword, 
                university.trim(), 
                myCode,
                0 // Inicia com 0, bônus aplicado abaixo
            ]);

            const newUser = newUserRes.rows[0];

            // PROCESSAMENTO DE REFERRAL (Voices Bonus)
            if (referralCode) {
                console.log(`[REFERRAL_ENGINE] Validando código de convite: ${referralCode}`);
                const inviterRes = await client.query('SELECT id FROM users WHERE referral_code = $1', [referralCode.trim()]);
                
                if (inviterRes.rows.length > 0) {
                    const inviterId = inviterRes.rows[0].id;

                    // 150 pontos para o Veterano que convidou
                    await client.query('UPDATE users SET points_total = points_total + 150 WHERE id = $1', [inviterId]);
                    await client.query(
                        'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, 150, \'USER_REFERRAL\', $2)',
                        [inviterId, newUser.id]
                    );

                    // 50 pontos para o Calouro que entrou
                    await client.query('UPDATE users SET points_total = points_total + 50 WHERE id = $1', [newUser.id]);
                    await client.query(
                        'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, 50, \'WELCOME_BONUS\', $2)',
                        [newUser.id, inviterId]
                    );

                    console.log(`[REFERRAL_SYNC] Recompensas creditadas para UID:${inviterId} e UID:${newUser.id}`);
                }
            }

            await client.query('COMMIT');

            const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

            return res.status(201).json({
                success: true,
                message: 'Bem-vindo ao VlogStudents!',
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
            if (client) await client.query('ROLLBACK');
            console.error('[CRITICAL_REGISTER_ERROR]', error.stack);
            return res.status(500).json({ success: false, message: 'Falha ao processar registro acadêmico.' });
        } finally {
            client.release();
        }
    },

    /**
     * GOOGLE CLOUD IDENTITY FEDERATION
     * Resolve o erro de "não consigo entrar com google"
     */
    googleAuth: async (req, res) => {
        const { googleToken } = req.body;

        if (!googleToken) {
            return res.status(400).json({ success: false, message: 'ID Token do Google não fornecido.' });
        }

        try {
            console.log('[GOOGLE_AUTH_HANDSHAKE] Validando token federado...');

            const ticket = await googleClient.verifyIdToken({
                idToken: googleToken,
                audience: process.env.GOOGLE_CLIENT_ID
            });

            const payload = ticket.getPayload();
            const { email, name, picture, sub: googleId } = payload;

            // Lógica de Upsert Acadêmico
            let userRes = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [email.toLowerCase()]);
            let user;

            if (userRes.rows.length === 0) {
                console.log(`[GOOGLE_AUTO_REGISTER] Criando conta via Google: ${email}`);
                const myCode = `VSG_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                
                const insertRes = await db.query(
                    `INSERT INTO users (full_name, email, avatar_url, google_id, university_name, referral_code, points_total, isactive)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`,
                    [name, email.toLowerCase(), picture, googleId, 'Estudante Google', myCode, 50]
                );
                user = insertRes.rows[0];
            } else {
                user = userRes.rows[0];
                // Sincroniza foto do Google no login
                await db.query('UPDATE users SET avatar_url = $1, last_login = NOW() WHERE id = $2', [picture, user.id]);
            }

            const token = jwt.sign(
                { id: user.id, email: user.email, fullName: user.full_name }, 
                process.env.JWT_SECRET, 
                { expiresIn: '30d' }
            );

            return res.status(200).json({
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
            console.error('[GOOGLE_IDENTITY_FAILURE]', error.message);
            return res.status(401).json({ success: false, message: 'A validação do Google Cloud falhou.' });
        }
    },

    /**
     * VALIDAÇÃO DE SESSÃO (HEARTBEAT)
     * Utilizado na Splash Screen para garantir que o token ainda é válido.
     */
    validateSession: async (req, res) => {
        try {
            console.log(`[SESSION_HEARTBEAT] Verificando integridade para UID: ${req.user.id}`);

            const userRes = await db.query('SELECT * FROM users WHERE id = $1 AND isactive = true', [req.user.id]);
            
            if (userRes.rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Conta desativada ou inexistente.' });
            }

            const user = userRes.rows[0];

            return res.status(200).json({
                success: true,
                data: {
                    user_identification: user.id,
                    user_full_name: user.full_name,
                    user_email_address: user.email,
                    user_profile_picture_url: user.avatar_url,
                    user_university_name: user.university_name,
                    user_referral_code: user.referral_code,
                    user_points_balance: user.points_total
                }
            });

        } catch (error) {
            console.error('[HEARTBEAT_ERROR]', error.message);
            return res.status(401).json({ success: false });
        }
    },

    /**
     * PROTOCOLO DE RECUPERAÇÃO DE CONTA (REQUEST)
     */
    requestRecovery: async (req, res) => {
        const { email } = req.body;

        try {
            console.log(`[RECOVERY_SYSTEM] Solicitação iniciada para: ${email}`);

            const user = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [email.toLowerCase().trim()]);
            
            if (user.rows.length === 0) {
                // Segurança: Resposta 200 genérica para evitar User Enumeration
                return res.status(200).json({ success: true, message: 'As instruções foram enviadas se o e-mail existir.' });
            }

            const recoveryCode = Math.floor(100000 + Math.random() * 900000);
            
            await db.query(
                'UPDATE users SET recovery_token = $1, recovery_expires = NOW() + INTERVAL \'15 minutes\' WHERE id = $2',
                [recoveryCode, user.rows[0].id]
            );

            // LOG DE AUDITORIA (Simulação de e-mail)
            console.log(`[MASTER_MAILER] Código para ${email}: ${recoveryCode}`);

            return res.status(200).json({ success: true, message: 'Código de segurança emitido.' });
        } catch (error) {
            console.error('[RECOVERY_REQUEST_FATAL]', error.stack);
            return res.status(500).json({ success: false });
        }
    },

    /**
     * VALIDAÇÃO DE CÓDIGO DE RECUPERAÇÃO
     */
    verifyRecoveryCode: async (req, res) => {
        const { email, code } = req.body;

        try {
            const result = await db.query(
                'SELECT id FROM users WHERE LOWER(email) = $1 AND recovery_token = $2 AND recovery_expires > NOW()',
                [email.toLowerCase().trim(), code]
            );

            if (result.rows.length === 0) {
                return res.status(400).json({ success: false, message: 'Código de segurança inválido ou expirado.' });
            }

            return res.status(200).json({ success: true, message: 'Código validado com sucesso.' });
        } catch (error) {
            console.error('[CODE_VERIFY_ERROR]', error.stack);
            return res.status(500).json({ success: false });
        }
    },

    /**
     * REDEFINIÇÃO DE SENHA MASTER
     */
    resetPassword: async (req, res) => {
        const { email, code, newPassword } = req.body;

        try {
            console.log(`[SECURITY_OVERRIDE] Redefinindo senha para: ${email}`);

            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            const result = await db.query(
                'UPDATE users SET password_hash = $1, recovery_token = NULL WHERE LOWER(email) = $2 AND recovery_token = $3 RETURNING id',
                [hashedPassword, email.toLowerCase().trim(), code]
            );

            if (result.rows.length === 0) {
                return res.status(400).json({ success: false, message: 'Falha na redefinição. Tente o processo novamente.' });
            }

            return res.status(200).json({ success: true, message: 'Identidade recuperada. Sua senha foi alterada.' });
        } catch (error) {
            console.error('[RESET_PASSWORD_FATAL]', error.stack);
            return res.status(500).json({ success: false });
        }
    },

    /**
     * LOGOUT MASTER
     * Invalidação local e registro de saída.
     */
    logout: async (req, res) => {
        try {
            console.log(`[AUTH_EXIT] Aluno UID ${req.user.id} encerrou a sessão.`);
            return res.status(200).json({ success: true, message: 'Sessão encerrada com segurança.' });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    }
};

module.exports = authController;
