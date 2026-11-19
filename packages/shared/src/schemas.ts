import { z } from "zod";
import { CARD_STATUSES, PRIORITIES, SCOPES } from "./enums";

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

// ---------- Kanban (Lote 2) ----------

const uuid = z.string().uuid();
/** Data do formulário (input type="date"): AAAA-MM-DD ou vazio. */
const optionalDate = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.");

/** Responsável: pessoa (`u:<id>`) ou grupo (`g:<id>`). */
export const assigneeRefSchema = z.string().regex(/^[ug]:[0-9a-f-]{36}$/i, "Responsável inválido.");

export const cardSchema = z
  .object({
    projectId: uuid.refine(Boolean, "Escolha o projeto."),
    title: z.string().trim().min(3, "Informe o título (ao menos 3 letras).").max(160, "Título longo demais."),
    description: z.string().trim().max(10000, "Descrição longa demais.").default(""),
    status: z.enum(CARD_STATUSES).default("todo"),
    priority: z.enum(PRIORITIES, { message: "Escolha a prioridade." }).default("normal"),
    dueDate: optionalDate,
    /** Todo card é para alguém: ao menos uma pessoa ou um grupo. */
    assignees: z.array(assigneeRefSchema).min(1, "Escolha ao menos um responsável (pessoa ou grupo).").max(30),
    labelIds: z.array(uuid).max(20).default([]),
    externalRef: z.string().trim().max(120, "Referência longa demais.").default(""),
  });
export type CardInput = z.infer<typeof cardSchema>;

export const labelSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da etiqueta.").max(30, "Nome longo demais."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
});
