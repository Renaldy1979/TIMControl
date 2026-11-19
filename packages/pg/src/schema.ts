import { sql } from "drizzle-orm";
import { bigserial, boolean, check, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Modelo de dados do Lote 1 (docs/02-banco-de-dados.md é a fonte da verdade).
 * Nomes técnicos em inglês; a interface fala português. Datas em UTC.
 * O isolamento (quem vê o quê) está no RLS, em drizzle/0001_rls.sql.
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** gestor | membro | visitante; null para perfis criados pelo Gestor. */
    systemKey: text("system_key"),
    /** Vê todos os projetos com este perfil, sem precisar ser incluído em cada um. */
    allProjects: boolean("all_projects").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("profiles_name_uq").on(sql`lower(${t.name})`),
    uniqueIndex("profiles_system_key_uq").on(t.systemKey),
    check("profiles_system_key_ck", sql`${t.systemKey} is null or ${t.systemKey} in ('gestor','membro','visitante')`),
  ],
);

/** Matriz perfil × funcionalidade × ação. Linha ausente = não pode. */
export const profilePermissions = pgTable(
  "profile_permissions",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** `funcionalidade.ação`, ex.: kanban.edit */
    permission: text("permission").notNull(),
    scope: text("scope").notNull(),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.permission] }), check("profile_permissions_scope_ck", sql`${t.scope} in ('all','own')`)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Vínculo com a conta do Appwrite (login e senha ficam lá). Null enquanto o convite não foi aceito. */
    appwriteUserId: text("appwrite_user_id"),
    name: text("name").notNull(),
    email: text("email").notNull(),
    state: text("state").notNull().default("invited"),
    globalProfileId: uuid("global_profile_id")
      .notNull()
      .references(() => profiles.id),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(sql`lower(${t.email})`),
    uniqueIndex("users_appwrite_uq").on(t.appwriteUserId),
    check("users_state_ck", sql`${t.state} in ('invited','active','disabled')`),
  ],
);

/** Convite por e-mail: guarda só o hash do token; vale 7 dias e uma vez. */
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("invites_token_uq").on(t.tokenHash), index("invites_user_ix").on(t.userId)],
);

/** Projeto = sistema coberto (TIM Vendas, WhatsApp CX, Ecommerce...). */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    color: text("color").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("projects_name_uq").on(sql`lower(${t.name})`),
    uniqueIndex("projects_code_uq").on(t.code),
  ],
);

/** Perfil da pessoa num projeto. É o que libera projetos ao Visitante (e às pessoas das fábricas). */
export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] }), index("project_members_user_ix").on(t.userId)],
);

/** Grupo = forma de colocar várias pessoas como responsável de uma vez (Time TIM, Accenture, Engineering...). */
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("groups_name_uq").on(sql`lower(${t.name})`)],
);

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index("group_members_user_ix").on(t.userId)],
);

/** Quem fez o quê na administração. Sem dados sensíveis em `details`. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_created_ix").on(t.createdAt)],
);

// ======================= Lote 2: Kanban =======================

const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/** Card do quadro: uma tarefa sempre com responsável (pessoa ou grupo). Colunas fixas em `status`; ordem na coluna em `position`. */
export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("todo"),
    position: doublePrecision("position").notNull().default(0),
    priority: text("priority").notNull().default("normal"),
    dueDate: date("due_date"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    /** Número de bug/chamado em outra ferramenta, só como texto. */
    externalRef: text("external_ref").notNull().default(""),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("cards_board_ix").on(t.projectId, t.status, t.position),
    check("cards_status_ck", sql`${t.status} in ('todo','doing','review','done')`),
    check("cards_priority_ck", sql`${t.priority} in ('low','normal','high','urgent')`),
  ],
);

/** Responsáveis do card: uma pessoa OU um grupo por linha. */
export const cardAssignees = pgTable(
  "card_assignees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("card_assignees_card_ix").on(t.cardId),
    index("card_assignees_user_ix").on(t.userId),
    index("card_assignees_group_ix").on(t.groupId),
    uniqueIndex("card_assignees_uq").on(t.cardId, sql`coalesce(${t.userId}, ${t.groupId})`),
    check("card_assignees_one_ck", sql`(${t.userId} is null) <> (${t.groupId} is null)`),
  ],
);

/** Etiquetas (cadastradas pelo Gestor, valem para todos os projetos). */
export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("labels_name_uq").on(sql`lower(${t.name})`)],
);

export const cardLabels = pgTable(
  "card_labels",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.labelId] })],
);

/** Histórico do card: quem fez o quê e quando (criou, moveu, editou, mudou responsáveis). */
export const cardHistory = pgTable(
  "card_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("card_history_card_ix").on(t.cardId, t.createdAt)],
);

// ======================= Lote 3: Colaboração =======================

/** Item do checklist do card. */
export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    done: boolean("done").notNull().default(false),
    position: doublePrecision("position").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    doneBy: uuid("done_by").references(() => users.id, { onDelete: "set null" }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("checklist_items_card_ix").on(t.cardId, t.position)],
);

/** Comentário no card (texto simples). */
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => [index("comments_card_ix").on(t.cardId, t.createdAt)],
);

/** Pessoas mencionadas num comentário (escolhidas numa lista). */
export const commentMentions = pgTable(
  "comment_mentions",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })],
);

/** Anexo do card: o arquivo fica no bucket privado do Appwrite; aqui só os dados. */
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    fileId: text("file_id").notNull(),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("attachments_card_ix").on(t.cardId, t.createdAt), uniqueIndex("attachments_file_ux").on(t.fileId)],
);

/** Aviso interno (sininho). Não guarda o título: a tela lê o card com o RLS de quem recebe. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_ix").on(t.userId, t.createdAt), check("notifications_kind_ck", sql`${t.kind} in ('assigned','mentioned','commented','moved')`)],
);
