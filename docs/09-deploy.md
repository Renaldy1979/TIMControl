# 09 — Deploy no EasyPanel (Lote 1)

Passo a passo para subir o TIMControl na VPS: um **Postgres 16** e o **portal** (a partir do GitHub, com o `Dockerfile` da raiz), com HTTPS. O login usa o **Appwrite que já roda na VPS** (projeto "TIMControl", já criado).

> **Regra de ouro:** senhas e chaves só aparecem nos campos do EasyPanel e do Appwrite. Nunca cole no chat, em e-mail ou no GitHub.

Tenha à mão: acesso ao EasyPanel, ao Console do Appwrite e o endereço que o portal vai usar (o gratuito do EasyPanel ou um subdomínio seu). Daqui em diante ele é o **ENDEREÇO**.

Anote três segredos novos (24 letras e números, **sem símbolos**, que quebram o endereço do banco):

| Segredo | Onde vai |
|---|---|
| Senha do papel **dono** do banco | só no comando de migração (passo 5) |
| Senha do papel **app** do banco | variável `DATABASE_URL` do portal |
| `SETUP_CODE` (12 ou mais caracteres) | variável do portal; libera a configuração inicial |

---

## 1. Configurar o Appwrite (Console do Appwrite, projeto TIMControl)

### 1.1 Plataforma web
**Overview → Integrations → Platforms → Add platform → Web**. Hostname = o ENDEREÇO, sem `https://` e sem barra. Sem isto, os e-mails de convite e de senha falham com "URL host must be one of…".

### 1.2 SMTP (Brevo)
Os e-mails de convite e de recuperação de senha são enviados **pelo Appwrite**, não pelo TIMControl. Por isso o código não muda e o app não precisa de nenhuma variável de SMTP: tudo se configura no Appwrite, usando o **SMTP da Brevo** com o **domínio da VPS** como remetente.

**Na Brevo** (uma vez):
1. **Senders, Domains & Dedicated IPs → Domains → Add a domain**: informe o domínio da VPS. A Brevo mostra os registros DNS (código Brevo, **DKIM** e **DMARC**). Cadastre-os no DNS do domínio (painel da Hostinger) e clique em **Authenticate**. Sem isso os e-mails tendem a cair no spam.
2. Se o domínio já tem um registro **SPF** (`v=spf1 ...`), inclua `include:spf.brevo.com` nele em vez de criar um segundo SPF.
3. **Senders → Add a sender**: crie o remetente, por exemplo `nao-responda@SEU-DOMINIO`, com nome **TIMControl**.
4. **SMTP & API → SMTP**: anote o **servidor** (`smtp-relay.brevo.com`), a **porta** (`587`), o **login** (algo como `xxxx@smtp-brevo.com`) e gere uma **SMTP key**. Atenção: é a *SMTP key*, não a *API key*.

**No Appwrite**, projeto **TIMControl** → **Settings → SMTP**: ligue o *custom SMTP* e preencha:

| Campo | Valor |
|---|---|
| Sender name | TIMControl |
| Sender email | o remetente criado no passo 3 |
| Reply to | (opcional) seu e-mail |
| Server host | `smtp-relay.brevo.com` |
| Server port | `587` |
| Username | o login SMTP da Brevo |
| Password | a SMTP key |
| Secure protocol | TLS |

Salve e use **Send test email**. Se a sua instância não mostrar SMTP por projeto, a mesma configuração vai nas variáveis `_APP_SMTP_*` do Appwrite (`_APP_SMTP_HOST`, `_APP_SMTP_PORT=587`, `_APP_SMTP_SECURE=tls`, `_APP_SMTP_USERNAME`, `_APP_SMTP_PASSWORD`, `_APP_SYSTEM_EMAIL_ADDRESS`, `_APP_SYSTEM_EMAIL_NAME`), mas isso vale para todos os projetos da instância.

O plano gratuito da Brevo envia até 300 e-mails por dia, o que sobra para 10 pessoas.

### 1.3 Métodos de login
**Auth → Settings**: deixe ligados **Email/Password** e **Magic URL** (o convite usa o Magic URL). Sugestão: sessão de 30 dias e *Password dictionary* ligado. Desligue o cadastro aberto se a sua versão oferecer a opção: quem entra é sempre convidado.

### 1.4 Modelos de e-mail (Português)
Em **Auth → Templates**, idioma **pt-br**:
- **Magic URL**: é o **e-mail do convite**. Sugestão de texto: *"Você foi convidado(a) para o TIMControl. Toque no botão abaixo e crie a sua senha. O link vale por pouco tempo; se vencer, peça ao Gestor para reenviar."*
- **Password recovery**: título "Crie uma nova senha no TIMControl".

### 1.5 Chave de API
**Overview → Integrations → API keys → Create API key**, nome `timcontrol-portal`. Escopos do Lote 1 (só estes): `users.read`, `users.write`, `sessions.write`. Copie a chave **uma vez** direto para `APPWRITE_API_KEY` no EasyPanel (passo 4).
Anote também o **Endpoint** (`https://…/v1`) e o **Project ID**.

> No Lote 3 entram `files.read`, `files.write` e `buckets.read` para os anexos.

---

## 2. Criar o Postgres no EasyPanel
1. No projeto do EasyPanel, **+ Service → Postgres**. Nome `timcontrol-db`, versão **16**. Defina a senha do superusuário (só para o passo 3).
2. **Create** e espere ficar verde. Anote o **host interno**, a porta (5432) e o nome do banco.

