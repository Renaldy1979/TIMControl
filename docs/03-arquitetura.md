# 03 — Arquitetura

```
Navegador / celular (PWA)
      │ HTTPS
EasyPanel (proxy e HTTPS) ──► timcontrol-web (Next.js, apps/web)
                                 │            │
                                 │            └──► Appwrite 1.8.1 (já existe na VPS): login, convites, senha; anexos no Lote 3
                                 └──► timcontrol-db (Postgres 16): dados, RLS
GitHub (TIMControl) ──► EasyPanel constrói o Dockerfile da raiz a cada push na main
```

## Login (Appwrite, padrão do controle-remedios)
- Só o servidor fala com o Appwrite, com a chave de API. O segredo da sessão fica num cookie httpOnly (`tc_session`) e é validado no Appwrite a cada requisição (`server/auth/session.ts`).
- O middleware só confere se o cookie existe. Quem decide é `requireActor()` (`server/actor.ts`): sessão válida → pessoa no Postgres (`users.appwrite_user_id`) → ativa → perfis.
- Limite de tentativas de login por e-mail e por endereço (`server/auth/throttle.ts`).

## Primeiro acesso
`/configuracao-inicial` só existe enquanto não há nenhuma pessoa cadastrada e exige o `SETUP_CODE` do ambiente. Cria o Gestor no Appwrite e no Postgres, mais os perfis, os 3 projetos e os 3 grupos iniciais (`seedInitialData`).

## Convite
1. O Gestor cadastra nome, e-mail, perfil geral e, se quiser, projetos liberados com um perfil. O e-mail sai pelo SMTP da Brevo configurado no Appwrite (docs/09, 1.2); o TIMControl não fala com SMTP.
2. O servidor cria a pessoa como `invited`, gera um token (só o hash vai para o banco, vale 7 dias) e pede ao Appwrite um **Magic URL** para `/aceitar-convite?t=<token>`.
3. A pessoa abre o link, cria a senha e entra. O servidor confere o token, troca o Magic URL por sessão, confere se o e-mail é o mesmo, grava a senha no Appwrite e ativa a pessoa.

## Desativar
Marca `disabled` no Postgres, bloqueia o login no Appwrite e derruba todas as sessões.

## Permissões
`can(viewer, "kanban.edit", { projectId, own })` em `packages/shared`. Server Actions chamam `requirePermission`; o banco repete a regra no RLS.

## Kanban (Lote 2)
- Telas: `/quadro` (visão geral; `?projeto=` vira o quadro do projeto; `?vista=lista` vira lista), `/cards/novo`, `/cards/[id]`, `/minhas`, `/pedi` e `/configuracoes/etiquetas`.
- Filtros ficam na URL (formulário GET): funcionam sem JavaScript e o link pode ser compartilhado. Valores estranhos são ignorados (`readFilters`).
- Arrastar e soltar: `@dnd-kit` no navegador (mouse, toque segurando um instante e teclado). Ao soltar, a tela já mostra o card no lugar e chama `moveCardAction` com a coluna e o card que ficou logo abaixo; se o servidor recusar, o card volta e aparece o motivo. A posição nova é calculada em `dropPosition` (`packages/domain`).
- Cada ação confere a permissão com `can()` e o "é meu" (`isOwnCard`: criou ou é responsável, direto ou por grupo) antes de gravar; o RLS confere de novo no banco.
- O histórico é gravado na mesma transação da alteração.

## Colaboração (Lote 3)
- **Comentários:** formulário na tela do card. A menção é escolhida numa lista de pessoas ("Avisar") e cada mencionada recebe uma notificação. O autor edita ou apaga o seu; o Gestor apaga qualquer um.
- **Checklist:** itens com caixa de marcar e barra de progresso (x de y). Quem edita ou pode mover o card mexe no checklist.
- **Anexos:** enviados pela tela do card (até 10 MB; imagens, PDF, texto, planilhas, documentos e zip). O servidor confere a permissão, grava o arquivo no bucket privado do Appwrite com a chave de API e guarda só os dados em `attachments`. O download passa sempre por `/api/anexos/[id]`: o servidor busca o anexo com o RLS de quem pediu, registra no `audit_log` e entrega o arquivo. Não existe link público nem link direto do Appwrite.
- **Notificações (sininho):** gravadas na mesma transação da ação que as gerou. Avisam quando alguém te coloca como responsável (direto ou pelo seu grupo), te menciona, comenta ou move um card seu (que você criou ou de que é responsável). Quem fez a ação não é avisado. O número de não lidas aparece no topo; `/notificacoes` lista e marca como lida.
- **Painel de contadores:** no Início, com você, atrasados, vencem em 7 dias e concluídos nos últimos 7 dias, sempre dentro dos projetos que a pessoa vê.
- **Instalar como app (PWA):** manifesto com ícones e um service worker mínimo que só mostra uma página "sem conexão". Ele não guarda dados dos cards no aparelho (podem ter dado de cliente).

