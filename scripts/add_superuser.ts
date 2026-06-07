import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('984555', 10);
  
  // Get the first unit
  let unidad = await prisma.unidad.findFirst();
  
  if (!unidad) {
    console.log('No hay unidades en la base de datos. Creando una...');
    unidad = await prisma.unidad.create({
      data: {
        nombre: 'Restaurante Principal',
        direccion: 'Dirección Principal',
        telefono: '000000000',
        activo: true,
        tenantId: 1,
      }
    });
  }
  
  const user = await prisma.usuario.upsert({
    where: { email: 'johnstontiago02@gmail.com' },
    update: {
      password: hashedPassword,
      rol: 'superuser',
      activo: true
    },
    create: {
      email: 'johnstontiago02@gmail.com',
      password: hashedPassword,
      nombre: 'Tiago Johnston',
      rol: 'superuser',
      unidadId: unidad.id,
      pinCode: '1234',
      activo: true,
      tenantId: 1,
    }
  });
  
  console.log('✅ Usuario superuser creado exitosamente:');
  console.log('   Email:', user.email);
  console.log('   Nombre:', user.nombre);
  console.log('   Rol:', user.rol);
  console.log('   PIN:', user.pinCode);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
