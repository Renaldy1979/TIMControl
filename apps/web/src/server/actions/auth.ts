"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { countUsers, inviteByTokenHash, insertUser, markInviteAccepted, profileBySystemKey, seedInitialData, sha256, updateUser, userByAppwriteId, withSistema, audit } from "@timcontrol/pg";
import { inviteStatus } from "@timcontrol/domain";
import { emailSchema, nameSchema, passwordSchema } from "@timcontrol/shared";
import {
  accountOfSession, appwriteCode, createAuthUser, finishRecovery, revokeUserSessions, sendRecovery, sessionFromMagicUrl, setAuthName, setAuthPassword, signInWithPassword,
} from "../auth/appwrite";
import { clearSession, writeSession } from "../auth/session";
import { bloqueadoPor, enderecoDoCliente, registrarFalha, registrarSucesso } from "../auth/throttle";
import { setupCode } from "../env";
import { fd, firstIssue, type FormState } from "../form";

// ---------- entrar / sair ----------

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const p = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).safeParse({ email: fd(form, "email"), password: fd(form, "senha") });
  const keep = { email: fd(form, "email") };
  if (!p.success) return { error: "Informe e-mail e senha.", values: keep };
  const ip = await enderecoDoCliente();
  const espera = bloqueadoPor(p.data.email, ip);
  if (espera > 0) return { error: `Muitas tentativas erradas. Aguarde ${espera} min e tente de novo.`, values: keep };
  try {
    const session = await signInWithPassword(p.data.email, p.data.password);
    const user = await withSistema((tx) => userByAppwriteId(tx, session.userId));
    if (!user || user.state !== "active") {
      await revokeUserSessions(session.userId);
      return { error: user?.state === "disabled" ? "Seu acesso foi desativado. Fale com o Gestor." : "Seu acesso ainda não foi liberado. Fale com o Gestor.", values: keep };
    }
    registrarSucesso(p.data.email);
    await writeSession(session.secret, form.get("lembrar") ? session.expire : undefined);
  } catch (e) {
    registrarFalha(p.data.email, ip);
    return { error: appwriteCode(e) === 429 ? "Muitas tentativas. Aguarde um pouco e tente de novo." : "E-mail ou senha incorretos.", values: keep };
  }
  redirect("/");
}

export async function signOut(): Promise<void> {
  await clearSession();
  redirect("/login");
}

// ---------- esqueci / redefinir a senha ----------

export async function forgotPassword(_: FormState, form: FormData): Promise<FormState> {
  const p = emailSchema.safeParse(fd(form, "email"));
  if (!p.success) return { error: firstIssue(p.error), values: { email: fd(form, "email") } };
  await sendRecovery(p.data).catch(() => {}); // não revela se o e-mail existe
  return { ok: "Se o e-mail estiver cadastrado, enviamos um link para criar uma nova senha.", values: { email: p.data } };
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const pw = passwordSchema.safeParse(fd(form, "senha"));
  if (!pw.success) return { error: firstIssue(pw.error) };
  if (pw.data !== fd(form, "confirmar")) return { error: "As senhas não conferem." };
  const userId = fd(form, "userId");
  try {
    await finishRecovery(userId, fd(form, "secret"), pw.data);
    await revokeUserSessions(userId); // quem tinha a senha antiga perde o acesso
  } catch {
    return { error: "Link inválido ou vencido. Peça um novo." };
  }
  redirect("/login?ok=senha");
}

// ---------- aceitar convite ----------

const INVITE_ERROR = "Este convite não vale mais. Peça um novo ao Gestor.";

/**
 * O convidado abre o link do e-mail (Magic URL do Appwrite + token do convite), define a senha e entra.
 * O e-mail fica confirmado porque só quem recebeu o e-mail tem o link.
 */
export async function acceptInvite(_: FormState, form: FormData): Promise<FormState> {
  const pw = passwordSchema.safeParse(fd(form, "senha"));
  if (!pw.success) return { error: firstIssue(pw.error) };
  if (pw.data !== fd(form, "confirmar")) return { error: "As senhas não conferem." };
  const token = fd(form, "t");
  const userId = fd(form, "userId");
  const secret = fd(form, "secret");
  if (!token || !userId || !secret) return { error: INVITE_ERROR };

  const invite = await withSistema((tx) => inviteByTokenHash(tx, sha256(token)));
  if (!invite || inviteStatus(invite) !== "valid" || invite.user.state !== "invited") return { error: INVITE_ERROR };

  let session;
  try {
    session = await sessionFromMagicUrl(userId, secret);
  } catch {
    return { error: "O link do e-mail venceu. Peça ao Gestor para reenviar o convite." };
  }
  const account = await accountOfSession(session.secret);
  if (!account || account.email.toLowerCase() !== invite.user.email.toLowerCase()) {
    await revokeUserSessions(session.userId);
    return { error: INVITE_ERROR };
  }
  try {
    await setAuthPassword(account.id, pw.data);
    if (!account.name) await setAuthName(account.id, invite.user.name).catch(() => {});
    await withSistema(async (tx) => {
      await updateUser(tx, invite.user.id, { appwriteUserId: account.id, state: "active" });
      await markInviteAccepted(tx, invite.id);
      await audit(tx, invite.user.id, "invite.accepted", "user", invite.user.id);
    });
    await writeSession(session.secret, session.expire);
  } catch (e) {
    console.error("[aceitar-convite]", appwriteCode(e) ?? (e as Error).name);
    return { error: "Não foi possível concluir agora. Tente de novo." };
  }
  redirect("/");
}

// ---------- configuração inicial (primeiro Gestor) ----------

export async function initialSetup(_: FormState, form: FormData): Promise<FormState> {
  const keep = { nome: fd(form, "nome"), email: fd(form, "email") };
  const code = setupCode();
  if (!code) return { error: "Configuração inicial fechada: defina SETUP_CODE no ambiente (veja docs/09).", values: keep };
  if (fd(form, "codigo") !== code) return { error: "Código de configuração incorreto.", values: keep };
  const p = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema }).safeParse({ name: fd(form, "nome"), email: fd(form, "email"), password: fd(form, "senha") });
  if (!p.success) return { error: firstIssue(p.error), values: keep };
  if (p.data.password !== fd(form, "confirmar")) return { error: "As senhas não conferem.", values: keep };
  if ((await withSistema((tx) => countUsers(tx))) > 0) return { error: "O sistema já foi configurado. Entre com sua conta." };

  try {
    let authId: string;
    try {
      authId = (await createAuthUser(p.data.email, p.data.password, p.data.name)).$id;
    } catch (e) {
      if (appwriteCode(e) !== 409) throw e;
      return { error: "Já existe uma conta com esse e-mail no Appwrite deste projeto. Use outro e-mail ou apague a conta no console do Appwrite.", values: keep };
    }
    const session = await signInWithPassword(p.data.email, p.data.password);
    await withSistema(async (tx) => {
      if ((await countUsers(tx)) > 0) throw new Error("já configurado");
      await seedInitialData(tx);
      const gestor = (await profileBySystemKey(tx, "gestor"))!;
      const id = await insertUser(tx, { name: p.data.name, email: p.data.email, globalProfileId: gestor.id, state: "active", appwriteUserId: authId });
      await audit(tx, id, "setup.done", "user", id);
    });
    await writeSession(session.secret, session.expire);
  } catch (e) {
    console.error("[configuracao-inicial]", appwriteCode(e) ?? (e as Error).message);
    return { error: "Não foi possível concluir a configuração. Tente de novo.", values: keep };
  }
  redirect("/");
}
