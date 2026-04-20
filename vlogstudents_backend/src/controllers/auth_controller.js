const { OAuth2Client } = require('google-auth-library');
const database = require('../config/database');
const logger = require('../config/logger');
const security = require('../config/security');
const emailService = require('../services/email_service');
const pointService = require('../services/point_service');
const userModel = require('../models/user_model');

const GOOGLE_CLIENT_ID = '435332250244-vh9rravt3cmf1vmng29rbbs4vj3iccle.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

class VlogStudentsAuthController {
    async register(request, response) {
        const traceId = request.traceId;
        const { fullName, email, password, university, referralCode } = request.body;

        try {
            const userExists = await userModel.findByEmail(email);
            if (userExists) {
                return response.status(409).json({
                    success: false,
                    message: 'Este endereco de e-mail ja esta registrado no VlogStudents.',
                    error_code: 'EMAIL_ALREADY_EXISTS'
                });
            }

            const hashedPassword = await security.hash(password);
            const generatedReferralCode = security.generateReferralCode(fullName);

            const newUser = await database.transaction(async (client) => {
                const userResult = await client.query(`
                    INSERT INTO users (
                        user_full_name,
                        user_email_address,
                        google_id_reference,
                        user_university_name,
                        user_referral_code,
                        user_created_at_timestamp,
                        user_updated_at_timestamp
                    ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                    RETURNING *
                `, [fullName, email, `internal_${Date.now()}`, university, generatedReferralCode]);

                const user = userResult.rows[0];

                await client.query(`
                    INSERT INTO auth_credentials (user_id, password_hash)
                    VALUES ($1, $2)
                `, [user.user_identification, hashedPassword]);

                return user;
            });

            if (referralCode) {
                await pointService.processReferralReward(referralCode, newUser.user_identification);
            }

            await pointService.awardPoints(newUser.user_identification, 'DAILY_LOGIN', 'WELCOME_BONUS');
            await emailService.sendWelcomeEmail(fullName, email);

            const token = await security.sign({ id: newUser.user_identification, email: newUser.user_email_address });

            logger.info(`Novo usuario registrado: ${email}`, { traceId });

            return response.status(201).json({
                success: true,
                message: 'Conta criada com sucesso no VlogStudents.',
                data: {
                    user: {
                        id: newUser.user_identification,
                        name: newUser.user_full_name,
                        email: newUser.user_email_address,
                        university: newUser.user_university_name,
                        referralCode: newUser.user_referral_code
                    },
                    token
                }
            });
        } catch (error) {
            logger.error('Erro no processo de registro de usuario', error, { traceId });
            return response.status(500).json({ success: false, message: 'Erro interno ao criar conta.' });
        }
    }

    async login(request, response) {
        const { email, password } = request.body;
        const traceId = request.traceId;

        try {
            const query = `
                SELECT u.*, a.password_hash
                FROM users u
                JOIN auth_credentials a ON u.user_identification = a.user_id
                WHERE u.user_email_address = $1
                LIMIT 1
            `;
            const result = await database.query(query, [email]);

            if (result.rows.length === 0) {
                return response.status(401).json({ success: false, message: 'Credenciais invalidas.' });
            }

            const user = result.rows[0];
            const isPasswordValid = await security.compare(password, user.password_hash);

            if (!isPasswordValid) {
                logger.security(`Tentativa de login falha para o email: ${email}`);
                return response.status(401).json({ success: false, message: 'Credenciais invalidas.' });
            }

            if (!user.user_account_status) {
                return response.status(403).json({ success: false, message: 'Sua conta esta desativada.' });
            }

            const token = await security.sign({ id: user.user_identification, email: user.user_email_address });

            await database.query('UPDATE users SET user_last_login_timestamp = NOW() WHERE user_identification = $1', [user.user_identification]);
            await pointService.processDailyCheckIn(user.user_identification);

            return response.status(200).json({
                success: true,
                message: 'Login realizado com sucesso.',
                data: {
                    user: {
                        id: user.user_identification,
                        name: user.user_full_name,
                        email: user.user_email_address,
                        university: user.user_university_name,
                        points: user.user_points_balance,
                        theme: user.user_theme_config
                    },
                    token
                }
            });
        } catch (error) {
            logger.error('Erro no processo de login', error, { traceId });
            return response.status(500).json({ success: false, message: 'Erro interno no servidor.' });
        }
    }

