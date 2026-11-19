"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  audit, createGroup, createInvite, createProfile, createProject, deleteProfile, getProfile, getUser, insertUser, newToken, profileInUse,
  removeProjectMember, setGroupMembers, setProjectMember, sha256, updateGroup, updateProfile, updateProject, updateUser, userByEmail, withSistema,
  writeGrants, type Tx,
} from "@timcontrol/pg";
import { applyMatrixChanges, inviteExpiresAt, normalizeGrants, type MatrixChange } from "@timcontrol/domain";
import { ALL_PERMISSION_KEYS, emailSchema, groupSchema, nameSchema, profileSchema, projectSchema, type PermissionKey } from "@timcontrol/shared";
import { appwriteCode, revokeUserSessions, sendInviteEmail, setAuthName, setAuthUserEnabled } from "../auth/appwrite";
import { appUrl } from "../env";
import { asActor, requireActor, requirePermission, type Actor } from "../actor";
import { ForbiddenError, isUniqueViolation, UserError } from "../errors";
import { fd, firstIssue, type FormState } from "../form";

/** Roda a ação com a pessoa logada, a permissão conferida e mensagens seguras em caso de erro. */
async function guarded(key: PermissionKey | null, run: (actor: Actor) => Promise<FormState | void>, path: string, unique = "Já existe um cadastro com esses dados."): Promise<FormState> {
  const actor = await requireActor();
  try {
    if (key) requirePermission(actor, key);
    const r = await run(actor);
    revalidatePath(path);
    return r ?? { ok: "Salvo." };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    if (e instanceof ForbiddenError) return { error: "Você não tem permissão para isso." };
    if (isUniqueViolation(e)) return { error: unique };
    console.error("[admin]", (e as Error).name, appwriteCode(e) ?? "");
    return { error: "Não foi possível salvar agora. Tente de novo." };
  }
}

const uuid = z.string().uuid();
const parseOr = <T>(s: z.ZodType<T>, v: unknown): T => {
  const p = s.safeParse(v);
  if (!p.success) throw new UserError(firstIssue(p.error));
  return p.data;
};

// ---------- usuários e convites ----------

async function issueInvite(tx: Tx, actor: Actor, userId: string, email: string): Promise<string> {
  const token = newToken();
  await createInvite(tx, { userId, tokenHash: sha256(token), invitedBy: actor.user.id, expiresAt: inviteExpiresAt() });
  return `${appUrl()}/aceitar-convite?t=${encodeURIComponent(token)}&e=${encodeURIComponent(email)}`;
}

export async function inviteUser(_: FormState, form: FormData): Promise<FormState> {
  return guarded("admin.users", async (actor) => {
    const name = parseOr(nameSchema, fd(form, "nome"));
    const email = parseOr(emailSchema, fd(form, "email"));
    const profileId = parseOr(uuid, fd(form, "perfil"));
    const projectProfileId = fd(form, "perfilProjetos");
    const projectIds = form.getAll("projetos").map(String).filter((x) => uuid.safeParse(x).success);
    const link = await asActor(actor, async (tx) => {
      if (await userByEmail(tx, email)) throw new UserError("Já existe uma pessoa com esse e-mail.");
      if (!(await getProfile(tx, profileId))) throw new UserError("Escolha um perfil válido.");
      const id = await insertUser(tx, { name, email, globalProfileId: profileId, state: "invited" });
      if (projectIds.length && uuid.safeParse(projectProfileId).success) for (const pid of projectIds) await setProjectMember(tx, pid, id, projectProfileId);
      await audit(tx, actor.user.id, "user.invited", "user", id, { profileId, projects: projectIds.length });
      return issueInvite(tx, actor, id, email);
    });
    await sendInviteEmail(email, link);
    return { ok: `Convite enviado para ${email}.` };
  }, "/configuracoes/usuarios", "Já existe uma pessoa com esse e-mail.");
}

export async function resendInvite(_: FormState, form: FormData): Promise<FormState> {
  return guarded("admin.users", async (actor) => {
    const id = parseOr(uuid, fd(form, "id"));
    const { link, email } = await asActor(actor, async (tx) => {
      const u = await getUser(tx, id);
      if (!u || u.state !== "invited") throw new UserError("Só dá para reenviar para quem ainda não aceitou o convite.");
      await audit(tx, actor.user.id, "user.invite_resent", "user", id);
      return { link: await issueInvite(tx, actor, id, u.email), email: u.email };
    });
    await sendInviteEmail(email, link);
    return { ok: `Convite reenviado para ${email}.` };
  }, "/configuracoes/usuarios");
}

