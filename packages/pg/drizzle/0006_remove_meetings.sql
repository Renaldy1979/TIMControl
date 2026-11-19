-- Reuniões e WarRooms saíram do escopo (decisão do dono em 19/11/2026): remove coluna no card, tabelas, funções e permissões.
ALTER TABLE "cards" DROP CONSTRAINT IF EXISTS "cards_meeting_id_meetings_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "cards_meeting_ix";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN IF EXISTS "meeting_id";--> statement-breakpoint
DROP TABLE IF EXISTS "meeting_participants";--> statement-breakpoint
DROP TABLE IF EXISTS "meetings";--> statement-breakpoint
DROP FUNCTION IF EXISTS app_meeting_editable(uuid);--> statement-breakpoint
DROP FUNCTION IF EXISTS app_meeting_own(uuid);--> statement-breakpoint
DELETE FROM profile_permissions WHERE permission LIKE 'meetings.%';
