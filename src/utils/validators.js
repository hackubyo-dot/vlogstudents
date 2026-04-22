const { z } = require('zod');

const registerSchema = z.z.object({
    fullName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    universityName: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email('E-mail inválido'),
    password: z.string().min(1, 'Senha é obrigatória'),
});

const reelSchema = z.object({
    title: z.string().max(255).optional(),
    description: z.string().optional(),
});

const commentSchema = z.object({
    content: z.string().min(1, 'Comentário não pode estar vazio'),
});

module.exports = {
    registerSchema,
    loginSchema,
    reelSchema,
    commentSchema
};