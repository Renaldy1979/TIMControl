import type { CardStatus, Feature, Priority, Scope, UserState } from "./enums";

/** Textos da interface (pt-BR). Código e chaves ficam em inglês. */
export const FEATURE_LABELS: Record<Feature, string> = {
  kanban: "Kanban (cards)",
  admin: "Administração",
};

export const ACTION_LABELS: Record<string, string> = {
  "kanban.view": "Ver quadros e visão geral",
  "kanban.create": "Criar card",
  "kanban.edit": "Editar card",
  "kanban.move": "Mover card entre colunas",
  "kanban.comment": "Comentar e anexar",
  "kanban.delete": "Excluir card",
  "admin.users": "Gerenciar usuários e convites",
  "admin.profiles": "Gerenciar perfis e permissões",
  "admin.projects": "Criar e configurar projetos",
  "admin.groups": "Gerenciar grupos",
};

export const SCOPE_LABELS: Record<Scope | "none", string> = {
  all: "Todos",
  own: "Os seus e os que é responsável",
  none: "Não",
};

export const USER_STATE_LABELS: Record<UserState, string> = {
  invited: "Convidado",
  active: "Ativo",
  disabled: "Desativado",
};

export const STATUS_LABELS: Record<CardStatus, string> = {
  todo: "A Fazer",
  doing: "Em andamento",
  review: "Em revisão",
  done: "Concluído",
};


export const PRIORITY_LABELS: Record<Priority, string> = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" };

