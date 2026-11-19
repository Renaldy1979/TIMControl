-- Permissões do papel da aplicação dentro da própria migração, para não depender
-- do banco em que o passo 3 do docs/09 foi rodado (default privileges valem por banco).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'timcontrol_app') THEN
    GRANT USAGE ON SCHEMA public TO timcontrol_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO timcontrol_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO timcontrol_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO timcontrol_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO timcontrol_app;
  END IF;
END $$;
