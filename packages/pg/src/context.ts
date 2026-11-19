import { sql } from "drizzle-orm";
import { getDb, type Db, type Tx } from "./client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Transação em nome de uma pessoa: define `app.user_id` (local à transação) e o RLS decide o que ela vê.
 * Todo acesso a dados de quem está logado passa por aqui. Se `fn` lançar, tudo é revertido.
 */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>, db: Db = getDb()): Promise<T> {
  if (!UUID_RE.test(userId)) throw new Error("userId inválido");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}

/**
 * Transação do SISTEMA (`app.sistema = 'on'`): para o que acontece antes de saber quem é a pessoa
 * (login, aceitar convite, configuração inicial). Use o mínimo possível e nunca com dados vindos da tela sem validar.
 */
export async function withSistema<T>(fn: (tx: Tx) => Promise<T>, db: Db = getDb()): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.sistema', 'on', true)`);
    return fn(tx);
  });
}
