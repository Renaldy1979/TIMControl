import { z } from "zod";
import { SCOPES } from "./enums";

/** Validações compartilhadas entre telas, Server Actions e testes. Mensagens em pt-BR. */
export const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(160);
export const passwordSchema = z.string().min(8, "A senha precisa ter ao menos 8 caracteres.").max(128, "A senha é longa demais.");
export const nameSchema = z.string().trim().min(2, "Informe o nome.").max(80, "Nome longo demais.");

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do projeto.").max(60),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "A sigla deve ter de 2 a 8 letras ou números."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
});

export const groupSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do grupo.").max(60),
  description: z.string().trim().max(200).optional().default(""),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do perfil.").max(40),
  allProjects: z.boolean(),
});

export const scopeSchema = z.enum(SCOPES).nullable();

/** Cores sugeridas para os projetos (selo colorido no card). */
export const PROJECT_COLORS = ["#7C5CFC", "#F59E0B", "#0EA5E9", "#10B981", "#EC4899", "#EF4444", "#6366F1", "#14B8A6"] as const;
