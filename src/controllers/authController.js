// FILE: src/controllers/authController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { registerSchema, loginSchema } = require('../utils/validators');

/**
 * Controlador de Autenticação Enterprise
 */
const authController = {
  /**
   * Registro de novo estudante
   */
  async register(req, res) {
    try {
      const validation = registerSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          errors: validation.error.format()
        });
      }

      const { fullName, email, password, university } = validation.data;

      // Verificar se usuário existe
      const checkUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (checkUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Este endereço de e-mail já está cadastrado.'
        });
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, env.BCRYPT_SALT);

      // Inserção
      const newUser = await db.query(
        `INSERT INTO users (full_name, email, password_hash, university)
         VALUES ($1, $2, $3, $4) RETURNING id, full_name, email`,
        [fullName, email, hashedPassword, university]
      );

      res.status(201).json({
        success: true,
        message: 'Registro concluído com sucesso.',
        user: newUser.rows[0]
      });

    } catch (error) {
      console.error('[AUTH_REGISTER_ERROR]', error);
      res.status(500).json({ success: false, message: 'Falha interna ao processar registro.' });
    }
  },

  /**
   * Login e geração de Token JWT
   */
  async login(req, res) {
    try {
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, errors: validation.error.format() });
      }

      const { email, password } = validation.data;

      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
      }

      const user = result.rows[0];

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
      }

      // Geração de Token
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.full_name },
        env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Atualizar last login
      await db.query('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

      res.status(200).json({
        success: true,
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          avatarUrl: user.avatar_url,
          points: user.points_total
        }
      });

    } catch (error) {
      console.error('[AUTH_LOGIN_ERROR]', error);
      res.status(500).json({ success: false, message: 'Erro no servidor durante a autenticação.' });
    }
  }
};

module.exports = authController;