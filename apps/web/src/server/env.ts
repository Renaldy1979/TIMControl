import "server-only";

/** Variáveis do SERVIDOR. Nada daqui vai para o cliente (nenhuma começa com NEXT_PUBLIC_). */
export function need(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Variável de ambiente ausente: ${key}`);
  return v;
}

/** Appwrite só para Auth (e-mail/senha) e, no Lote 3, o bucket de anexos. A chave fica só no servidor. */
export const appwriteEnv = () => ({
  endpoint: need("APPWRITE_ENDPOINT"),
  projectId: need("APPWRITE_PROJECT_ID"),
  apiKey: need("APPWRITE_API_KEY"),
});

/** URL pública do portal (sem barra no fim), usada nos links dos e-mails. */
export const appUrl = (): string => need("APP_URL").replace(/\/+$/, "");

/** Código que libera a configuração inicial (criar o primeiro Gestor). Sem ele, a tela fica fechada. */
export const setupCode = (): string | undefined => {
  const c = process.env["SETUP_CODE"];
  return c && c.length >= 12 ? c : undefined;
};
