const { z } = require('zod');

// Esquema de Registro
const registerSchema = z.object({
    fullName: z.string().min(3, "Nome muito curto").max(100),
    email: z.string().email("E-mail inválido").toLowerCase(),
    password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
    university: z.string().min(2, "Informe a universidade"),
    referralCode: z.string().optional()
});

// Esquema de Login
const loginSchema = z.object({
    email: z.string().email("E-mail inválido").toLowerCase(),
    password: z.string().min(1, "Senha obrigatória")
});

// Esquema de Reels
const reelSchema = z.object({
    title: z.string().min(1, "Título obrigatório").max(200),
    description: z.string().max(1000).optional(),
    duration: z.string().optional() // Multer envia como string no FormData
});

// Esquema de Comentários
const commentSchema = z.object({
    content: z.string().min(1).max(500),
    reelId: z.number().int()
});

module.exports = {
    registerSchema,
    loginSchema,
    reelSchema,
    commentSchema
};