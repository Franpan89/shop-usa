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

  // Create Orders (with real products)
  const findClient = (name: string) => clients.find(c => c.name === name)!;

  type SeedProduct = {
    name: string;
    weight: number;
    purchasedBy: 'CLIENT' | 'SHOPUSA';
    purchaseValue?: number;
    shippingCost: number;
    prepaidAmount?: number;
  };

  const ordersData: Array<{
    client: { id: string; name: string };
    amount: number;
    balance: number;
    status: string;
    boxId?: string;
    products: SeedProduct[];
  }> = [
    {
      client: findClient('Maria Cielo Duran'),
      amount: 8.50,
      balance: 0.00,
      status: 'SHIPPED',
      products: [
        { name: 'Crema facial', weight: 0.5, purchasedBy: 'CLIENT', shippingCost: 4.25 },
        { name: 'Vitaminas', weight: 0.5, purchasedBy: 'CLIENT', shippingCost: 4.25, prepaidAmount: 8.50 },
      ],
    },
    {
      client: findClient('Astrid Bravo'),
      amount: 17.00,
      balance: 0.00,
      status: 'READY_TO_SHIP',
      products: [
        { name: 'Camiseta', weight: 0.5, purchasedBy: 'CLIENT', shippingCost: 4.25 },
        { name: 'Pantalón', weight: 1.0, purchasedBy: 'CLIENT', shippingCost: 8.50 },
        { name: 'Calcetines', weight: 0.5, purchasedBy: 'CLIENT', shippingCost: 4.25, prepaidAmount: 17.00 },
      ],
    },
    {
      client: findClient('Sebastian Reinoso'),
      amount: 4.25,
      balance: 4.25,
      status: 'ARRIVED',
      products: [
        { name: 'Perfume', weight: 0.5, purchasedBy: 'CLIENT', shippingCost: 4.25 },
      ],
    },
    {
      client: findClient('Juanita Valdivieso'),
      amount: 96.93,
      balance: 4.96,
      status: 'DELIVERED',
      boxId: boxes[0].id,
      products: [
        { name: 'Cartera de cuero', weight: 4.0, purchasedBy: 'SHOPUSA', purchaseValue: 65.00, shippingCost: 34.00, prepaidAmount: 50.00 },
        { name: 'Bufanda', weight: 3.74, purchasedBy: 'CLIENT', shippingCost: 31.83, prepaidAmount: 41.97 },
      ],
    },
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
        products: {
          create: o.products.map((p) => ({
            name: p.name,
            weight: p.weight,
            purchasedBy: p.purchasedBy,
            purchaseValue: p.purchaseValue ?? null,
            shippingCost: p.shippingCost,
            prepaidAmount: p.prepaidAmount ?? 0,
          })),
        },
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