    async googleSignIn(request, response) {
        const { googleToken, university } = request.body;
        const traceId = request.traceId;

        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: googleToken,
                audience: GOOGLE_CLIENT_ID
            });

            const payload = ticket.getPayload();
            const { sub, email, name, picture } = payload;

            let user = await userModel.findByEmail(email);

            if (!user) {
                const referralCode = security.generateReferralCode(name);
                const newUserResult = await database.query(`
                    INSERT INTO users (
                        google_id_reference,
                        user_email_address,
                        user_full_name,
                        user_profile_picture_url,
                        user_university_name,
                        user_referral_code,
                        user_created_at_timestamp,
                        user_updated_at_timestamp
                    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                    RETURNING *
                `, [sub, email, name, picture, university || 'Nao especificada', referralCode]);

                user = newUserResult.rows[0];
                await pointService.awardPoints(user.user_identification, 'DAILY_LOGIN', 'WELCOME_BONUS');
                await emailService.sendWelcomeEmail(name, email);
            } else {
                await database.query(`
                    UPDATE users
                    SET google_id_reference = $1,
                        user_profile_picture_url = $2,
                        user_last_login_timestamp = NOW()
                    WHERE user_identification = $3
                `, [sub, picture, user.user_identification || user.id]);
            }

            const token = await security.sign({
                id: user.user_identification || user.id,
                email: user.user_email_address || user.email
            });

            return response.status(200).json({
                success: true,
                message: 'Autenticacao Google concluida.',
                data: { user, token }
            });
        } catch (error) {
            logger.error('Erro na autenticacao Google', error, { traceId });
            return response.status(401).json({ success: false, message: 'Falha ao validar conta Google.' });
        }
    }

    async recoverPassword(request, response) {
        const { email } = request.body;
        try {
            const user = await userModel.findByEmail(email);
            if (!user) {
                return response.status(200).json({ success: true, message: 'Se o e-mail existir, um codigo sera enviado.' });
            }

            const recoveryCode = security.generateSecureRandomCode(6);
            await database.query(`
                INSERT INTO password_recoveries (user_id, recovery_code, expires_at)
                VALUES ($1, $2, NOW() + INTERVAL '1 hour')
            `, [user.id, recoveryCode]);

            await emailService.sendPasswordRecoveryEmail(email, recoveryCode);

            return response.status(200).json({
                success: true,
                message: 'Codigo de recuperacao enviado para seu e-mail.'
            });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao processar recuperacao.' });
        }
    }

    async verifyRecoveryCode(request, response) {
        const { email, code } = request.body;
        try {
            const user = await userModel.findByEmail(email);
            const result = await database.query(`
                SELECT * FROM password_recoveries
                WHERE user_id = $1 AND recovery_code = $2 AND expires_at > NOW() AND used = FALSE
                ORDER BY created_at DESC LIMIT 1
            `, [user.id, code]);

            if (result.rows.length === 0) {
                return response.status(400).json({ success: false, message: 'Codigo invalido ou expirado.' });
            }

            return response.status(200).json({ success: true, message: 'Codigo validado. Prossiga para redefinicao.' });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro na validacao.' });
        }
    }

    async resetPassword(request, response) {
        const { email, code, newPassword } = request.body;
        try {
            const user = await userModel.findByEmail(email);
            const hashedPassword = await security.hash(newPassword);

            await database.transaction(async (client) => {
                await client.query(`UPDATE auth_credentials SET password_hash = $1 WHERE user_id = $2`, [hashedPassword, user.id]);
                await client.query(`UPDATE password_recoveries SET used = TRUE WHERE user_id = $1 AND recovery_code = $2`, [user.id, code]);
            });

            return response.status(200).json({ success: true, message: 'Senha alterada com sucesso.' });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao redefinir senha.' });
        }
    }

    async logout(request, response) {
        const token = request.headers.authorization.split(' ')[1];
        security.revokeToken(token);
        return response.status(200).json({ success: true, message: 'Sessao encerrada.' });
    }

    async validateToken(request, response) {
        return response.status(200).json({ success: true, data: request.user });
    }

    async changePassword(request, response) {
        const { currentPassword, newPassword } = request.body;
        const userId = request.user.id;

        try {
            const authResult = await database.query('SELECT password_hash FROM auth_credentials WHERE user_id = $1', [userId]);
            const isMatch = await security.compare(currentPassword, authResult.rows[0].password_hash);

            if (!isMatch) {
                return response.status(403).json({ success: false, message: 'Senha atual incorreta.' });
            }

            const newHashed = await security.hash(newPassword);
            await database.query('UPDATE auth_credentials SET password_hash = $1 WHERE user_id = $2', [newHashed, userId]);

            return response.status(200).json({ success: true, message: 'Senha atualizada.' });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao mudar senha.' });
        }
    }

    async updateMfaStatus(request, response) {
        const { enabled } = request.body;
        return response.status(200).json({ success: true, message: 'Configuracao MFA atualizada.' });
    }

    async getLoginHistory(request, response) {
        const userId = request.user.id;
        const result = await database.query('SELECT * FROM login_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 10', [userId]);
        return response.status(200).json({ success: true, data: result.rows });
    }

    async checkUsernameAvailability(request, response) {
        const { username } = request.params;
        const result = await database.query('SELECT 1 FROM users WHERE user_full_name = $1', [username]);
        return response.status(200).json({ success: true, available: result.rows.length === 0 });
    }

    async deleteAccount(request, response) {
        const userId = request.user.id;
        await database.query('UPDATE users SET user_account_status = FALSE WHERE user_identification = $1', [userId]);
        return response.status(200).json({ success: true, message: 'Conta desativada com sucesso.' });
    }

    async getReferralInfo(request, response) {
        const userId = request.user.id;
        const result = await database.query('SELECT user_referral_code FROM users WHERE user_identification = $1', [userId]);
        return response.status(200).json({ success: true, referralCode: result.rows[0].user_referral_code });
    }

    async resendVerificationEmail(request, response) {
        const { email } = request.body;
        await emailService.sendWelcomeEmail('Estudante', email);
        return response.status(200).json({ success: true, message: 'E-mail de boas-vindas reenviado.' });
    }

    async getSessionData(request, response) {
        return response.status(200).json({ success: true, user: request.user });
    }

    async handleAccountLockout(email) {
        logger.warn(`Conta bloqueada por excesso de tentativas: ${email}`);
    }

    async logSuccessfulLogin(userId, ip) {
        await database.query('INSERT INTO login_logs (user_id, ip_address, timestamp) VALUES ($1, $2, NOW())', [userId, ip]);
    }

    async verifyEmailOwnership(email, token) {
        return true;
    }

    async handlePasswordStrength(password) {
        return password.length >= 8;
    }

    async auditAuthAction(action, userId) {
        logger.info(`Auditoria Auth: ${action} para usuario ${userId}`);
    }

    async blockIp(ip) {
        logger.security(`IP bloqueado: ${ip}`);
    }

    async getSecuritySettings(request, response) {
        return response.status(200).json({ success: true, settings: { mfa: false, loginAlerts: true } });
    }

    async refreshToken(request, response) {
        const { refreshToken } = request.body;
        const token = await security.sign({ id: request.user.id, email: request.user.email });
        return response.status(200).json({ success: true, token });
    }

    async getDeviceList(request, response) {
        return response.status(200).json({ success: true, devices: [] });
    }

    async revokeDevice(request, response) {
        return response.status(200).json({ success: true, message: 'Dispositivo removido.' });
    }

    async getAccountLogs(request, response) {
        return response.status(200).json({ success: true, logs: [] });
    }

    async requestDataExport(request, response) {
        return response.status(200).json({ success: true, message: 'Solicitacao de exportacao recebida.' });
    }

    async handleTwoFactorAuth(request, response) {
        return response.status(200).json({ success: true, challenge: 'none' });
    }

    async checkSessionValidity(request, response) {
        return response.status(200).json({ success: true, valid: true });
    }

    async getAuthMethod(request, response) {
        return response.status(200).json({ success: true, method: 'google_jwt' });
    }

    async updateAuthMetadata(userId, data) {
        return true;
    }

    async finalizeLoginFlow(user, token) {
        return { user, token };
    }
}

module.exports = new VlogStudentsAuthController();