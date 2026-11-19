# 09 — Deploy no EasyPanel (Lote 1)

Passo a passo para subir o TIMControl na VPS: um **Postgres 16** e o **portal** (a partir do GitHub, com o `Dockerfile` da raiz), com HTTPS. O login usa o **Appwrite que já roda na VPS** (projeto "TIMControl", já criado).

> **Regra de ouro:** senhas e chaves só aparecem nos campos do EasyPanel e do Appwrite. Nunca cole no chat, em e-mail ou no GitHub.

Tenha à mão o acesso ao EasyPanel e ao Console do Appwrite.

**Endereço do portal:** `https://automacoes-timcontrol.8m5sgi.easypanel.host` (domínio gratuito do EasyPanel). Ele aparece em três lugares e precisa ser **igual** nos três: plataforma Web do Appwrite (1.1), domínio do app no EasyPanel (4.5) e variável `APP_URL` (4.6). Se um dia trocar por um domínio próprio, troque nos três.

Anote três segredos novos (24 letras e números, **sem símbolos**, que quebram o endereço do banco):

| Segredo | Onde vai |
|---|---|
| Senha do papel **dono** do banco | só no comando de migração (passo 5) |
| Senha do papel **app** do banco | variável `DATABASE_URL` do portal |
| `SETUP_CODE` (12 ou mais caracteres) | variável do portal; libera a configuração inicial |

---

## 1. Configurar o Appwrite (Console do Appwrite, projeto TIMControl)

### 1.1 Plataforma web
**Overview → Integrations → Platforms → Add platform → Web**. Nome `TIMControl`, Hostname `automacoes-timcontrol.8m5sgi.easypanel.host` (sem `https://` e sem barra). Sem isto, convite e recuperação de senha falham com "URL host must be one of…".

### 1.2 E-mail pela Brevo
Quem envia os e-mails de convite e de senha é o **Appwrite**. O TIMControl não tem nenhuma configuração de e-mail.

Como o endereço `…easypanel.host` não é um domínio seu, não dá para cadastrar DNS (DKIM/SPF) para ele. Então o caminho agora é o mais simples da Brevo: **um remetente confirmado por e-mail**.

**Na Brevo:**
1. Menu do seu nome (canto de cima) → **Senders, Domains & Dedicated IPs → Senders → Add sender**. Nome `TIMControl`, e-mail um endereço seu que receba mensagens. A Brevo manda um código para esse e-mail; confirme.
2. Menu do seu nome → **SMTP & API → aba SMTP**. Copie o **Login** (algo como `xxxx@smtp-brevo.com`) e clique em **Generate a new SMTP key**. Copie a chave na hora: ela só aparece uma vez. É a *SMTP key*, não a *API key*.

**No Appwrite**, projeto TIMControl → **Settings → SMTP** → ligue **Custom SMTP**:

| Campo | Valor |
|---|---|
| Sender name | `TIMControl` |
| Sender email | o e-mail confirmado no passo 1 |
| Server host | `smtp-relay.brevo.com` |
| Server port | `587` |
| Username | o **Login** do passo 2 |
| Password | a **SMTP key** do passo 2 |
| Secure protocol | `TLS` |

Salve e clique em **Send test email**. Se chegar (olhe também o spam), está pronto.

> Remetente sem domínio autenticado pode cair no spam, principalmente se for um Gmail/Hotmail. Para 10 pessoas isso se resolve pedindo para marcarem "não é spam" no primeiro convite. Quando houver um domínio próprio, autentique-o na Brevo (**Domains → Add a domain**) e troque o Sender email.

### 1.3 Métodos de login
**Auth → Settings**: deixe ligados **Email/Password** e **Magic URL** (o convite usa o Magic URL). Sugestão: sessão de 30 dias e *Password dictionary* ligado. Não precisa mexer em cadastro: o TIMControl só deixa entrar quem o Gestor convidou.

### 1.4 Modelos de e-mail (Português)
Em **Auth → Templates**, idioma **pt-br** (os modelos só ficam editáveis com o Custom SMTP do 1.2 ligado). Este passo é opcional: sem ele, os e-mails saem com o texto padrão do Appwrite.
- **Magic URL**: é o **e-mail do convite**. Sugestão de texto: *"Você foi convidado(a) para o TIMControl. Toque no botão abaixo e crie a sua senha. O link vale por pouco tempo; se vencer, peça ao Gestor para reenviar."*
- **Password recovery**: título "Crie uma nova senha no TIMControl".

### 1.5 Chave de API
**Overview → Integrations → API keys → Create API key**, nome `timcontrol-portal`. Escopos do Lote 1 (só estes): `users.read`, `users.write`, `sessions.write`. Copie a chave **uma vez** direto para `APPWRITE_API_KEY` no EasyPanel (passo 4).
Anote também o **Endpoint** (`https://…/v1`) e o **Project ID**.

> No Lote 3 entram `files.read` e `files.write` para os anexos (passo 1.6).

### 1.6 Bucket de anexos (Lote 3)
1. **Storage → Create bucket**, nome `anexos`. Anote o **Bucket ID** (ex.: `anexos`).
2. Em **Settings** do bucket:
   - **Permissions:** deixe **vazio** (nenhum papel, nem "Any" nem "Users"). Só o portal, com a chave de API, lê e grava.
   - **File security:** desligado.
   - **Maximum file size:** 10 MB.
   - **Allowed file extensions:** `png, jpg, jpeg, gif, webp, pdf, txt, csv, log, json, xlsx, xls, docx, doc, pptx, zip`.
   - **Encryption:** ligado. **Antivirus:** ligado, se a sua instância tiver o ClamAV.
