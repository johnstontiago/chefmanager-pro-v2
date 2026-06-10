// Reglas de roles del módulo de fichas (importable desde cliente y servidor).
//   superuser/admin/cocina → pueden crear y editar
//   superuser/admin        → pueden eliminar
//   todos los autenticados → pueden ver

const EDIT_ROLES = ["superuser", "admin", "cocina"];
const DELETE_ROLES = ["superuser", "admin"];

export function canEditFichas(rol: string): boolean {
  return EDIT_ROLES.includes(rol);
}

export function canDeleteFichas(rol: string): boolean {
  return DELETE_ROLES.includes(rol);
}
