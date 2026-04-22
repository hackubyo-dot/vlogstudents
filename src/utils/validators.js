// FILE: src/utils/validators.js
const { z } = require('zod');

/**
 * Esquemas de validação robustos utilizando ZOD
 * Garante tipagem e integridade antes de atingir o controlador
 */

const registerSchema = z.object({
  fullName: z.string().min(3, "O nome deve ter no mínimo 3 caracteres").max(100),
  email: z.string().email("Endereço de e-mail inválido").toLowerCase(),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  university: z.string().min(2, "Informe o nome da universidade").optional()
});

const loginSchema = z.object({
  email: z.string().email("E-mail inválido").toLowerCase(),
  password: z.string().min(1, "A senha é obrigatória")
});

const reelSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional()
});

module.exports = {
  registerSchema,
  loginSchema,
  reelSchema
};