import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding TerraVolt master data...');

  // ---------- 1. SETTINGS ----------
  // Company-wide numbers used by sizing and quotes (editable later).
  await prisma.setting.createMany({
    data: [
      { key: 'company_name', value: 'SunPower Solutions' },
      { key: 'price_per_unit', value: '8' },        // ₹ per electricity unit (kWh)
      { key: 'units_per_kw_month', value: '120' },  // units 1 kW of panels makes in a month
      { key: 'gst_percent', value: '12' },          // assumption: check the current rate
      { key: 'invoice_due_days', value: '15' },
    ],
  });

  // ---------- 2. SIZING RULES ----------
  // Monthly units range + minimum shadow-free roof area for each system size.
  await prisma.sizingRule.createMany({
    data: [
      { kw: 1, unitsFrom: 0,   unitsTo: 150,  minRoofSqft: 100 },
      { kw: 2, unitsFrom: 151, unitsTo: 270,  minRoofSqft: 200 },
      { kw: 3, unitsFrom: 271, unitsTo: 390,  minRoofSqft: 300 },
      { kw: 4, unitsFrom: 391, unitsTo: 510,  minRoofSqft: 400 },
      { kw: 5, unitsFrom: 511, unitsTo: null, minRoofSqft: 500 }, // null = no upper limit
    ],
  });

  // ---------- 3. USERS ----------
  // Same demo password for everyone, stored only as a hash.
  const passwordHash = await bcrypt.hash('terravolt123', 10);

  const users = [
    { name: 'Harjeet Sandhu', email: 'director@terravolt.test',  role: 'DIRECTOR',   hourlyRate: 0 },
    { name: 'Neha Arora',     email: 'sales@terravolt.test',     role: 'SALES',      hourlyRate: 0 },
    { name: 'Rohit Verma',    email: 'warehouse@terravolt.test', role: 'WAREHOUSE',  hourlyRate: 0 },
    { name: 'Priya Kapoor',   email: 'service@terravolt.test',   role: 'SERVICE',    hourlyRate: 0 },
    { name: 'Ankit Bansal',   email: 'accounts@terravolt.test',  role: 'ACCOUNTS',   hourlyRate: 0 },
    { name: 'Ravi Kumar',     email: 'ravi@terravolt.test',      role: 'TECHNICIAN', hourlyRate: 300 },
    { name: 'Aman Singh',     email: 'aman@terravolt.test',      role: 'TECHNICIAN', hourlyRate: 250 },
    { name: 'Gurpreet Kaur',  email: 'gurpreet@terravolt.test',  role: 'TECHNICIAN', hourlyRate: 280 },
    { name: 'Vikas Yadav',    email: 'vikas@terravolt.test',     role: 'TECHNICIAN', hourlyRate: 250 },
  ];

  await prisma.user.createMany({
    data: users.map((u) => ({ ...u, passwordHash })),
  });

  // ---------- 4. PRODUCTS ----------
  // Inverter prices by size (cost = what we pay, sale = what customer pays).
  const inverterCost = { 1: 15000, 2: 22000, 3: 30000, 4: 38000, 5: 45000 };
  const inverterSale = { 1: 19000, 2: 28000, 3: 38000, 4: 48000, 5: 56000 };

  const products = [
    // Serial-tracked items (stock is counted from SerialUnit rows, so stockQty stays 0)
    { sku: 'PNL-540', name: 'Solar panel 540 W', category: 'PANEL', isSerialized: true,
      warrantyMonths: 240, costPrice: 11000, salePrice: 14000, reorderLevel: 20 },

    ...[1, 2, 3, 4, 5].map((kw) => ({
      sku: `INV-${kw}K`, name: `Inverter ${kw} kW`, category: 'INVERTER', isSerialized: true,
      warrantyMonths: 24, costPrice: inverterCost[kw], salePrice: inverterSale[kw], reorderLevel: 2,
    })),

    { sku: 'BAT-150', name: 'Battery 150 Ah', category: 'BATTERY', isSerialized: true,
      warrantyMonths: 24, costPrice: 12000, salePrice: 15500, reorderLevel: 5 },

    { sku: 'CC-01', name: 'Battery charge controller', category: 'CHARGE_CONTROLLER', isSerialized: true,
      warrantyMonths: 24, costPrice: 3500, salePrice: 4800, reorderLevel: 4 },

    // Loose parts (counted with stockQty)
    { sku: 'MNT-KW', name: 'Mounting structure (per kW)', category: 'MOUNTING',
      costPrice: 4000, salePrice: 5500, stockQty: 60, reorderLevel: 10 },
    { sku: 'CBL-DC', name: 'DC cable 4 mm² (per metre)', category: 'WIRING',
      costPrice: 45, salePrice: 65, stockQty: 1500, reorderLevel: 200 },
    { sku: 'CBL-AC', name: 'AC cable (per metre)', category: 'WIRING',
      costPrice: 60, salePrice: 85, stockQty: 800, reorderLevel: 100 },
    { sku: 'MC4', name: 'MC4 connector pair', category: 'WIRING',
      costPrice: 120, salePrice: 180, stockQty: 300, reorderLevel: 40 },
    { sku: 'BOX-DC', name: 'DC distribution box', category: 'SAFETY',
      costPrice: 2500, salePrice: 3500, stockQty: 30, reorderLevel: 5 },
    { sku: 'BOX-AC', name: 'AC distribution box', category: 'SAFETY',
      costPrice: 2500, salePrice: 3500, stockQty: 30, reorderLevel: 5 },
    { sku: 'EARTH-KIT', name: 'Earthing kit', category: 'SAFETY',
      costPrice: 3000, salePrice: 4200, stockQty: 30, reorderLevel: 5 },
    { sku: 'LA-01', name: 'Lightning arrester', category: 'SAFETY',
      costPrice: 1800, salePrice: 2600, stockQty: 30, reorderLevel: 5 },

    // Service: cost is 0 here because labour cost comes from technician TimeLogs
    { sku: 'SVC-INSTALL', name: 'Installation and commissioning (per kW)', category: 'SERVICE',
      costPrice: 0, salePrice: 5000 },
  ];

  await prisma.product.createMany({ data: products });

  // Build a lookup: sku -> id, so kits can refer to products by their code
  const allProducts = await prisma.product.findMany();
  const productId = Object.fromEntries(allProducts.map((p) => [p.sku, p.id]));

  // ---------- 5. KITS ----------
  // One kit per size and type. Off-Grid = On-Grid + batteries.
  for (const type of ['ON_GRID', 'OFF_GRID']) {
    for (let kw = 1; kw <= 5; kw++) {
      const items = [
        { sku: 'PNL-540',     qty: 2 * kw },
        { sku: `INV-${kw}K`,  qty: 1 },
        { sku: 'CC-01',       qty: 1 },
        { sku: 'MNT-KW',      qty: kw },
        { sku: 'CBL-DC',      qty: 15 * kw },
        { sku: 'CBL-AC',      qty: 10 },
        { sku: 'MC4',         qty: 2 * kw },
        { sku: 'BOX-DC',      qty: 1 },
        { sku: 'BOX-AC',      qty: 1 },
        { sku: 'EARTH-KIT',   qty: 1 },
        { sku: 'LA-01',       qty: 1 },
        { sku: 'SVC-INSTALL', qty: kw },
      ];
      if (type === 'OFF_GRID') {
        items.push({ sku: 'BAT-150', qty: kw });
      }

      await prisma.kit.create({
        data: {
          name: `${kw} kW ${type === 'ON_GRID' ? 'On-Grid' : 'Off-Grid'}`,
          kw,
          type,
          items: {
            create: items.map((i) => ({ productId: productId[i.sku], qty: i.qty })),
          },
        },
      });
    }
  }

  // ---------- 6. SERIAL-NUMBERED STOCK ----------
  // Each row = one physical unit sitting in the warehouse (status IN_STOCK by default).
  const serials = [];
  function addSerials(sku, prefix, count) {
    for (let i = 1; i <= count; i++) {
      serials.push({
        serialNo: `${prefix}-${String(i).padStart(4, '0')}`, // e.g. INV-3K-0007
        productId: productId[sku],
      });
    }
  }

  addSerials('PNL-540', 'PNL', 60);
  for (let kw = 1; kw <= 5; kw++) addSerials(`INV-${kw}K`, `INV-${kw}K`, 6);
  addSerials('BAT-150', 'BAT', 20);
  addSerials('CC-01', 'CC', 15);

  await prisma.serialUnit.createMany({ data: serials });

  // ---------- SUMMARY ----------
  console.log('✅ Done:', {
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    kits: await prisma.kit.count(),
    kitItems: await prisma.kitItem.count(),
    serialUnits: await prisma.serialUnit.count(),
    sizingRules: await prisma.sizingRule.count(),
    settings: await prisma.setting.count(),
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('❌ Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });