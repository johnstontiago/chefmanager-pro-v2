// Reglas de quién puede gestionar a quién en la gestión de usuarios.
// Fuente única de verdad: se usa en el backend (barrera real) y en la UI.

// Roles que un "admin" local puede crear, editar y borrar.
export const ROLES_GESTIONABLES_POR_ADMIN = ["recepcion", "cocina", "viewer"] as const;

// ¿Puede el actor gestionar (editar/borrar) a un usuario con el rol indicado?
export function puedeGestionarUsuario(actorRol: string, targetRol: string): boolean {
  if (actorRol === "superuser") return true;
  if (actorRol === "admin") return (ROLES_GESTIONABLES_POR_ADMIN as readonly string[]).includes(targetRol);
  return false;
}

// ¿Puede el actor asignar (crear/editar con) el rol indicado?
// Un admin no puede crear admins ni superusers.
export function puedeAsignarRol(actorRol: string, rol: string): boolean {
  if (actorRol === "superuser") return true;
  if (actorRol === "admin") return (ROLES_GESTIONABLES_POR_ADMIN as readonly string[]).includes(rol);
  return false;
}

// ¿El actor tiene acceso al apartado de gestión de usuarios?
export function puedeAccederGestionUsuarios(actorRol: string): boolean {
  return actorRol === "superuser" || actorRol === "admin";
}
