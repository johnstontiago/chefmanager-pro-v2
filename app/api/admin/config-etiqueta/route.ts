import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

const DEFAULT = {
  titulo:    "CHEFMANAGER PRO",
  altoLabel: 472,
  xMargen:   15,
  espaciado: 45,
  fuente:    4,
  xQR:       261,
  yQR:       339,
  tamanoQR:  3,
};

async function getConfig() {
  const row = await prisma.configEtiqueta.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, ...DEFAULT },
  });
  // Migración: si espaciado ≤ 38 es la configuración vieja → actualizar todo
  if (row.espaciado <= 38) {
    return prisma.configEtiqueta.update({
      where: { id: 1 },
      data:  {
        altoLabel: DEFAULT.altoLabel,
        espaciado: DEFAULT.espaciado,
        xQR:       DEFAULT.xQR,
        yQR:       DEFAULT.yQR,
      },
    });
  }
  return row;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const config = await getConfig();
  return NextResponse.json({ config });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const allowed = ["titulo", "altoLabel", "xMargen", "espaciado", "fuente", "xQR", "yQR", "tamanoQR"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const config = await prisma.configEtiqueta.upsert({
    where:  { id: 1 },
    update: data,
    create: { id: 1, ...DEFAULT, ...data },
  });

  return NextResponse.json({ config });
}
