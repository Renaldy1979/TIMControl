# Design — TIMControl

Referência visual: `modelo.webp`, que o dono deixou em `C:\Projetos\kanbanTim` (não está no repositório). É uma imagem de terceiros e serve só de inspiração. O TIMControl segue o mesmo estilo, sem copiar nada dela.

## 1. Linguagem
- Menu lateral **índigo escuro**, com ícones em círculo; o item ativo fica em **roxo**. No celular, o menu vira uma barra inferior.
- Fundo lavanda bem claro e cartões brancos com cantos grandes (20 px) e sombra suave.
- Selo colorido do projeto no topo do card: texto na cor do projeto, sobre um fundo da mesma cor bem clara.
- A partir do Lote 2, o card do kanban traz o selo, o título, a barra de progresso (checklist), os avatares dos responsáveis e os contadores de anexos e comentários. Ao arrastar, o card inclina e deixa um espaço tracejado.

## 2. Tokens (`apps/web/src/styles/globals.css` e `tailwind.config.ts`)
| Token | Valor | Uso |
|---|---|---|
| `side` | #1E0B4B | menu lateral, barra inferior |
| `br` / `br-2` | #7C5CFC / #6440F0 | cor principal, botões, item ativo |
| `br-soft` | #EFEAFF | fundos de destaque, selos |
| `bg` | #F3F4FB | fundo da página |
| `sf` / `sf2` | #FFFFFF / #F6F5FE | cartões / áreas secundárias |
| `ink` / `ink2` / `ink3` | #1B1530 / #4B4565 / #6E6889 | textos |
| `ok`, `warn`, `danger`, `info` | verde, âmbar, vermelho, azul | estados (sempre com texto, nunca só cor) |

Fonte: Plus Jakarta Sans (variável). Texto base 15 px; alvos de toque ≥ 44 px.

## 3. Cores dos projetos
`PROJECT_COLORS` em `packages/shared/src/schemas.ts`: roxo, âmbar, azul, verde, rosa, vermelho, índigo e verde-água.
