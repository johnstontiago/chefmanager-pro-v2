import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { activateLicense } from "@/lib/lemonsqueezy";
import { hashPin } from "@/lib/pin";
import { seedInsumosPorDefecto } from "@/lib/tenants/seedInsumosPorDefecto";

export const dynamic = "force-dynamic";

const RegistroSchema = z.object({
  licenseKey: z.string().min(1, "La licencia es obligatoria").max(200),
  negocioNombre: z.string().min(1, "El nombre del negocio es obligatorio").max(200),
  localNombre: z.string().min(1, "El nombre del local es obligatorio").max(200),
  adminNombre: z.string().min(1, "Tu nombre es obligatorio").max(200),
  email: z.string().email("Email no válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  pin: z.string().regex(/^\d{4}$/, "El PIN debe tener exactamente 4 dígitos"),
});

// Auto-registro de un nuevo negocio mediante license key de Lemon Squeezy.
// Público (sin sesión): el "portero" es la licencia válida.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RegistroSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { licenseKey, negocioNombre, localNombre, adminNombre, email, password, pin } = parsed.data;

    // 1) Email único antes de consumir la activación de la licencia.
    const existing = await prisma.usuario.findUnique({ where: { email: email.trim() } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe una cuenta con ese email." }, { status: 400 });
    }

    // 2) Activar la licencia contra Lemon Squeezy (verifica producto/tienda).
    const lic = await activateLicense(licenseKey.trim(), negocioNombre.trim());
    if (!lic.ok) {
      return NextResponse.json({ error: lic.error }, { status: 400 });
    }

    // 3) Crear negocio + primer local + usuario admin en una transacción.
    const hash = await bcrypt.hash(password, 10);
    const pinHash = await hashPin(pin);
    const fechaVencimiento = lic.expiresAt ? new Date(lic.expiresAt) : null;

    const tenant = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          nombre: negocioNombre.trim(),
          email: email.trim(),
          plan: "profesional",
          activo: true,
          fechaVencimiento,
          licenseKey: licenseKey.trim(),
          licenseInstanceId: lic.instanceId ?? null,
          licenseStatus: lic.status ?? "active",
        },
      });

      const unidad = await tx.unidad.create({
        data: { nombre: localNombre.trim(), activo: true, tenantId: tenant.id },
      });

      await tx.usuario.create({
        data: {
          email: email.trim(),
          password: hash,
          nombre: adminNombre.trim(),
          rol: "admin",
          activo: true,
          pinCode: pinHash,
          unidadId: unidad.id,
          tenantId: tenant.id,
        },
      });

      return tenant;
    });

    await seedInsumosPorDefecto(tenant.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en auto-registro:", error);
    return NextResponse.json({ error: "No se pudo crear la cuenta. Inténtalo de nuevo." }, { status: 500 });
  }
}
