import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { hashPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

const UsuarioSchema = z.object({
  email: z.string().email("Email inválido"),
  nombre: z.string().min(1, "Nombre requerido").max(200),
  password: z.string().min(8, "Mínimo 8 caracteres").max(100),
  rol: z.enum(["superuser", "admin", "recepcion", "cocina", "viewer"]).default("admin"),
  unidadId: z.number().int().positive().optional().nullable(),
  pinCode: z.string().regex(/^\d{4,6}$/).optional().nullable(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const tenantId = parseInt(params.id);
    if (isNaN(tenantId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

    const body = await request.json();
    const parsed = UsuarioSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const { email, nombre, password, rol, unidadId, pinCode } = parsed.data;

    const exists = await prisma.usuario.findUnique({ where: { email } });
    if (exists) return NextResponse.json({ error: "El email ya está registrado" }, { status: 400 });

    // Verificar que la unidad pertenece al mismo tenant
    if (unidadId) {
      const unidad = await prisma.unidad.findFirst({ where: { id: unidadId, tenantId } });
      if (!unidad) return NextResponse.json({ error: "La unidad no pertenece a este negocio" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const usuario = await prisma.usuario.create({
      data: {
        email, nombre,
        password: hashedPassword,
        rol,
        unidadId: unidadId || null,
        pinCode: pinCode ? await hashPin(pinCode) : null,
        activo: true,
        tenantId,
      },
      select: { id: true, email: true, nombre: true, rol: true, activo: true, unidadId: true },
    });

    return NextResponse.json({ usuario }, { status: 201 });
  } catch (error) {
    console.error("[superadmin] POST usuario:", error);
    return NextResponse.json({ error: "Error al crear el usuario" }, { status: 500 });
  }
}
