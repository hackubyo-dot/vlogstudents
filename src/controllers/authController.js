/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE AUTH ORCHESTRATOR v2.0.1
 * SISTEMA DE IDENTIDADE FEDERADA, JWT E GAMIFICAÇÃO INICIAL
 * ============================================================================
 */

const db = require('../config/dbConfig');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

// CORREÇÃO CRÍTICA: Adicionado operador 'new' para instanciar a classe do Google
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authController = {

    /**
     * Autenticação via E-mail e Senha
     * Realiza a validação de credenciais e emite o Token Master
     */
    login: async (req, res) => {
        const { email, password } = req.body;

        try {
            console.log(`[AUTH_IDENTITY] Tentativa de acesso para: ${email}`);

            // 1. Busca usuário e dados sensíveis no Neon PostgreSQL
            const userRes = await db.query(
                'SELECT * FROM users WHERE email = $1 AND isActive = true', 
                [email.toLowerCase().trim()]
            );

            if (userRes.rows.length === 0) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Credenciais acadêmicas não localizadas no sistema.' 
                });
            }

            const user = userRes.rows[0];

            // 2. Verificação Criptográfica da Hash da Senha
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Senha incorreta para este registro acadêmico.' 
                });
            }

            // 3. Geração de Token Master (JWT) - Validade de 30 dias para Mobile
            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email, 
                    fullName: user.full_name 
                },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );

            // 4. Registro de Log de Acesso para Auditoria
            await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

            console.log(`[AUTH_SUCCESS] UID: ${user.id} autenticado com sucesso.`);

            // Resposta padronizada para o VlogUser.fromJson do Flutter
            res.status(200).json({
                success: true,
                data: {
                    token,
                    user: {
                        user_identification: user.id,
                        user_email_address: user.email,
                        user_full_name: user.full_name,
                        user_profile_picture_url: user.avatar_url,
                        user_university_name: user.university_name,
                        user_referral_code: user.referral_code,
                        user_points_balance: user.points_total,
                        user_theme_config: user.theme_pref,
                        user_account_status: user.isactive,
                        user_created_at_timestamp: user.created_at
                    }
                }
            });

        } catch (error) {
            console.error('[AUTH_FATAL_ERROR] login:', error.stack);
            res.status(500).json({ 
                success: false, 
                message: 'Instabilidade fatal no serviço de identidade Master.' 
            });
        }
    },

    /**
     * Registro de Novo Estudante (Onboarding)
     * Implementa lógica de Referral (Indicação) e Bônus Iniciais
     */
    register: async (req, res) => {
        const { fullName, email, password, university, referralCode } = req.body;

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            console.log(`[ONBOARDING] Iniciando protocolo de cadastro para: ${email}`);

            // 1. Validação de Duplicidade de E-mail
            const checkUser = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
            if (checkUser.rows.length > 0) {
                return res.status(409).json({ 
                    success: false, 
                    message: 'Este e-mail já possui um registro ativo no Campus.' 
                });
            }

            // 2. Fortalecimento de Segurança (Hash Argon2/Bcrypt)
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(password, salt);

            // 3. Geração de Código de Indicação Único para o novo aluno
            const myReferralCode = `VS_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            // 4. Criação do Usuário no Neon PostgreSQL com Status Ativo
            const newUserRes = await client.query(
                `INSERT INTO users (full_name, email, password_hash, university_name, referral_code, points_total, created_at, isActive)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW(), true) RETURNING *`,
                [fullName.trim(), email.toLowerCase().trim(), hashedPassword, university.trim(), myReferralCode, 0]
            );

            const newUser = newUserRes.rows[0];

            // 5. LÓGICA DE RECOMPENSA POR INDICAÇÃO (Referral Engine)
            if (referralCode && referralCode.trim().length > 0) {
                console.log(`[REFERRAL_CHECK] Validando cupom de indicação: ${referralCode}`);
                
                const inviterRes = await client.query('SELECT id, points_total FROM users WHERE referral_code = $1', [referralCode.trim()]);
                
                if (inviterRes.rows.length > 0) {
                    const inviterId = inviterRes.rows[0].id;
                    const rewardAmount = 150; // Voices (Pontos) por indicação validada

                    // Credita para quem convidou (O veterano)
                    await client.query('UPDATE users SET points_total = points_total + $1 WHERE id = $2', [rewardAmount, inviterId]);
                    await client.query(
                        'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
                        [inviterId, rewardAmount, 'USER_REFERRAL', newUser.id]
                    );

                    // Credita para quem entrou (O calouro - Bônus de boas-vindas)
                    await client.query('UPDATE users SET points_total = points_total + $1 WHERE id = $2', [50, newUser.id]);
                    await client.query(
                        'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
                        [newUser.id, 50, 'WELCOME_BONUS', inviterId]
                    );
                    
                    console.log(`[REFERRAL_SUCCESS] Voices aplicados a UID: ${inviterId} (+150) e UID: ${newUser.id} (+50)`);
                }
            }

            await client.query('COMMIT');

            // 6. Emissão de Token Master para Login Automático pós-cadastro
            const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

            res.status(201).json({
                success: true,
                message: 'Conta acadêmica criada e sincronizada.',
                data: {
                    token,
                    user: {
                        user_identification: newUser.id,
                        user_email_address: newUser.email,
                        user_full_name: newUser.full_name,
                        user_university_name: newUser.university_name,
                        user_referral_code: newUser.referral_code,
                        user_points_balance: newUser.points_total
                    }
                }
            });

        } catch (error) {
            if (client) await client.query('ROLLBACK');
            console.error('[ONBOARDING_ERROR]', error.stack);
            res.status(500).json({ 
                success: false, 
                message: 'Falha crítica ao processar registro acadêmico.' 
            });
        } finally {
            client.release();
        }
    },

    /**
     * Autenticação Federada via Google Cloud (OAuth2)
     * Resolve o fluxo de login social e criação automática de conta
     */
    googleAuth: async (req, res) => {
        const { googleToken } = req.body;

        if (!googleToken) {
            return res.status(400).json({ success: false, message: 'Google Token ausente.' });
        }

        try {
            console.log('[GOOGLE_AUTH] Validando integridade do token de federação...');

            const ticket = await googleClient.verifyIdToken({
                idToken: googleToken,
                audience: process.env.GOOGLE_CLIENT_ID
            });

            const payload = ticket.getPayload();
            const { email, name, picture, sub: googleId } = payload;

            // Lógica de Sincronização (Upsert)
            let userRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            let user;

            if (userRes.rows.length === 0) {
                console.log(`[GOOGLE_ONBOARD] Criando novo registro para: ${email}`);
                const myCode = `VSG_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                
                const insertRes = await db.query(
                    `INSERT INTO users (full_name, email, avatar_url, google_id, university_name, referral_code, points_total, isActive)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`,
                    [name, email, picture, googleId, 'Estudante Google', myCode, 50] // 50 pontos bônus por usar Google
                );
                user = insertRes.rows[0];
            } else {
                user = userRes.rows[0];
                // Atualização de Metadados do Google (Foto e último login)
                await db.query(
                    'UPDATE users SET avatar_url = $1, last_login = NOW() WHERE id = $2', 
                    [picture, user.id]
                );
            }

            const token = jwt.sign(
                { id: user.id, email: user.email, fullName: user.full_name }, 
                process.env.JWT_SECRET, 
                { expiresIn: '30d' }
            );

            res.status(200).json({
                success: true,
                data: { 
                    token, 
                    user: {
                        user_identification: user.id,
                        user_email_address: user.email,
                        user_full_name: user.full_name,
                        user_profile_picture_url: user.avatar_url,
                        user_university_name: user.university_name,
                        user_referral_code: user.referral_code,
                        user_points_balance: user.points_total
                    }
                }
            });

        } catch (error) {
            console.error('[GOOGLE_AUTH_ERROR]', error.message);
            res.status(401).json({ 
                success: false, 
                message: 'Falha na validação de identidade com o Google Cloud.' 
            });
        }
    },

    /**
     * Validação de Sessão Acadêmica (Heartbeat)
     * Usado pela Splash Screen para auto-login
     */
    validateSession: async (req, res) => {
        try {
            const userRes = await db.query('SELECT * FROM users WHERE id = $1 AND isActive = true', [req.user.id]);
            
            if (userRes.rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Sessão acadêmica revogada.' });
            }

            const user = userRes.rows[0];

            res.status(200).json({
                success: true,
                data: {
                    user_identification: user.id,
                    user_email_address: user.email,
                    user_full_name: user.full_name,
                    user_profile_picture_url: user.avatar_url,
                    user_university_name: user.university_name,
                    user_referral_code: user.referral_code,
                    user_points_balance: user.points_total
                }
            });
        } catch (error) {
            console.error('[SESSION_ERROR]', error.message);
            res.status(401).json({ success: false, message: 'Sessão corrompida.' });
        }
    },

    /**
     * Protocolo de Recuperação de Conta
     */
    requestRecovery: async (req, res) => {
        const { email } = req.body;
        try {
            const user = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
            
            if (user.rows.length === 0) {
                // Por segurança, retornamos 200 mesmo que o e-mail não exista
                return res.status(200).json({ 
                    success: true, 
                    message: 'Se o registro existir, as instruções de recuperação serão enviadas.' 
                });
            }

            const recoveryCode = Math.floor(100000 + Math.random() * 900000);
            
            // Gravação do código efêmero (Expira em 15 minutos)
            await db.query(
                'UPDATE users SET recovery_token = $1, recovery_expires = NOW() + INTERVAL \'15 minutes\' WHERE email = $2',
                [recoveryCode, email.toLowerCase().trim()]
            );

            // Log de Auditoria para Sistemas sem SMTP configurado ainda
            console.log(`[SECURITY_RECOVERY] Código de segurança emitido para ${email}: ${recoveryCode}`);

            res.status(200).json({ 
                success: true, 
                message: 'Protocolo de segurança iniciado. Verifique sua caixa de entrada.' 
            });
        } catch (error) {
            console.error('[RECOVERY_REQUEST_ERROR]', error.stack);
            res.status(500).json({ success: false });
        }
    },

    verifyRecoveryCode: async (req, res) => {
        const { email, code } = req.body;
        try {
            const result = await db.query(
                'SELECT id FROM users WHERE email = $1 AND recovery_token = $2 AND recovery_expires > NOW()',
                [email.toLowerCase().trim(), code]
            );

            if (result.rows.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Código de segurança inválido ou tempo de resposta expirado.' 
                });
            }

            res.status(200).json({ success: true, message: 'Código validado pelo Kernel.' });
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
                'UPDATE users SET password_hash = $1, recovery_token = NULL, updated_at = NOW() WHERE email = $2 AND recovery_token = $3 RETURNING id',
                [hashedPassword, email.toLowerCase().trim(), code]
            );

            if (result.rows.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Falha na redefinição. Por favor, reinicie o processo de segurança.' 
                });
            }

            res.status(200).json({ 
                success: true, 
                message: 'Credenciais atualizadas. Você já pode acessar seu perfil.' 
            });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    }
};

module.exports = authController;
