import { formatDateTimeBR } from "@timcontrol/domain";
import type { CommentView } from "@timcontrol/pg";
import { deleteCommentAction, updateCommentAction } from "@/server/actions/collab";
import { ActionForm } from "../ui/ActionForm";
import { initials } from "../kanban/CardTile";
import { NewCommentForm } from "./Forms";

const area = "w-full rounded-md border border-bd bg-sf px-3 py-2 text-[15px] text-ink placeholder:text-ink3 focus:border-br focus:outline-none";

export function CommentsPanel({
  cardId,
  comments,
  canComment,
  meId,
  isGestor,
  people,
}: {
  cardId: string;
  comments: CommentView[];
  canComment: boolean;
  meId: string;
  isGestor: boolean;
  people: { id: string; name: string }[];
}) {
  const others = people.filter((p) => p.id !== meId);
  return (
    <section aria-labelledby="comments-h" className="flex flex-col gap-4">
      <h2 id="comments-h" className="text-lg font-bold">
        Comentários ({comments.length})
      </h2>
      {comments.length === 0 && <p className="text-sm text-ink3">Nenhum comentário ainda.</p>}
      <ol className="flex flex-col gap-4">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-br-soft text-xs font-bold text-br-2">
              {initials(c.authorName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <strong className="text-ink">{c.authorName}</strong>{" "}
                <time className="text-xs text-ink3" dateTime={c.createdAt.toISOString()}>
                  {formatDateTimeBR(c.createdAt)}
                </time>
                {c.editedAt && <span className="text-xs text-ink3"> · editado</span>}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-ink2">{c.body}</p>
              {c.mentions.length > 0 && <p className="mt-1 text-xs text-ink3">Avisou: {c.mentions.map((m) => `@${m.name}`).join(", ")}</p>}
              {(c.authorId === meId || isGestor) && (
                <div className="mt-1 flex flex-wrap gap-4">
                  {c.authorId === meId && (
                    <details>
                      <summary className="inline-flex min-h-touch cursor-pointer items-center text-sm font-semibold text-br-2">Editar</summary>
                      <ActionForm action={updateCommentAction} submit="Salvar" variant="secondary" hidden={{ id: c.id }} className="mt-2">
                        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink2">
                          Texto do comentário
                          <textarea name="texto" rows={3} maxLength={5000} required defaultValue={c.body} className={area} />
                        </label>
                      </ActionForm>
                    </details>
                  )}
                  <details>
                    <summary className="inline-flex min-h-touch cursor-pointer items-center text-sm font-semibold text-danger">Apagar</summary>
                    <ActionForm action={deleteCommentAction} submit="Apagar comentário" variant="danger" hidden={{ id: c.id }} className="mt-2" />
                  </details>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {canComment ? (
        <NewCommentForm cardId={cardId} people={others} />
      ) : (
        <p className="text-sm text-ink3">Seu perfil não permite comentar neste card.</p>
      )}
    </section>
  );
}
