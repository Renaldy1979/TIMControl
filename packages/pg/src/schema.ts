import { sql } from "drizzle-orm";
import { bigserial, boolean, check, index, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
    tower: text("tower").notNull(),
    color: text("color").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("projects_name_uq").on(sql`lower(${t.name})`),
    uniqueIndex("projects_code_uq").on(t.code),
    check("projects_tower_ck", sql`${t.tower} in ('producao','sustentacao','ambas')`),
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
