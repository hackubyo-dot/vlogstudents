const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { registerSchema, loginSchema } = require('../utils/validators');
const { v4: uuidv4 } = require('uuid');

class AuthController {
    async register(req, res, next) {
        try {
            // Validação de entrada
            const validatedData = registerSchema.parse(req.body);
            const { fullName, email, password, universityName } = validatedData;

            // Verificar se usuário já existe
            const userExists = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
            if (userExists.rowCount > 0) {
                return res.status(400).json({ success: false, message: 'Este e-mail já está em uso.' });
            }

            // Hash da senha e geração de código de convite
            const salt = await bcrypt.genSalt(12);
            const passwordHash = await bcrypt.hash(password, salt);
            const referralCode = `VS-${uuidv4().substring(0, 8).toUpperCase()}`;

            // Inserção no Neon (PostgreSQL)
            const newUser = await db.query(
                `INSERT INTO users (full_name, email, password_hash, university_name, referral_code)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, referral_code`,
                [fullName, email.toLowerCase(), passwordHash, universityName || null, referralCode]
            );

            // Geração do Token
            const token = jwt.sign({ id: newUser.rows[0].id }, env.jwtSecret, { expiresIn: '30d' });

            res.status(201).json({
                success: true,
                message: 'Conta criada com sucesso!',
                token,
                user: newUser.rows[0]
            });
        } catch (error) {
            next(error);
        }
    }

    async login(req, res, next) {
        try {
            const { email, password } = loginSchema.parse(req.body);

            const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
            if (result.rowCount === 0) {
                return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
            }

            const user = result.rows[0];
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
            }

            if (!user.isactive) {
                return res.status(403).json({ success: false, message: 'Sua conta está desativada.' });
            }

            // Atualizar último login
            await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

            const token = jwt.sign({ id: user.id }, env.jwtSecret, { expiresIn: '30d' });

            // Remover senha do objeto de resposta
            delete user.password_hash;

            res.json({
                success: true,
                token,
                user
            });
        } catch (error) {
            next(error);
        }
    }

    async requestPasswordRecovery(req, res, next) {
        try {
            const { email } = req.body;
            const token = uuidv4();
            const expires = new Date(Date.now() + 3600000); // 1 hora

            const result = await db.query(
                'UPDATE users SET recovery_token = $1, recovery_expires = $2 WHERE email = $3 RETURNING id',
                [token, expires, email.toLowerCase()]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
            }

            // Em produção aqui enviaria um e-mail. Por enquanto retornamos o token.
            res.json({
                success: true,
                message: 'Instruções de recuperação enviadas para o seu e-mail.',
                debug_token: token
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();