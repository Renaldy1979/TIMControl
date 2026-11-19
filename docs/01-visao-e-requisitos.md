# 01 — Visão e requisitos (escopo v1)

Fonte da verdade do escopo: o documento "Kanban TIM — Escopo e stack (v1)" (Claude Docs, revisado em 19/11/2026). Aqui fica o resumo que o código segue.

## Por quê
Nas reuniões e WarRooms com as fábricas (Accenture, Engineering), o time pede análises e ações, e o gerente pede coisas ao time. Hoje nada disso fica numa ferramenta: tudo vai por e-mail. O TIMControl dá um lugar único para acompanhar as **atividades do time** e as **solicitações**, que podem ir de qualquer pessoa para qualquer pessoa ou grupo.

**Não é** ferramenta de bug nem de chamados. A TIM já tem a ferramenta oficial de bug, o sistema de chamados das lojas e o HelpDesk. Um card pode citar o número de um bug ou chamado como texto (referência externa), sem integração.

## Usuários e perfis
- Cerca de 10 pessoas no início, entre o time da TIM e as pessoas das fábricas. Todos fazem login (e-mail e senha), sem conta corporativa.
- Perfis do sistema: **Gestor** (tudo), **Membro**, **Visitante**. O Gestor pode criar outros perfis.
- As permissões são uma matriz **perfil × funcionalidade × ação**, com alcance "todos" ou "os seus" (cards que a pessoa criou ou em que é responsável). Quem tem o padrão está em `packages/shared/src/permissions.ts` (`DEFAULT_GRANTS`).
- A pessoa tem um perfil geral e pode ter um perfil específico por projeto.
- O **Visitante** só vê os projetos liberados para ele. As pessoas das fábricas normalmente entram como Visitante geral e Membro nos projetos em que atuam.
- **Grupos** (Time TIM, Accenture, Engineering...) servem para colocar várias pessoas como responsável de uma vez.

## Kanban (Lotes 2 e 3)
- Projetos cadastráveis (sistemas cobertos). Começam com TIM Vendas, WhatsApp CX e Ecommerce.
- Colunas fixas: A Fazer, Em andamento, Em revisão, Concluído.
- Quadro por projeto e visão geral (projeto como selo do card). Visões "Minhas atividades" e "Pedi a outros", e uma lista ordenável.
- Card: título, descrição, projeto, tipo (**Tarefa** ou **Solicitação**), responsáveis (pessoas e grupos, um ou mais), prazo, prioridade, etiquetas, anexos, comentários com menção, checklist, histórico.
- Solicitação: solicitante, data do pedido, prazo combinado e referência externa (opcionais).
- Anexos no Appwrite Storage (bucket privado), sem link público, com cada download registrado.

**Fora do escopo** (decisão do dono, 19/11/2026): cadastro de reuniões e WarRooms. O que sai delas vira card direto no quadro.

## Depois da v1
Indicadores (v2) e controle de férias (v3).