Não abra a porta do banco para a internet.

---

## 3. Criar os papéis do banco (dono e app)
1. Serviço `timcontrol-db` → **Console** → `psql -U postgres -d NOME_DO_BANCO`
2. Cole, trocando `SENHA_DONO`, `SENHA_APP` e `NOME_DO_BANCO`:
   ```sql
   CREATE ROLE timcontrol_owner LOGIN PASSWORD 'SENHA_DONO' NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE;
   CREATE ROLE timcontrol_app   LOGIN PASSWORD 'SENHA_APP'  NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

   ALTER DATABASE NOME_DO_BANCO OWNER TO timcontrol_owner;
   REVOKE ALL ON DATABASE NOME_DO_BANCO FROM PUBLIC;
   GRANT CONNECT ON DATABASE NOME_DO_BANCO TO timcontrol_owner, timcontrol_app;

   ALTER SCHEMA public OWNER TO timcontrol_owner;
   REVOKE ALL ON SCHEMA public FROM PUBLIC;
   GRANT USAGE ON SCHEMA public TO timcontrol_app;

   ALTER DEFAULT PRIVILEGES FOR ROLE timcontrol_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO timcontrol_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE timcontrol_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO timcontrol_app;
   ```
3. Saia com `\q`. Os endereços ficam:
   ```
   DATABASE_URL       = postgres://timcontrol_app:SENHA_APP@HOST_INTERNO:5432/NOME_DO_BANCO     (variável do portal)
   DATABASE_URL_ADMIN = postgres://timcontrol_owner:SENHA_DONO@HOST_INTERNO:5432/NOME_DO_BANCO  (só no passo 5)
   ```

---

## 4. Criar o portal (App a partir do GitHub)
1. **+ Service → App**, nome `timcontrol-web`.
2. **Source → GitHub**: repositório `Renaldy1979/TIMControl`, branch `main`.
3. **Build**: **Dockerfile**, caminho `Dockerfile`, contexto = raiz do repositório.
4. **Porta 3000.** O EasyPanel usa o `HEALTHCHECK` da imagem (`GET /api/health`).
5. **Domains**: o ENDEREÇO apontando para a porta 3000, com HTTPS.
6. **Environment**:

   | Variável | Valor |
   |---|---|
   | `APP_URL` | `https://ENDEREÇO` (sem barra no final) |
   | `DATABASE_URL` | `postgres://timcontrol_app:SENHA_APP@HOST_INTERNO:5432/NOME_DO_BANCO` |
   | `APPWRITE_ENDPOINT` | `https://…/v1` |
   | `APPWRITE_PROJECT_ID` | o Project ID do TIMControl |
   | `APPWRITE_API_KEY` | a chave do passo 1.5 (**segredo**) |
   | `SETUP_CODE` | o código que você anotou (**segredo**) |
   | `APP_VERSION` | `v0.1.0` |

   **Não crie** `DATABASE_URL_ADMIN` aqui: a aplicação nunca recebe o papel dono.
7. **Deploy** e acompanhe os logs. O build do Next.js é a parte pesada (alguns minutos).

---

## 5. Criar as tabelas (migrações)
Uma vez agora e de novo a cada lote que trouxer tabelas novas (o roteiro avisa).
1. Serviço `timcontrol-web` → **Console**:
   ```bash
   DATABASE_URL_ADMIN='postgres://timcontrol_owner:SENHA_DONO@HOST_INTERNO:5432/NOME_DO_BANCO' node /app/migrate/migrate.mjs
   ```
2. Deve responder `Migrações aplicadas.` Pode rodar de novo sem problema.

---

## 6. Conferir e configurar
1. `https://ENDEREÇO/api/health` deve mostrar `{"ok":true,"db":true,...}`. Se `db` for `false`, confira `DATABASE_URL` e o passo 3.
2. Abra `https://ENDEREÇO`: na primeira vez ele leva para **Configuração inicial**. Informe o `SETUP_CODE`, seu nome, e-mail e senha. Isso cria o Gestor, os perfis, os 3 projetos e os 3 grupos iniciais.
3. A tela de configuração inicial se fecha sozinha depois disso. Se quiser, apague `SETUP_CODE` do EasyPanel e refaça o deploy.
4. Siga o roteiro `docs/lotes/L1-roteiro.md`.

## 7. Atualizar para uma nova versão
Cada merge na `main` vira um deploy (ligue **Auto Deploy** no EasyPanel, ou clique em **Deploy**). Se o lote trouxer migração, rode o passo 5 depois do deploy.

## 8. Problemas comuns
| Sintoma | Causa provável |
|---|---|
| "URL host must be one of…" ao convidar | hostname não cadastrado como plataforma Web (1.1) |
| Convite não chega | SMTP da Brevo no Appwrite (1.2): rode *Send test email*, confira o domínio autenticado e o remetente na Brevo, e olhe o spam. O Gestor pode reenviar em Usuários |
| E-mail cai no spam | DKIM/DMARC da Brevo não cadastrados no DNS, ou dois registros SPF no domínio (1.2) |
| `/api/health` com `db:false` | `DATABASE_URL` errada ou papéis não criados (3) |
| "Configuração inicial fechada" | `SETUP_CODE` ausente ou com menos de 12 caracteres |
| Pessoa entra e volta para o login | ela está desativada ou ainda não aceitou o convite |
