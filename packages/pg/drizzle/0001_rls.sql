-- RLS do TIMControl (docs/02, seção "Quem vê o quê").
-- Contexto de cada transação (packages/pg/src/context.ts):
--   app.user_id  = pessoa logada (withUser)
--   app.sistema  = 'on' só para login, convite e configuração inicial (withSistema)
-- As funções abaixo são SECURITY DEFINER e pertencem ao papel dono (BYPASSRLS), para consultar sem recursão de políticas.

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_sistema() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('app.sistema', true), '') = 'on' $$;
--> statement-breakpoint

-- Pessoa ativa com perfil global Gestor.
CREATE OR REPLACE FUNCTION app_is_gestor() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u JOIN profiles p ON p.id = u.global_profile_id
    WHERE u.id = app_user_id() AND u.state = 'active' AND p.system_key = 'gestor'
  )
$$;
--> statement-breakpoint

-- Pessoa ativa (qualquer perfil).
CREATE OR REPLACE FUNCTION app_is_active() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM users u WHERE u.id = app_user_id() AND u.state = 'active')
$$;
--> statement-breakpoint

-- Mesma regra de packages/shared/src/permissions.ts (profileFor + canSeeProject):
-- Gestor vê tudo; perfil específico do projeto vale primeiro; sem ele, vale o global se "vê todos os projetos".
-- Em qualquer caso o perfil precisa de kanban.view.
CREATE OR REPLACE FUNCTION app_sees_project(pid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_is_gestor() OR (
    app_is_active() AND (
      EXISTS (
        SELECT 1 FROM project_members pm
        JOIN profile_permissions pp ON pp.profile_id = pm.profile_id AND pp.permission = 'kanban.view'
        WHERE pm.user_id = app_user_id() AND pm.project_id = pid
      )
      OR (
        NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.user_id = app_user_id() AND pm.project_id = pid)
        AND EXISTS (
          SELECT 1 FROM users u
          JOIN profiles p ON p.id = u.global_profile_id AND p.all_projects
          JOIN profile_permissions pp ON pp.profile_id = p.id AND pp.permission = 'kanban.view'
          WHERE u.id = app_user_id()
        )
      )
    )
  )
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION app_is_gestor(), app_is_active(), app_sees_project(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_user_id(), app_sistema(), app_is_gestor(), app_is_active(), app_sees_project(uuid) TO PUBLIC;
--> statement-breakpoint

-- 1) Tabelas de cadastro lidas por qualquer pessoa ativa e alteradas só pelo Gestor (ou pelo sistema).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles', 'profile_permissions', 'users', 'groups', 'group_members'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY read_active ON %I FOR SELECT USING (app_sistema() OR app_is_active())', t);
    EXECUTE format('CREATE POLICY write_gestor ON %I FOR ALL USING (app_sistema() OR app_is_gestor()) WITH CHECK (app_sistema() OR app_is_gestor())', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- 2) Convites: só o Gestor e o sistema (aceite do convite).
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE invites FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY gestor_or_system ON invites USING (app_sistema() OR app_is_gestor()) WITH CHECK (app_sistema() OR app_is_gestor());
--> statement-breakpoint

-- 3) Projetos: cada pessoa vê só os projetos liberados para ela (regra do Visitante); só o Gestor altera.
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY read_visible ON projects FOR SELECT USING (app_sistema() OR app_sees_project(id));
--> statement-breakpoint
CREATE POLICY write_gestor ON projects FOR ALL USING (app_sistema() OR app_is_gestor()) WITH CHECK (app_sistema() OR app_is_gestor());
--> statement-breakpoint

-- 4) Membros de projeto: a pessoa vê as próprias linhas e as dos projetos que vê; só o Gestor altera.
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE project_members FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY read_visible ON project_members FOR SELECT USING (app_sistema() OR (app_is_active() AND (user_id = app_user_id() OR app_sees_project(project_id))));
--> statement-breakpoint
CREATE POLICY write_gestor ON project_members FOR ALL USING (app_sistema() OR app_is_gestor()) WITH CHECK (app_sistema() OR app_is_gestor());
--> statement-breakpoint

-- 5) Auditoria: qualquer pessoa ativa registra em seu nome; só o Gestor lê.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY insert_own ON audit_log FOR INSERT WITH CHECK (app_sistema() OR (app_is_active() AND actor_user_id = app_user_id()));
--> statement-breakpoint
CREATE POLICY read_gestor ON audit_log FOR SELECT USING (app_sistema() OR app_is_gestor());
