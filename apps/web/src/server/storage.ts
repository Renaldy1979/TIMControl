import "server-only";
import { Client, ID, Storage } from "node-appwrite";
import { appwriteEnv, need } from "./env";

/**
 * Bucket PRIVADO de anexos no Appwrite (Lote 3). Sem permissão de papel nenhum: só o servidor, com a chave de API, lê e grava.
 * O navegador nunca recebe link do Appwrite; o download passa por /api/anexos/[id], que confere o RLS e registra no audit_log.
 */
const storage = () => {
  const e = appwriteEnv();
  return new Storage(new Client().setEndpoint(e.endpoint).setProject(e.projectId).setKey(e.apiKey));
};
const bucket = () => need("APPWRITE_BUCKET_ID");

export async function uploadFile(file: File): Promise<string> {
  const f = await storage().createFile({ bucketId: bucket(), fileId: ID.unique(), file });
  return f.$id;
}

export async function downloadFile(fileId: string): Promise<ArrayBuffer> {
  return storage().getFileDownload({ bucketId: bucket(), fileId });
}

/** Apaga do bucket; se já não existir, segue (o registro no banco é o que importa). */
export async function removeFile(fileId: string): Promise<void> {
  try {
    await storage().deleteFile({ bucketId: bucket(), fileId });
  } catch (e) {
    if ((e as { code?: number } | null)?.code !== 404) throw e;
  }
}
