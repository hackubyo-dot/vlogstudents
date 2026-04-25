/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER VALIDATORS v12.0.0
 * ZOD SCHEMA ORCHESTRATION | ZERO ERROR TYPE CASTING
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Engenharia de Validação:
 * - Coerção Automática: Preprocessamento de IDs de String para Number.
 * - Suporte Multipart: Tratamento de campos vindos de FormData.
 * - Hybrid Social Logic: Validação de comentários em texto e áudio.
 * - Stories Engine: Esquema robusto para Status do Campus.
 * ============================================================================
 */

const { z } = require('zod');

/**
 * =========================================================================
 * 🔐 AUTHENTICATION SCHEMAS
 * =========================================================================
 */

// Esquema de Registro de Novo Aluno
const registerSchema = z.object({
    fullName: z.string()
        .min(3, "O nome completo deve ter no mínimo 3 caracteres")
        .max(100, "Nome muito extenso"),
    email: z.string()
        .email("Formato de e-mail institucional inválido")
        .toLowerCase(),
    password: z.string()
        .min(6, "A senha de acesso deve ter no mínimo 6 caracteres"),
    university: z.string()
        .min(2, "O nome da universidade é obrigatório para o networking"),
    referralCode: z.string().optional()
});

// Esquema de Login
const loginSchema = z.object({
    email: z.string()
        .email("E-mail inválido")
        .toLowerCase(),
    password: z.string()
        .min(1, "A senha é obrigatória")
});

/**
 * =========================================================================
 * 🎥 MEDIA & REELS SCHEMAS
 * =========================================================================
 */

const reelSchema = z.object({
    title: z.string()
        .min(1, "O título do Vlog é obrigatório")
        .max(200, "Título deve ser conciso (máx 200 chars)"),
    description: z.string()
        .max(1000, "A descrição excedeu o limite acadêmico")
        .optional(),
    duration: z.any().optional() // Recebe como string do FormData e trata no controller
});

/**
 * =========================================================================
 * 💬 SOCIAL & INTERACTION SCHEMAS
 * =========================================================================
 */

// FIX: Implementação de Preprocess para garantir integridade do ID no Neon DB
const commentSchema = z.object({
    content: z.string()
        .max(500, "Comentário muito longo")
        .optional(),
    // Converte automaticamente '123' em 123 (Essencial para Multipart/FormData)
    reelId: z.preprocess((val) => Number(val), z.number().int("ID do Reel inválido")),
    type: z.enum(['text', 'audio']).default('text')
});

/**
 * =========================================================================
 * ⏳ CAMPUS STATUS SCHEMAS (STORIES)
 * =========================================================================
 */

const statusSchema = z.object({
    type: z.enum(['text', 'video', 'audio', 'link', 'image'], {
        errorMap: () => ({ message: "Tipo de status inválido no campus" })
    }),
    content: z.string().optional(),
    backgroundColor: z.string()
        .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Cor de fundo inválida")
        .optional()
});

/**
 * =========================================================================
 * EXPORTAÇÃO DO NÚCLEO DE VALIDAÇÃO
 * =========================================================================
 */
module.exports = {
    registerSchema,
    loginSchema,
    reelSchema,
    commentSchema,
    statusSchema
};
