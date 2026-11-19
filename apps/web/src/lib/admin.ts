import { can, type Viewer } from "@timcontrol/shared";

export const ADMIN_SECTIONS = [
  { href: "/configuracoes/usuarios", key: "admin.users", title: "Usuários", text: "Convidar pessoas, mudar perfil e desativar acesso." },
  { href: "/configuracoes/perfis", key: "admin.profiles", title: "Perfis e permissões", text: "O que cada perfil pode fazer em cada funcionalidade." },
  { href: "/configuracoes/projetos", key: "admin.projects", title: "Projetos", text: "Sistemas cobertos e quem tem acesso a cada um." },
  { href: "/configuracoes/grupos", key: "admin.groups", title: "Grupos", text: "Várias pessoas como responsável de uma vez." },
] as const;

export const adminSectionsFor = (v: Viewer) => ADMIN_SECTIONS.filter((s) => can(v, s.key));