export async function updateUserAdmin(_: FormState, form: FormData): Promise<FormState> {
  return guarded("admin.users", async (actor) => {
    const id = parseOr(uuid, fd(form, "id"));
    const name = parseOr(nameSchema, fd(form, "nome"));
    const profileId = parseOr(uuid, fd(form, "perfil"));
    await asActor(actor, async (tx) => {
      const u = await getUser(tx, id);
      if (!u) throw new UserError("Pessoa não encontrada.");
      const p = await getProfile(tx, profileId);
      if (!p) throw new UserError("Escolha um perfil válido.");
      if (id === actor.user.id && p.systemKey !== "gestor") throw new UserError("Você não pode tirar o seu próprio perfil de Gestor.");
      await updateUser(tx, id, { name, globalProfileId: profileId });
      await audit(tx, actor.user.id, "user.updated", "user", id, { profileId });
      if (u.appwriteUserId && u.name !== name) await setAuthName(u.appwriteUserId, name).catch(() => {});
    });
  }, "/configuracoes/usuarios");
}

export async function setUserActive(_: FormState, form: FormData): Promise<FormState> {
  return guarded("admin.users", async (actor) => {
    const id = parseOr(uuid, fd(form, "id"));
    const active = fd(form, "ativo") === "1";
    if (id === actor.user.id) throw new UserError("Você não pode desativar a sua própria conta.");
    const u = await asActor(actor, async (tx) => {
      const u = await getUser(tx, id);
      if (!u || u.state === "invited") throw new UserError("Pessoa não encontrada ou ainda convidada.");
      await updateUser(tx, id, { state: active ? "active" : "disabled" });
      await audit(tx, actor.user.id, active ? "user.enabled" : "user.disabled", "user", id);
      return u;
    });
    await setAuthUserEnabled(u.appwriteUserId, active);
    if (!active) await revokeUserSessions(u.appwriteUserId);
    return { ok: active ? "Acesso reativado." : "Acesso desativado. A pessoa saiu de todos os aparelhos." };
  }, "/configuracoes/usuarios");
}

// ---------- perfis e matriz ----------

/** Salva a matriz inteira de uma vez: campos `g:<perfil>:<permissão>` com all | own | none. O Gestor não é editável. */
export async function saveMatrix(_: FormState, form: FormData): Promise<FormState> {
  return guarded("admin.profiles", async (actor) => {
    const byProfile = new Map<string, MatrixChange[]>();
    for (const [k, v] of form.entries()) {
      const m = /^g:([0-9a-f-]{36}):(.+)$/.exec(k);
      if (!m) continue;
      const scope = v === "all" || v === "own" ? v : null;
      const list = byProfile.get(m[1]!) ?? [];
      list.push({ key: m[2]!, scope });
      byProfile.set(m[1]!, list);
    }
    await asActor(actor, async (tx) => {
      for (const [profileId, changes] of byProfile) {
        const p = await getProfile(tx, profileId);
        if (!p || p.systemKey === "gestor") continue;
        const keys = new Set(changes.map((c) => c.key));
        if (ALL_PERMISSION_KEYS.some((k) => !keys.has(k))) throw new UserError("Matriz incompleta. Recarregue a página e tente de novo.");
        let grants;
        try {
          grants = normalizeGrants(applyMatrixChanges({}, changes));
        } catch (e) {
          throw new UserError((e as Error).message);
        }
        await writeGrants(tx, profileId, grants);
        await updateProfile(tx, profileId, { allProjects: form.get(`all:${profileId}`) === "on" });
        await audit(tx, actor.user.id, "profile.matrix_saved", "profile", profileId);
      }
    });
    return { ok: "Permissões salvas." };
  }, "/configuracoes/perfis");
}

export async function createProfileAction(_: FormState, form: FormData): Promise<FormState> {
  return guarded("admin.profiles", async (actor) => {
    const input = parseOr(profileSchema, { name: fd(form, "nome"), allProjects: form.get("todos") === "on" });
    await asActor(actor, async (tx) => {
      const base = await getProfile(tx, fd(form, "base"));
      const id = await createProfile(tx, { ...input, grants: base && base.systemKey !== "gestor" ? base.grants : {} });
      await audit(tx, actor.user.id, "profile.created", "profile", id);
    });
    return { ok: "Perfil criado." };
  }, "/configuracoes/perfis", "Já existe um perfil com esse nome.");
}

export async function deleteProfileAction(_: FormState, form: FormData): Promise<FormState> {
  return guarded("admin.profiles", async (actor) => {
    const id = parseOr(uuid, fd(form, "id"));
    await asActor(actor, async (tx) => {
      const p = await getProfile(tx, id);
      if (!p) throw new UserError("Perfil não encontrado.");
      if (p.systemKey) throw new UserError("Os perfis Gestor, Membro e Visitante não podem ser excluídos.");
      if (await profileInUse(tx, id)) throw new UserError("Este perfil está em uso. Troque o perfil das pessoas antes de excluir.");
      await deleteProfile(tx, id);
      await audit(tx, actor.user.id, "profile.deleted", "profile", id);
    });
    return { ok: "Perfil excluído." };
  }, "/configuracoes/perfis");
}

