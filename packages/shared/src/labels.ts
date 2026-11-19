import type { Feature, Scope, Tower, UserState } from "./enums";

/** Textos da interface (pt-BR). Código e chaves ficam em inglês. */
export const FEATURE_LABELS: Record<Feature, string> = {
  kanban: "Kanban (cards)",
  meetings: "Reuniões e WarRooms",
  admin: "Administração",
};

export const ACTION_LABELS: Record<string, string> = {
  "kanban.view": "Ver quadros e visão geral",
  "kanban.create": "Criar card",
  "kanban.edit": "Editar card",
  "kanban.move": "Mover card entre colunas",
  "kanban.comment": "Comentar e anexar",
  "kanban.delete": "Excluir card",
  "meetings.view": "Ver reuniões",
  "meetings.create": "Registrar reunião",
  "meetings.edit": "Editar reunião",
  "meetings.delete": "Excluir reunião",
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

export const TOWER_LABELS: Record<Tower, string> = {
  producao: "Produção",
  sustentacao: "Sustentação",
  ambas: "Produção e sustentação",
};

export const USER_STATE_LABELS: Record<UserState, string> = {
  invited: "Convidado",
  active: "Ativo",
  disabled: "Desativado",
};
