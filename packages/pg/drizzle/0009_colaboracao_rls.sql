-- RLS da colaboração (Lote 3, docs/02 "Quem vê e altera (RLS do Lote 3)").

-- Pode trabalhar no card (checklist e anexos): quem o edita, ou quem pode movê-lo.
CREATE OR REPLACE FUNCTION app_card_workable(cid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT app_card_editable(c.id) OR app_can(c.project_id, 'kanban.move', app_card_own(c.id))
    FROM cards c WHERE c.id = cid AND app_sees_project(c.project_id)
  ), false)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_card_workable(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_card_workable(uuid) TO PUBLIC;
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['checklist_items', 'comments', 'comment_mentions', 'attachments', 'notifications'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- Checklist: lido junto com o card; quem trabalha no card cria (em nome próprio), marca e apaga.
CREATE POLICY read_visible ON checklist_items FOR SELECT USING (app_sistema() OR EXISTS (SELECT 1 FROM cards c WHERE c.id = card_id));
--> statement-breakpoint
CREATE POLICY insert_workable ON checklist_items FOR INSERT WITH CHECK (app_sistema() OR (created_by = app_user_id() AND app_card_workable(card_id)));
--> statement-breakpoint
CREATE POLICY update_workable ON checklist_items FOR UPDATE USING (app_sistema() OR app_card_workable(card_id)) WITH CHECK (app_sistema() OR app_card_workable(card_id));
--> statement-breakpoint
CREATE POLICY delete_workable ON checklist_items FOR DELETE USING (app_sistema() OR app_card_workable(card_id));
--> statement-breakpoint

-- Comentários: lidos junto com o card; comenta quem tem kanban.comment no projeto ("os seus" = cards seus); só o autor edita; o autor ou o Gestor apaga.
CREATE POLICY read_visible ON comments FOR SELECT USING (app_sistema() OR EXISTS (SELECT 1 FROM cards c WHERE c.id = card_id));
--> statement-breakpoint
CREATE POLICY insert_allowed ON comments FOR INSERT WITH CHECK (
  app_sistema() OR (author_id = app_user_id() AND EXISTS (
    SELECT 1 FROM cards c WHERE c.id = card_id AND app_can(c.project_id, 'kanban.comment', app_card_own(c.id))
  ))
);
--> statement-breakpoint
CREATE POLICY update_author ON comments FOR UPDATE USING (app_sistema() OR author_id = app_user_id()) WITH CHECK (app_sistema() OR author_id = app_user_id());
--> statement-breakpoint
CREATE POLICY delete_author_or_gestor ON comments FOR DELETE USING (app_sistema() OR author_id = app_user_id() OR app_is_gestor());
--> statement-breakpoint

-- Menções: lidas junto com o comentário; só o autor do comentário grava ou apaga.
CREATE POLICY read_visible ON comment_mentions FOR SELECT USING (app_sistema() OR EXISTS (SELECT 1 FROM comments m WHERE m.id = comment_id));
--> statement-breakpoint
CREATE POLICY insert_author ON comment_mentions FOR INSERT WITH CHECK (app_sistema() OR EXISTS (SELECT 1 FROM comments m WHERE m.id = comment_id AND m.author_id = app_user_id()));
--> statement-breakpoint
CREATE POLICY delete_author ON comment_mentions FOR DELETE USING (app_sistema() OR EXISTS (SELECT 1 FROM comments m WHERE m.id = comment_id AND m.author_id = app_user_id()));
--> statement-breakpoint

-- Anexos: lidos junto com o card; envia quem trabalha no card; ninguém altera; apaga quem enviou (se ainda trabalha no card) ou quem edita o card.
CREATE POLICY read_visible ON attachments FOR SELECT USING (app_sistema() OR EXISTS (SELECT 1 FROM cards c WHERE c.id = card_id));
--> statement-breakpoint
CREATE POLICY insert_workable ON attachments FOR INSERT WITH CHECK (app_sistema() OR (uploaded_by = app_user_id() AND app_card_workable(card_id)));
--> statement-breakpoint
CREATE POLICY delete_allowed ON attachments FOR DELETE USING (app_sistema() OR (uploaded_by = app_user_id() AND app_card_workable(card_id)) OR app_card_editable(card_id));
--> statement-breakpoint

-- Notificações: só a destinatária lê (e só enquanto vê o card), marca como lida e apaga. Quem agiu grava, em card que vê.
CREATE POLICY read_own ON notifications FOR SELECT USING (app_sistema() OR (user_id = app_user_id() AND EXISTS (SELECT 1 FROM cards c WHERE c.id = card_id)));
--> statement-breakpoint
CREATE POLICY insert_actor ON notifications FOR INSERT WITH CHECK (app_sistema() OR (actor_id = app_user_id() AND EXISTS (SELECT 1 FROM cards c WHERE c.id = card_id)));
--> statement-breakpoint
CREATE POLICY update_own ON notifications FOR UPDATE USING (app_sistema() OR user_id = app_user_id()) WITH CHECK (app_sistema() OR user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY delete_own ON notifications FOR DELETE USING (app_sistema() OR user_id = app_user_id());
--> statement-breakpoint

-- Permissões do papel da aplicação nas tabelas novas (mesmo motivo da 0002).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'timcontrol_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO timcontrol_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO timcontrol_app;
  END IF;
END $$;