// ---------- projetos ----------

const readProject = (form: FormData) => parseOr(projectSchema, { name: fd(form, "nome"), code: fd(form, "sigla"), tower: fd(form, "torre"), color: fd(form, "cor") });

export async function createProjectAction(_: FormState, form: FormData): Promise<FormState> {
  return guarded("admin.projects", async (actor) => {
    const input = readProject(form);
    await asActor(actor, async (tx) => {
      const id = await createProject(tx, input);
      await audit(tx, actor.user.id, "project.created", "project", id);
    });
    return { ok: `Projeto ${input.name} criado.` };
  }, "/configuracoes/projetos", "Já existe um projeto com esse nome ou sigla.");
}

export async function updateProjectAction(_: FormState, form: FormData): Promise<FormState> {
  return guarded("admin.projects", async (actor) => {
    const id = parseOr(uuid, fd(form, "id"));
    const input = readProject(form);
    await asActor(actor, async (tx) => {
      await updateProject(tx, id, { ...input, active: form.get("ativo") === "on" });
      await audit(tx, actor.user.id, "project.updated", "project", id);
    });
  }, "/configuracoes/projetos", "Já existe um projeto com esse nome ou sigla.");
}

export async function setProjectMemberAction(_: FormState, form: FormData): Promise<FormState> {
  return guarded("admin.projects", async (actor) => {
    const projectId = parseOr(uuid, fd(form, "projeto"));
    const userId = parseOr(uuid, fd(form, "pessoa"));
    const profileId = parseOr(uuid, fd(form, "perfil"));
    await asActor(actor, async (tx) => {
      await setProjectMember(tx, projectId, userId, profileId);
      await audit(tx, actor.user.id, "project.member_set", "project", projectId, { userId, profileId });
    });
    return { ok: "Acesso ao projeto salvo." };
  }, "/configuracoes/projetos");
}

export async function removeProjectMemberAction(_: FormState, form: FormData): Promise<FormState> {
  return guarded("admin.projects", async (actor) => {
    const projectId = parseOr(uuid, fd(form, "projeto"));
    const userId = parseOr(uuid, fd(form, "pessoa"));
    await asActor(actor, async (tx) => {
      await removeProjectMember(tx, projectId, userId);
      await audit(tx, actor.user.id, "project.member_removed", "project", projectId, { userId });
    });
    return { ok: "Acesso removido." };
  }, "/configuracoes/projetos");
}

// ---------- grupos ----------

export async function createGroupAction(_: FormState, form: FormData): Promise<FormState> {
  return guarded("admin.groups", async (actor) => {
    const input = parseOr(groupSchema, { name: fd(form, "nome"), description: fd(form, "descricao") });
    await asActor(actor, async (tx) => {
      const id = await createGroup(tx, { name: input.name, description: input.description ?? "" });
      await setGroupMembers(tx, id, form.getAll("membros").map(String).filter((x) => uuid.safeParse(x).success));
      await audit(tx, actor.user.id, "group.created", "group", id);
    });
    return { ok: `Grupo ${input.name} criado.` };
  }, "/configuracoes/grupos", "Já existe um grupo com esse nome.");
}

export async function updateGroupAction(_: FormState, form: FormData): Promise<FormState> {
  return guarded("admin.groups", async (actor) => {
    const id = parseOr(uuid, fd(form, "id"));
    const input = parseOr(groupSchema, { name: fd(form, "nome"), description: fd(form, "descricao") });
    await asActor(actor, async (tx) => {
      await updateGroup(tx, id, { name: input.name, description: input.description ?? "", active: form.get("ativo") === "on" });
      await setGroupMembers(tx, id, form.getAll("membros").map(String).filter((x) => uuid.safeParse(x).success));
      await audit(tx, actor.user.id, "group.updated", "group", id);
    });
  }, "/configuracoes/grupos", "Já existe um grupo com esse nome.");
}

// ---------- minha conta ----------

export async function updateMyName(_: FormState, form: FormData): Promise<FormState> {
  return guarded(null, async (actor) => {
    const name = parseOr(nameSchema, fd(form, "nome"));
    // a pessoa só altera o próprio nome; a tabela users é do Gestor no RLS, então grava pelo sistema após conferir quem é
    await withSistema(async (tx) => {
      await updateUser(tx, actor.user.id, { name });
      await audit(tx, actor.user.id, "user.self_renamed", "user", actor.user.id);
    });
    if (actor.user.appwriteUserId) await setAuthName(actor.user.appwriteUserId, name).catch(() => {});
    return { ok: "Nome atualizado." };
  }, "/conta");
}