3. Na chave de API `timcontrol-portal` (passo 1.5), acrescente os escopos `files.read` e `files.write`.
4. No EasyPanel, serviço `timcontrol-web` → **Environment**, cadastre `APPWRITE_BUCKET_ID` com o id do passo 1 e faça o deploy.

---

## 2. Criar o Postgres no EasyPanel
1. No projeto do EasyPanel, **+ Service → Postgres**. Nome `timcontrol-db`, versão **16**. Anote o usuário e a senha que ele mostra em **Credentials** (é o superusuário, só para o passo 3).
2. **Create** e espere ficar verde. Em **Credentials**, anote o **Internal host** (algo como `PROJETO_timcontrol-db`), a porta (5432) e o **Database name**.

Não abra a porta do banco para a internet.

---

## 3. Criar os papéis do banco (dono e app)
1. Serviço `timcontrol-db` → **Console** → `psql -U USUARIO -d NOME_DO_BANCO` (usuário e banco do Credentials)
   **Importante:** entre já no banco do TIMControl (`-d NOME_DO_BANCO`, por exemplo `automacoes`), não no `postgres`. Os comandos de schema só valem para o banco em que você está conectado; se rodar no banco errado, a migração falha com "permission denied for database".
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
2. **Source → GitHub**: owner `Renaldy1979`, repositório `TIMControl`, branch `main`, build path `/`. Se o EasyPanel não listar o repositório, conecte o GitHub em **Settings → GitHub** do EasyPanel (token com acesso ao repositório).
3. **Build**: **Dockerfile**, caminho `Dockerfile`, contexto = raiz do repositório.
4. **Porta 3000.** O EasyPanel usa o `HEALTHCHECK` da imagem (`GET /api/health`).
5. **Domains**: edite o domínio `automacoes-timcontrol.8m5sgi.easypanel.host` e mude a **porta de destino para 3000** (o EasyPanel vem com 80). HTTPS ligado.
6. **Environment**:

   | Variável | Valor |
   |---|---|
   | `APP_URL` | `https://automacoes-timcontrol.8m5sgi.easypanel.host` (sem barra no final) |
   | `DATABASE_URL` | `postgres://timcontrol_app:SENHA_APP@HOST_INTERNO:5432/NOME_DO_BANCO` |
   | `APPWRITE_ENDPOINT` | `https://…/v1` |
   | `APPWRITE_PROJECT_ID` | o Project ID do TIMControl |
   | `APPWRITE_API_KEY` | a chave do passo 1.5 (**segredo**) |
   | `APPWRITE_BUCKET_ID` | id do bucket de anexos (passo 1.6, a partir do Lote 3) |
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

## 6. Conferir
1. `https://automacoes-timcontrol.8m5sgi.easypanel.host/api/health` deve mostrar `{"ok":true,"db":true,...}`. Se `db` for `false`, confira `DATABASE_URL` e o passo 3.
2. Siga o roteiro `docs/lotes/L1-roteiro.md`. O passo 1 dele é a configuração inicial (cria você como Gestor, os perfis, os 3 projetos e os 3 grupos).
3. Depois da configuração inicial a tela se fecha sozinha. Se quiser, apague `SETUP_CODE` do EasyPanel e refaça o deploy.

## 7. Atualizar para uma nova versão
Cada merge na `main` vira um deploy (ligue **Auto Deploy** no EasyPanel, ou clique em **Deploy**). Se o lote trouxer migração, rode o passo 5 depois do deploy.

## 8. Problemas comuns
| Sintoma | Causa provável |
|---|---|
| "URL host must be one of…" ao convidar | hostname não cadastrado como plataforma Web (1.1) |
| Convite ou recuperação não chega | olhe o spam; rode *Send test email* (1.2); na Brevo, **Transactional → Logs** mostra se saiu. O Gestor pode reenviar o convite em Usuários |
| *Send test email* falha | Username tem que ser o Login SMTP (não o seu e-mail) e Password a SMTP key (não a API key); porta 587 com TLS |
| Site não abre / 502 | porta do domínio no EasyPanel ainda em 80 (4.5) |
| Migração: "permission denied for database" | o passo 3 rodou em outro banco; refaça-o conectado com `-d NOME_DO_BANCO` (sem as linhas `CREATE ROLE`) |
| "relation users does not exist" ao abrir | faltou a migração (5) |
| `/api/health` com `db:false` | `DATABASE_URL` errada ou papéis não criados (3) |
| "Configuração inicial fechada" | `SETUP_CODE` ausente ou com menos de 12 caracteres |
| Pessoa entra e volta para o login | ela está desativada ou ainda não aceitou o convite |
| Enviar anexo dá "Não foi possível salvar agora" | `APPWRITE_BUCKET_ID` ausente ou errado, ou a chave de API sem `files.write` (1.6) |
| Baixar anexo dá "Não foi possível buscar o arquivo agora" | a chave de API sem `files.read` (1.6) |
| Anexo recusado com aviso de tipo ou 10 MB | limite do portal: só imagem, PDF, texto, planilha, documento ou zip, até 10 MB |
