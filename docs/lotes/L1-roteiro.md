# Lote 1 — Roteiro de teste

Antes: siga `docs/09-deploy.md` até o passo 6.1 (`/api/health` com `db:true`). Endereço: https://automacoes-timcontrol.8m5sgi.easypanel.host
Use o celular em pelo menos um dos passos.

**Para os convites (passos 6 e 7) você precisa de dois e-mails além do seu.** Podem ser de colegas ou endereços seus. No Gmail, `seunome+membro@gmail.com` e `seunome+fabrica@gmail.com` chegam na sua própria caixa e contam como e-mails diferentes.
Marque cada passo como **ok** ou descreva o que aconteceu em `L1-validacao.md`.

1. **Configuração inicial.** Abra o endereço. Você cai em "Configuração inicial". Informe o `SETUP_CODE`, seu nome, e-mail e senha. Você entra como **Gestor** e vê TIM Vendas, WhatsApp CX e Ecommerce no Início.
2. **Sair e entrar.** Saia (no computador, ícone no pé do menu lateral; no celular, **Conta → Sair**) e entre de novo com o e-mail e a senha.
3. **Esqueci a senha.** Saia, clique em "Esqueci minha senha" na tela de login, peça o link, abra o e-mail (olhe o spam), crie uma senha nova e entre com ela. Este é o primeiro teste do envio pela Brevo.
4. **Projeto novo.** Configurações → Projetos → crie um projeto (ex.: "Portal B2B", sigla B2B, uma cor). Ele aparece no Início.
5. **Grupo.** Configurações → Grupos → abra "Time TIM" e marque você como membro. Salve.
6. **Convidar um Membro.** Configurações → Usuários → convide o primeiro e-mail com perfil geral **Membro**. O convite chega por e-mail (o link do e-mail vale cerca de 1 hora, limite do Appwrite; se vencer, use **Reenviar convite** em Usuários); no celular, abra o link, crie a senha e entre. Ela vê todos os projetos e **não** vê Configurações.
7. **Convidar alguém da fábrica.** Convide o segundo e-mail com perfil geral **Visitante**, liberando só **WhatsApp CX** com perfil **Membro** nesse projeto. Abra o convite numa janela anônima (ou em outro aparelho) para não misturar com a sua sessão de Gestor. Ao entrar, ela vê só o WhatsApp CX, com "Seu perfil aqui: Membro".
8. **Mudar uma permissão.** Configurações → Perfis e permissões → para **Membro**, mude "Excluir card" para "Os seus e os que é responsável" e salve. Recarregue a página: o valor continua lá. (O efeito nos cards aparece no Lote 2.)
9. **Visitante vê só o liberado.** Configurações → Projetos → em TIM Vendas, escolha a pessoa da fábrica, "Perfil neste projeto" **Visitante**, e clique em **Liberar acesso**. Ao recarregar, ela passa a ver TIM Vendas também, com "Seu perfil aqui: Visitante".
10. **Desativar.** Configurações → Usuários → na pessoa da fábrica, clique em **Desativar acesso**. No aparelho dela, ao recarregar, ela volta para o login e não consegue entrar. Clique em **Reativar acesso** e confira que ela entra de novo.

**Fora deste lote:** cards, quadros, reuniões, anexos (Lotes 2 e 3).
