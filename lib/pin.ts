import bcrypt from "bcryptjs";

// El PIN tiene un espacio de claves pequeño (4 dígitos = 10.000 combinaciones),
// por eso se almacena cifrado (hash con sal por usuario), igual que la contraseña.

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

// Verifica un PIN contra el valor almacenado.
// Compatible con PINs antiguos guardados en texto plano (se aceptan hasta que
// el usuario actualice su PIN), para no bloquear a nadie tras el cambio.
export async function verifyPin(submitted: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  // Los hashes bcrypt empiezan por "$2".
  if (stored.startsWith("$2")) {
    return bcrypt.compare(submitted, stored);
  }
  // PIN heredado en texto plano.
  return submitted === stored;
}
