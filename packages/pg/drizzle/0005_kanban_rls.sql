-- RLS do Kanban (Lote 2). Mesma regra de packages/shared/src/permissions.ts:
-- perfil que vale no projeto = Gestor global; senão o perfil específico do projeto; senão o global se "vê todos os projetos".
-- "Os seus" = cards que a pessoa criou ou em que é responsável (direto ou por um grupo dela).

-- Perfil que vale para a pessoa logada neste projeto (null = não vê o projeto).
CREATE OR REPLACE FUNCTION app_profile_for(pid uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT app_is_active() THEN NULL
    WHEN app_is_gestor() THEN (SELECT u.global_profile_id FROM users u WHERE u.id = app_user_id())
    ELSE coalesce(
      (SELECT pm.profile_id FROM project_members pm WHERE pm.user_id = app_user_id() AND pm.project_id = pid),
      (SELECT p.id FROM users u JOIN profiles p ON p.id = u.global_profile_id AND p.all_projects WHERE u.id = app_user_id())
    )
  END
$$;
--> statement-breakpoint

-- Alcance ('all' | 'own' | null) de uma permissão no projeto. Perfil de sistema "gestor" tem tudo.
CREATE OR REPLACE FUNCTION app_scope(pid uuid, perm text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN pr.system_key = 'gestor' THEN 'all'
              ELSE (SELECT pp.scope FROM profile_permissions pp WHERE pp.profile_id = pr.id AND pp.permission = perm) END
  FROM profiles pr WHERE pr.id = app_profile_for(pid)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_can(pid uuid, perm text, own boolean) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(s = 'all' OR (s = 'own' AND own), false) FROM (SELECT app_scope(pid, perm) AS s) x
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_card_own(cid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM cards c WHERE c.id = cid AND c.created_by = app_user_id())
      OR EXISTS (SELECT 1 FROM card_assignees a WHERE a.card_id = cid AND a.user_id = app_user_id())
      OR EXISTS (
        SELECT 1 FROM card_assignees a JOIN group_members gm ON gm.group_id = a.group_id
        WHERE a.card_id = cid AND gm.user_id = app_user_id()
      )
$$;
--> statement-breakpoint

-- Pode mexer nos responsáveis e etiquetas: quem edita o card, ou quem o criou (e pode criar cards).
CREATE OR REPLACE FUNCTION app_card_editable(cid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT app_can(c.project_id, 'kanban.edit', app_card_own(c.id))
        OR (c.created_by = app_user_id() AND app_can(c.project_id, 'kanban.create', false))
    FROM cards c WHERE c.id = cid
  ), false)
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_meeting_own(mid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM meetings m WHERE m.id = mid AND m.created_by = app_user_id())
      OR EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = mid AND mp.user_id = app_user_id())
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_meeting_editable(mid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT app_can(m.project_id, 'meetings.edit', app_meeting_own(m.id))
        OR (m.created_by = app_user_id() AND app_can(m.project_id, 'meetings.create', false))
    FROM meetings m WHERE m.id = mid
  ), false)
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION app_profile_for(uuid), app_scope(uuid, text), app_can(uuid, text, boolean), app_card_own(uuid), app_card_editable(uuid), app_meeting_own(uuid), app_meeting_editable(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_profile_for(uuid), app_scope(uuid, text), app_can(uuid, text, boolean), app_card_own(uuid), app_card_editable(uuid), app_meeting_own(uuid), app_meeting_editable(uuid) TO PUBLIC;
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cards', 'card_assignees', 'card_labels', 'card_history', 'labels', 'meetings', 'meeting_participants'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- Cards: vê quem vê o projeto; cria/edita/move/exclui conforme a matriz do perfil que vale no projeto.
-- O servidor diferencia "editar" de "mover"; o banco aceita a alteração se a pessoa puder uma das duas.
CREATE POLICY read_visible ON cards FOR SELECT USING (app_sistema() OR app_sees_project(project_id));
--> statement-breakpoint
CREATE POLICY insert_allowed ON cards FOR INSERT WITH CHECK (app_sistema() OR (created_by = app_user_id() AND app_sees_project(project_id) AND app_can(project_id, 'kanban.create', false)));
--> statement-breakpoint
CREATE POLICY update_allowed ON cards FOR UPDATE
  USING (app_sistema() OR (app_sees_project(project_id) AND (app_can(project_id, 'kanban.edit', app_card_own(id)) OR app_can(project_id, 'kanban.move', app_card_own(id)))))
  WITH CHECK (app_sistema() OR (app_sees_project(project_id) AND (app_can(project_id, 'kanban.edit', app_card_own(id)) OR app_can(project_id, 'kanban.move', app_card_own(id)))));
--> statement-breakpoint
CREATE POLICY delete_allowed ON cards FOR DELETE USING (app_sistema() OR app_can(project_id, 'kanban.delete', app_card_own(id)));
--> statement-breakpoint

-- Responsáveis e etiquetas do card: leitura junto com o card; alteração por quem pode editá-lo.
CREATE POLICY read_visible ON card_assignees FOR SELECT USING (app_sistema() OR EXISTS (SELECT 1 FROM cards c WHERE c.id = card_id));
--> statement-breakpoint
CREATE POLICY write_editable ON card_assignees FOR ALL USING (app_sistema() OR app_card_editable(card_id)) WITH CHECK (app_sistema() OR app_card_editable(card_id));
--> statement-breakpoint
CREATE POLICY read_visible ON card_labels FOR SELECT USING (app_sistema() OR EXISTS (SELECT 1 FROM cards c WHERE c.id = card_id));
--> statement-breakpoint
CREATE POLICY write_editable ON card_labels FOR ALL USING (app_sistema() OR app_card_editable(card_id)) WITH CHECK (app_sistema() OR app_card_editable(card_id));
--> statement-breakpoint

-- Histórico: lido junto com o card; cada pessoa registra só em nome próprio, em card que vê. Ninguém altera.
CREATE POLICY read_visible ON card_history FOR SELECT USING (app_sistema() OR EXISTS (SELECT 1 FROM cards c WHERE c.id = card_id));
--> statement-breakpoint
CREATE POLICY insert_own ON card_history FOR INSERT WITH CHECK (app_sistema() OR (actor_user_id = app_user_id() AND EXISTS (SELECT 1 FROM cards c WHERE c.id = card_id)));
--> statement-breakpoint

-- Etiquetas: todos os ativos leem; só o Gestor cadastra.
CREATE POLICY read_active ON labels FOR SELECT USING (app_sistema() OR app_is_active());
--> statement-breakpoint
CREATE POLICY write_gestor ON labels FOR ALL USING (app_sistema() OR app_is_gestor()) WITH CHECK (app_sistema() OR app_is_gestor());
--> statement-breakpoint

-- Reuniões e WarRooms: pela matriz "Reuniões" do perfil que vale no projeto. "As suas" = criou ou participou.
CREATE POLICY read_visible ON meetings FOR SELECT USING (app_sistema() OR app_can(project_id, 'meetings.view', false));
--> statement-breakpoint
CREATE POLICY insert_allowed ON meetings FOR INSERT WITH CHECK (app_sistema() OR (created_by = app_user_id() AND app_can(project_id, 'meetings.create', false)));
--> statement-breakpoint
CREATE POLICY update_allowed ON meetings FOR UPDATE
  USING (app_sistema() OR app_can(project_id, 'meetings.edit', app_meeting_own(id)))
  WITH CHECK (app_sistema() OR app_can(project_id, 'meetings.edit', app_meeting_own(id)));
--> statement-breakpoint
CREATE POLICY delete_allowed ON meetings FOR DELETE USING (app_sistema() OR app_can(project_id, 'meetings.delete', app_meeting_own(id)));
--> statement-breakpoint
CREATE POLICY read_visible ON meeting_participants FOR SELECT USING (app_sistema() OR EXISTS (SELECT 1 FROM meetings m WHERE m.id = meeting_id));
--> statement-breakpoint
CREATE POLICY write_editable ON meeting_participants FOR ALL USING (app_sistema() OR app_meeting_editable(meeting_id)) WITH CHECK (app_sistema() OR app_meeting_editable(meeting_id));
--> statement-breakpoint

-- Permissões do papel da aplicação nas tabelas novas (mesmo motivo da 0002).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'timcontrol_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO timcontrol_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO timcontrol_app;
  END IF;
END $$;
--> statement-breakpoint

-- Etiquetas iniciais para bancos que já existiam (os novos recebem pelo seed).
INSERT INTO labels (name, color)
SELECT v.name, v.color FROM (VALUES ('Análise', '#0EA5E9'), ('Correção', '#EF4444'), ('Melhoria', '#10B981'), ('Dúvida', '#F59E0B'), ('Documentação', '#6366F1')) AS v(name, color)
WHERE NOT EXISTS (SELECT 1 FROM labels);
