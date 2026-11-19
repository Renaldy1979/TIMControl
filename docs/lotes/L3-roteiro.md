# Lote 3 — Roteiro de teste

**Antes do deploy (uma vez):** crie o bucket de anexos no Appwrite, dê os escopos `files.read` e `files.write` à chave de API e cadastre `APPWRITE_BUCKET_ID` no EasyPanel (passo 1.6 do `docs/09-deploy.md`).
**Depois do deploy:** rode a migração (passo 5 do `docs/09-deploy.md`). Endereço: https://automacoes-timcontrol.8m5sgi.easypanel.host
Use as mesmas pessoas do Lote 2: você (Gestor), o Membro e a pessoa da fábrica (no grupo Accenture, Membro no WhatsApp CX). Use o celular nos passos da fábrica.
Marque cada passo como **ok** ou descreva o que aconteceu em `L3-validacao.md`.

1. **Card para a fábrica.** Como Gestor, crie um card em WhatsApp CX para o grupo **Accenture** (desmarque você). A pessoa da fábrica recebe um aviso no sininho (confira no passo 6).
2. **Checklist.** Na tela do card, inclua três itens (ex.: Coletar logs, Achar a causa, Propor correção) e marque o primeiro. A barra mostra 1/3. No Quadro, o card mostra a barrinha com 1/3.
3. **Anexo.** Em Anexos, envie um print (PNG ou JPG). Clique no nome: abre numa aba nova. Clique no ícone de baixar: o arquivo é baixado. Tente enviar um arquivo `.exe` ou maior que 10 MB: aparece o aviso e nada é enviado.
4. **Sem link público.** Copie o endereço do anexo (botão direito no nome → copiar link) e abra numa janela anônima do navegador: aparece "Faça login para baixar o anexo.".
5. **Comentário com menção.** Escreva um comentário, abra "Mencionar alguém" e marque o Membro. Publique. O comentário mostra "Avisou: @Membro". Edite o texto: aparece "editado".
6. **Sininho da fábrica (celular).** Entre como a pessoa da fábrica. O sininho mostra o número de avisos: "colocou você como responsável" e "comentou". Toque num aviso: abre o card e o número some.
7. **A fábrica trabalha no card.** Ainda no celular, marque o segundo item do checklist (fica 2/3, com o nome dela) e use **Mover para → Em revisão**. Baixe o print.
8. **Seus avisos.** Volte como Gestor: o sininho mostra "moveu para Em revisão". Em Notificações, use **Marcar todas como lidas**.
9. **Menção do Membro.** Entre como o Membro: em Notificações aparece "mencionou você num comentário".
10. **Quem não pode.** Se houver um Visitante só com leitura (ex.: o do Lote 1), ele vê checklist, anexos e comentários dos projetos liberados, mas não tem os botões de incluir, marcar, enviar ou comentar.
11. **Contadores do Início.** No Início aparecem: Com você, Atrasados, Vencem em 7 dias e Concluídos na semana. Toque em cada um: abre a lista certa.
12. **Instalar como app.** No celular (Chrome: menu ⋮ → **Instalar app** ou **Adicionar à tela inicial**; iPhone/Safari: Compartilhar → **Adicionar à Tela de Início**). O ícone do TIMControl aparece na tela inicial e abre sem a barra do navegador. Com o celular em modo avião, abrir o app mostra "Sem conexão".
13. **Registro de downloads (opcional).** No banco, `select action, created_at from audit_log where entity = 'attachment' order by id desc limit 5;` mostra o envio e os downloads (sem o nome do arquivo).

**Fora deste lote:** lixeira de cards e testes de ponta a ponta automatizados (Lote 4).
