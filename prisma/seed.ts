import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seed...');

  // Create a default tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'ShopUSA',
    },
  });

  console.log(`Created Tenant: ${tenant.name} (${tenant.id})`);

  // Create SuperAdmin User
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@shopusa.com',
      role: 'SUPERADMIN',
    },
  });

  // Create Clients
  const clientsData = [
    { code: 'EC00352', name: 'Eli Alvarado', country: 'Ecuador', city: 'Cuenca', phone: '+593-95-909-8703' },
    { code: 'EC00351', name: 'Maria Cielo Duran', country: 'Ecuador', city: 'Cuenca', phone: '+593 98 042 6120' },
    { code: 'EC00350', name: 'Isabel Cristina Cordova', country: 'Ecuador', city: 'Cuenca', phone: '+1 (925) 665-9017' },
    { code: 'EC00349', name: 'Juanita Valdivieso', country: 'Ecuador', city: 'Cuenca', phone: '+593 99 304 2410' },
    { code: 'EC00313', name: 'Astrid Bravo', country: 'Ecuador', city: 'Cuenca', phone: '+593 12 345 6789' },
    { code: 'EC00164', name: 'Sebastian Reinoso', country: 'Ecuador', city: 'Cuenca', phone: '+593 98 765 4321' },
  ];

  const clients: { id: string; name: string }[] = [];
  for (const c of clientsData) {
    const client = await prisma.client.create({
      data: { ...c, tenantId: tenant.id },
    });
    clients.push(client);
    console.log(`Created Client: ${client.name}`);
  }

  // Create Boxes
  const boxesData = [
    { internalId: '#158', size: 'Small', status: 'DELIVERED', country: 'Ecuador', totalWeight: 7.74 },
    { internalId: '#157', size: 'Small', status: 'DELIVERED', country: 'Ecuador', totalWeight: 8.46 },
    { internalId: '#156', size: 'Small', status: 'DELIVERED', country: 'Ecuador', totalWeight: 8.40 },
  ];

  const boxes = [];
  for (const b of boxesData) {
    const box = await prisma.box.create({
      data: { ...b, tenantId: tenant.id, status: b.status as any },
    });
    boxes.push(box);
  }

  // Create Orders
  const findClient = (name: string) => clients.find(c => c.name === name)!;

  const ordersData = [
    { client: findClient('Maria Cielo Duran'), amount: 8.50, balance: 0.00, count: 2, status: 'IN_TRANSIT' },
    { client: findClient('Astrid Bravo'), amount: 17.00, balance: 0.00, count: 3, status: 'IN_TRANSIT' },
    { client: findClient('Sebastian Reinoso'), amount: 4.25, balance: 4.25, count: 1, status: 'IN_TRANSIT' },
    { client: findClient('Juanita Valdivieso'), amount: 96.93, balance: 4.96, count: 2, status: 'DELIVERED', boxId: boxes[0].id },
  ];

  for (const o of ordersData) {
    await prisma.order.create({
      data: {
        tenantId: tenant.id,
        clientId: o.client.id,
        totalAmount: o.amount,
        balance: o.balance,
        status: o.status as any,
        boxId: o.boxId,
      },
    });
  }

  // Create Expenses
  const expensesData = [
    { expenseDate: new Date('2026-04-10'), category: 'Insumos', description: 'Compra de cajas', country: 'Ecuador', originalAmount: 73.83, adjustedAmount: 73.83 },
    { expenseDate: new Date('2026-04-10'), category: 'Logística', description: 'Envío 10 de abril', country: 'Ecuador', originalAmount: 269.45, adjustedAmount: 269.45 },
    { expenseDate: new Date('2026-04-10'), category: 'Ventas', description: 'Ventas envío 10 de abril', country: 'Ecuador', originalAmount: 1175.88, adjustedAmount: 1175.88 },
  ];

  for (const e of expensesData) {
    await prisma.expense.create({
      data: { ...e, tenantId: tenant.id },
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
