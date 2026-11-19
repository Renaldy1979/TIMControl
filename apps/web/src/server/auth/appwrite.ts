import "server-only";
import { Account, Client, ID, Users } from "node-appwrite";
import { appUrl, appwriteEnv } from "../env";

/**
 * Appwrite Auth (e-mail/senha), mesmo padrão do controle-remedios. Só o servidor fala com o Appwrite;
 * a chave de API nunca vai ao navegador. Os e-mails (recuperação de senha, convite) saem dos modelos do Appwrite.
 */
const base = () => {
  const e = appwriteEnv();
  return new Client().setEndpoint(e.endpoint).setProject(e.projectId).setLocale("pt-br");
};
const admin = () => base().setKey(appwriteEnv().apiKey);
const anon = () => base();
const asSession = (secret: string) => base().setSession(secret);

export const appwriteCode = (e: unknown): number | undefined => (e as { code?: number } | null)?.code;

/** Com a chave de API o Appwrite devolve o segredo da sessão (fluxo SSR). */
export async function signInWithPassword(email: string, password: string) {
  return new Account(admin()).createEmailPasswordSession({ email, password });
}

export async function createAuthUser(email: string, password: string, name: string) {
  return new Users(admin()).create({ userId: ID.unique(), email, password, name });
}

export interface AuthAccount {
  id: string;
  email: string;
  name: string;
}

/** Dono da sessão, ou null se ela não vale mais (expirada, revogada, inexistente). */
export async function accountOfSession(secret: string | undefined | null): Promise<AuthAccount | null> {
  if (!secret) return null;
  try {
    const a = await new Account(asSession(secret)).get();
    return { id: a.$id, email: a.email, name: a.name };
  } catch {
    return null;
  }
}

export async function deleteCurrentSession(secret: string | undefined | null): Promise<void> {
  if (!secret) return;
  try {
    await new Account(asSession(secret)).deleteSession({ sessionId: "current" });
  } catch {
    /* já estava inválida */
  }
}

/** Derruba TODAS as sessões da pessoa (desativação, troca de senha). */
export async function revokeUserSessions(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  try {
    await new Users(admin()).deleteSessions({ userId });
  } catch (e) {
    if (appwriteCode(e) !== 404) throw e;
  }
}

/** Bloqueia/libera o login da pessoa no Appwrite (desativar/reativar). */
export async function setAuthUserEnabled(userId: string | null | undefined, enabled: boolean): Promise<void> {
  if (!userId) return;
  try {
    await new Users(admin()).updateStatus({ userId, status: enabled });
  } catch (e) {
    if (appwriteCode(e) !== 404) throw e;
  }
}

// ---------- recuperação de senha ----------
export async function sendRecovery(email: string): Promise<void> {
  await new Account(anon()).createRecovery({ email, url: `${appUrl()}/redefinir-senha` });
}
export async function finishRecovery(userId: string, secret: string, password: string): Promise<void> {
  await new Account(anon()).updateRecovery({ userId, secret, password });
}

// ---------- convite por e-mail (Magic URL do Appwrite) ----------

/** Envia o e-mail de convite: link do Magic URL do Appwrite que volta para `url` com `userId` e `secret`. */
export async function sendInviteEmail(email: string, url: string): Promise<void> {
  await new Account(anon()).createMagicURLToken({ userId: ID.unique(), email, url });
}

/** Troca o token do Magic URL por sessão; o Appwrite também marca o e-mail como verificado. */
export async function sessionFromMagicUrl(userId: string, secret: string) {
  return new Account(admin()).createSession({ userId, secret });
}
export async function setAuthPassword(userId: string, password: string): Promise<void> {
  await new Users(admin()).updatePassword({ userId, password });
}
export async function setAuthName(userId: string, name: string): Promise<void> {
  await new Users(admin()).updateName({ userId, name });
}
