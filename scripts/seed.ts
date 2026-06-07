import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed de la base de datos...");

  // Crear Unidades
  const unidad1 = await prisma.unidad.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: "Restaurante Central",
      direccion: "Calle Mayor 123, Madrid",
      telefono: "+34 912 345 678",
      activo: true,
      tenantId: 1,
    },
  });

  const unidad2 = await prisma.unidad.upsert({
    where: { id: 2 },
    update: {},
    create: {
      nombre: "Sucursal Norte",
      direccion: "Avenida del Norte 456, Barcelona",
      telefono: "+34 934 567 890",
      activo: true,
      tenantId: 1,
    },
  });

  console.log("Unidades:", unidad1.id, unidad2.id);

  // Crear Usuarios
  const superuserHash = await bcrypt.hash("984555", 10);
  const adminHash = await bcrypt.hash("admin123", 10);

  await prisma.usuario.upsert({
    where: { email: "johnstontiago02@gmail.com" },
    update: {},
    create: {
      email: "johnstontiago02@gmail.com",
      password: superuserHash,
      nombre: "Super Admin",
      rol: "superuser",
      unidadId: unidad1.id,
      pinCode: "1234",
      activo: true,
      tenantId: 1,
    },
  });

  await prisma.usuario.upsert({
    where: { email: "admin.central@chefmanager.com" },
    update: {},
    create: {
      email: "admin.central@chefmanager.com",
      password: adminHash,
      nombre: "Admin Central",
      rol: "admin",
      unidadId: unidad1.id,
      pinCode: "1111",
      activo: true,
      tenantId: 1,
    },
  });

  await prisma.usuario.upsert({
    where: { email: "admin.norte@chefmanager.com" },
    update: {},
    create: {
      email: "admin.norte@chefmanager.com",
      password: adminHash,
      nombre: "Admin Norte",
      rol: "admin",
      unidadId: unidad2.id,
      pinCode: "2222",
      activo: true,
      tenantId: 1,
    },
  });

  // Usuario de prueba requerido por el sistema
  await prisma.usuario.upsert({
    where: { email: "john@doe.com" },
    update: {},
    create: {
      email: "john@doe.com",
      password: await bcrypt.hash("johndoe123", 10),
      nombre: "John Doe",
      rol: "superuser",
      unidadId: unidad1.id,
      pinCode: "0000",
      activo: true,
      tenantId: 1,
    },
  });

  console.log("Usuarios creados");

  // Crear Categorías GLOBALES - usando findFirst + create (nombre no es unique)
  const categoriasNames = ["Carnes", "Pescados", "Verduras", "Lácteos", "Secos"];
  const categorias: any[] = [];
  
  for (const nombre of categoriasNames) {
    let cat = await prisma.categoria.findFirst({ where: { nombre } });
    if (!cat) {
      cat = await prisma.categoria.create({ data: { nombre, activo: true, tenantId: 1 } });
    }
    categorias.push(cat);
  }

  console.log("Categorías globales creadas");

  // Crear Proveedores GLOBALES (sin unidadId)
  const proveedoresData = [
    { nombre: "Carnes Selectas S.L.", contacto: "Pedro García", telefono: "+34 600 111 111", email: "pedidos@carnesselectas.es" },
    { nombre: "Mar Fresco", contacto: "Ana Marín", telefono: "+34 600 222 222", email: "info@marfresco.com" },
    { nombre: "Huerta del Valle", contacto: "Carlos López", telefono: "+34 600 333 333", email: "pedidos@huertadelvalle.es" },
    { nombre: "Lácteos Frescos", contacto: "Laura Sánchez", telefono: "+34 600 444 444", email: "ventas@lacteosfrescos.es" },
    { nombre: "Distribuciones García", contacto: "Miguel García", telefono: "+34 600 555 555", email: "pedidos@distgarcia.es" },
  ];

  const proveedores: any[] = [];
  for (const p of proveedoresData) {
    let prov = await prisma.proveedor.findFirst({ where: { nombre: p.nombre } });
    if (!prov) {
      prov = await prisma.proveedor.create({ data: { ...p, activo: true, tenantId: 1 } });
    }
    proveedores.push(prov);
  }

  console.log("Proveedores globales creados");

  // Crear Productos GLOBALES (sin unidadId)
  const productosData = [
    // Carnes
    { nombre: "Solomillo de Ternera", categoriaId: categorias[0].id, proveedorId: proveedores[0].id, unidadMedida: "kg", precioUnitario: 28.50, stockMinimo: 5.0 },
    { nombre: "Pechuga de Pollo", categoriaId: categorias[0].id, proveedorId: proveedores[0].id, unidadMedida: "kg", precioUnitario: 8.90, stockMinimo: 10.0 },
    { nombre: "Costillas de Cerdo", categoriaId: categorias[0].id, proveedorId: proveedores[0].id, unidadMedida: "kg", precioUnitario: 12.50, stockMinimo: 8.0 },
    // Pescados
    { nombre: "Lubina Fresca", categoriaId: categorias[1].id, proveedorId: proveedores[1].id, unidadMedida: "kg", precioUnitario: 18.00, stockMinimo: 4.0 },
    { nombre: "Salmón Noruego", categoriaId: categorias[1].id, proveedorId: proveedores[1].id, unidadMedida: "kg", precioUnitario: 16.50, stockMinimo: 5.0 },
    { nombre: "Gambas Rojas", categoriaId: categorias[1].id, proveedorId: proveedores[1].id, unidadMedida: "kg", precioUnitario: 45.00, stockMinimo: 2.5 },
    // Verduras
    { nombre: "Tomates Raf", categoriaId: categorias[2].id, proveedorId: proveedores[2].id, unidadMedida: "kg", precioUnitario: 4.50, stockMinimo: 10.0 },
    { nombre: "Patatas Nuevas", categoriaId: categorias[2].id, proveedorId: proveedores[2].id, unidadMedida: "kg", precioUnitario: 1.80, stockMinimo: 20.0 },
    { nombre: "Cebolla Dulce", categoriaId: categorias[2].id, proveedorId: proveedores[2].id, unidadMedida: "kg", precioUnitario: 1.50, stockMinimo: 15.0 },
    // Lácteos
    { nombre: "Leche Entera", categoriaId: categorias[3].id, proveedorId: proveedores[3].id, unidadMedida: "l", precioUnitario: 0.95, stockMinimo: 50.0 },
    { nombre: "Nata para Cocinar", categoriaId: categorias[3].id, proveedorId: proveedores[3].id, unidadMedida: "l", precioUnitario: 2.80, stockMinimo: 10.0 },
    { nombre: "Queso Manchego Curado", categoriaId: categorias[3].id, proveedorId: proveedores[3].id, unidadMedida: "kg", precioUnitario: 18.00, stockMinimo: 3.0 },
    // Secos
    { nombre: "Arroz Bomba", categoriaId: categorias[4].id, proveedorId: proveedores[4].id, unidadMedida: "kg", precioUnitario: 4.50, stockMinimo: 20.0 },
    { nombre: "Aceite de Oliva Virgen", categoriaId: categorias[4].id, proveedorId: proveedores[4].id, unidadMedida: "l", precioUnitario: 8.50, stockMinimo: 15.0 },
    { nombre: "Harina de Trigo", categoriaId: categorias[4].id, proveedorId: proveedores[4].id, unidadMedida: "kg", precioUnitario: 1.20, stockMinimo: 25.0 },
  ];

  const productos: any[] = [];
  for (const p of productosData) {
    let prod = await prisma.producto.findFirst({ where: { nombre: p.nombre } });
    if (!prod) {
      prod = await prisma.producto.create({
        data: {
          nombre: p.nombre,
          categoriaId: p.categoriaId,
          proveedorId: p.proveedorId,
          unidadMedida: p.unidadMedida,
          precioUnitario: new Decimal(p.precioUnitario),
          stockMinimo: new Decimal(p.stockMinimo),
          activo: true,
          tenantId: 1,
        },
      });
    }
    productos.push(prod);
  }

  console.log("Productos globales creados:", productos.length);

  console.log("\n=== SEED COMPLETADO ===");
  console.log("\nUsuario superuser:");
  console.log("- Email: johnstontiago02@gmail.com");
  console.log("- Password: 984555");
  console.log("- PIN: 1234");
  console.log("\nDatos globales (compartidos entre todas las unidades):");
  console.log("- Categorías:", categoriasNames.length);
  console.log("- Proveedores:", proveedores.length);
  console.log("- Productos:", productos.length);
  console.log("\nDatos por unidad (inventario, pedidos, consumo):");
  console.log("- Se gestionan individualmente por cada unidad");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
