import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { OnboardingSchema } from "@/lib/schemas";
import { hashPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const user = session.user as any;
    if (user.rol !== "superuser") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

    const body = await request.json();
    const parsed = OnboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const {
      tenantNombre, tenantCif, tenantEmail, plan, fechaVencimiento, notasInternas,
      unidadNombre, unidadDireccion, unidadTelefono,
      adminEmail, adminNombre, adminPassword, adminPin,
    } = parsed.data;

    // Verificar email de admin no existe
    const adminExists = await prisma.usuario.findUnique({ where: { email: adminEmail } });
    if (adminExists) {
      return NextResponse.json({ error: `El email ${adminEmail} ya está registrado` }, { status: 400 });
    }

    // Verificar CIF único si se provee
    if (tenantCif) {
      const cifExists = await prisma.tenant.findUnique({ where: { cif: tenantCif } });
      if (cifExists) return NextResponse.json({ error: "CIF ya registrado en otro negocio" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Transacción atómica: todo o nada
    const resultado = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          nombre: tenantNombre,
          cif: tenantCif || null,
          email: tenantEmail,
          regionUE: true,
          plan: plan || "basico",
          fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
          notasInternas: notasInternas || null,
          activo: true,
        },
      });

      const unidad = await tx.unidad.create({
        data: {
          nombre: unidadNombre,
          direccion: unidadDireccion || null,
          telefono: unidadTelefono || null,
          activo: true,
          tenantId: tenant.id,
        },
      });

      const admin = await tx.usuario.create({
        data: {
          email: adminEmail,
          nombre: adminNombre,
          password: hashedPassword,
          rol: "admin",
          pinCode: adminPin ? await hashPin(adminPin) : null,
          activo: true,
          tenantId: tenant.id,
          unidadId: unidad.id,
        },
      });

      return { tenant, unidad, adminId: admin.id, adminEmail: admin.email };
    });

    return NextResponse.json({ resultado }, { status: 201 });
  } catch (error) {
    console.error("[onboarding] Error:", error);
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
