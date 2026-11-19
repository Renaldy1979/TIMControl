#!/bin/sh
set -e
# Roda uma vez, na criação do volume.
#  - timcontrol_owner: dono do banco e do schema; roda as migrações. Não é superusuário.
#  - timcontrol_app:   papel da aplicação. SEM superusuário e SEM BYPASSRLS: o RLS vale de verdade para ele.
#                     Só tem DML nas tabelas; não cria, altera nem apaga objetos.
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
CREATE ROLE timcontrol_owner LOGIN PASSWORD '${OWNER_DB_PASSWORD}' NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE;
CREATE ROLE timcontrol_app   LOGIN PASSWORD '${APP_DB_PASSWORD}'   NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

ALTER DATABASE ${POSTGRES_DB} OWNER TO timcontrol_owner;
REVOKE ALL ON DATABASE ${POSTGRES_DB} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO timcontrol_owner, timcontrol_app;

ALTER SCHEMA public OWNER TO timcontrol_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO timcontrol_app;

-- Tabelas e sequências criadas pelo dono ficam acessíveis (DML) ao papel da aplicação.
ALTER DEFAULT PRIVILEGES FOR ROLE timcontrol_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO timcontrol_app;
ALTER DEFAULT PRIVILEGES FOR ROLE timcontrol_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO timcontrol_app;
SQL
