-- Card sem tipo (decisão do dono em 19/11/2026): todo card é uma tarefa para uma pessoa ou um grupo.
-- Cards antigos sem responsável passam a ter quem os criou como responsável.
INSERT INTO card_assignees (card_id, user_id, group_id)
  SELECT c.id, c.created_by, NULL FROM cards c
  WHERE NOT EXISTS (SELECT 1 FROM card_assignees a WHERE a.card_id = c.id);--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT IF EXISTS "cards_type_ck";--> statement-breakpoint
ALTER TABLE "cards" DROP CONSTRAINT IF EXISTS "cards_requester_id_users_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "cards_requester_ix";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN IF EXISTS "type";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN IF EXISTS "requester_id";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN IF EXISTS "requested_at";
