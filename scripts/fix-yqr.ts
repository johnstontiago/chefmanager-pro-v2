import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
p.configEtiqueta
  .upsert({ where: { id: 1 }, update: { yQR: 192 }, create: { id: 1, yQR: 192 } })
  .then((r) => console.log(`yQR=${r.yQR} | espaciado=${r.espaciado} | tamanoQR=${r.tamanoQR}`))
  .catch((e) => console.error(e.message))
  .finally(() => p.$disconnect());
