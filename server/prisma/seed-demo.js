// Demo history for TerraVolt: run AFTER the main seed.
//   npx prisma migrate reset   (main seed runs automatically)
//   node prisma/seed-demo.js
import 'dotenv/config';
import prisma from '../src/db.js';
import { estimateSystem } from '../src/services/sizing.js';

const DAY = 24 * 60 * 60 * 1000;
const GST = 12;
const at = (day, time = '11:00') => new Date(`${day}T${time}:00+05:30`); // Indian time
const money = (n) => Math.round(n * 100) / 100;
const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

let invoiceSeq = 0;
const nextInvoiceNumber = (date) => `INV-${date.getFullYear()}-${String(++invoiceSeq).padStart(4, '0')}`;

let users = {};

async function takeFreeUnits(productId, qty) {
  const units = await prisma.serialUnit.findMany({
    where: { productId, status: 'IN_STOCK', orderId: null },
    orderBy: { id: 'asc' },
    take: qty,
  });
  if (units.length < qty) throw new Error(`Not enough serial stock for product ${productId}`);
  return units;
}

// One complete customer journey: lead → survey → order → dispatch → install → invoices
async function installedOrder(c) {
  const confirmed = at(c.confirmed);
  const dispatched = at(c.installed, '08:00');
  const installed = at(c.installed, '16:00');
  const leadDate = new Date(confirmed.getTime() - 12 * DAY);
  const techs = c.techs.map((name) => users[name]);

  const customer = await prisma.customer.create({
    data: { name: c.name, phone: c.phone, address: c.address, city: c.city, pincode: c.pincode, createdAt: leadDate },
  });
  const kit = await prisma.kit.findUnique({
    where: { kw_type: { kw: c.kw, type: c.type } },
    include: { items: { include: { product: true } } },
  });

  const lead = await prisma.lead.create({
    data: {
      customerId: customer.id,
      source: c.source,
      status: 'WON',
      wantsSubsidy: Boolean(c.subsidy),
      monthlyBill: c.kw * 950,
      roofAreaSqft: c.kw * 110 + 40,
      gridReliability: c.type === 'ON_GRID' ? 'RELIABLE' : 'FREQUENT_CUTS',
      recommendedKw: c.kw,
      recommendedType: c.type,
      recommendedKitId: kit.id,
      assignedToId: users.sales.id,
      createdAt: leadDate,
    },
  });

  await prisma.survey.create({
    data: {
      leadId: lead.id,
      technicianId: techs[0].id,
      scheduledDate: new Date(leadDate.getTime() + 3 * DAY),
      status: 'APPROVED',
      roofDirection: 'S',
      tiltDeg: 15,
      cableDistanceM: 12,
      measuredRoofSqft: c.kw * 110 + 20,
      roofType: 'RCC flat',
      recommendedKw: c.kw,
      photos: [],
      notes: 'Clear south-facing roof',
      submittedAt: new Date(leadDate.getTime() + 3 * DAY),
      approvedById: users.sales.id,
      approvedAt: new Date(leadDate.getTime() + 4 * DAY),
      createdAt: new Date(leadDate.getTime() + 2 * DAY),
    },
  });

  const lines = kit.items.map((i) => ({
    productId: i.productId,
    description: i.product.name,
    qty: i.qty,
    unitPrice: Number(i.product.salePrice),
    unitCost: Number(i.product.costPrice),
    lineTotal: money(Number(i.product.salePrice) * i.qty),
  }));
  const subtotal = money(lines.reduce((s, l) => s + l.lineTotal, 0));
  const taxAmount = Math.round((subtotal * GST) / 100);
  const total = money(subtotal + taxAmount);
  const advance = Math.round(total * 0.3);

  const order = await prisma.salesOrder.create({
    data: {
      customerId: customer.id,
      leadId: lead.id,
      kitId: kit.id,
      status: c.finalPaid ? 'CLOSED' : 'INSTALLED',
      subtotal,
      taxAmount,
      total,
      installAddress: `${c.address}, ${c.city}, ${c.pincode}`,
      acceptedAt: new Date(confirmed.getTime() - DAY),
      acceptedByName: c.name,
      confirmedAt: confirmed,
      createdAt: new Date(confirmed.getTime() - 3 * DAY),
      lines: { create: lines },
    },
  });

  // Stock: serial units go on this roof with their warranty; loose parts are deducted
  const units = [];
  for (const item of kit.items) {
    const p = item.product;
    if (p.category === 'SERVICE') continue;
    if (p.isSerialized) {
      for (const u of await takeFreeUnits(p.id, item.qty)) {
        const warrantyEnd = addMonths(installed, p.warrantyMonths);
        await prisma.serialUnit.update({
          where: { id: u.id },
          data: { status: 'DELIVERED', orderId: order.id, customerId: customer.id, deliveredAt: dispatched, warrantyEnd },
        });
        units.push({ ...u, product: p, warrantyEnd });
      }
    } else {
      await prisma.product.update({ where: { id: p.id }, data: { stockQty: { decrement: item.qty } } });
    }
  }

  await prisma.delivery.create({
    data: { orderId: order.id, status: 'DISPATCHED', dispatchedAt: dispatched, dispatchedById: users.warehouse.id },
  });

  const job = await prisma.installJob.create({
    data: {
      orderId: order.id,
      scheduledDate: at(c.installed, '09:00'),
      status: 'COMPLETED',
      startedAt: at(c.installed, '09:30'),
      finishedAt: installed,
      installedKw: c.kw,
      powerTested: true,
      signedByName: c.name,
      photos: [],
      technicians: { connect: techs.map((t) => ({ id: t.id })) },
    },
  });
  for (const [i, t] of techs.entries()) {
    await prisma.timeLog.create({
      data: { technicianId: t.id, jobId: job.id, workDate: at(c.installed, '00:00'), hours: c.hours[i] },
    });
  }

  await prisma.invoice.create({
    data: {
      number: nextInvoiceNumber(confirmed),
      type: 'ADVANCE',
      status: 'PAID',
      customerId: customer.id,
      orderId: order.id,
      amount: advance,
      issueDate: confirmed,
      sentAt: confirmed,
      payments: { create: { amount: advance, method: 'UPI', reference: `UPI-${order.id}-ADV`, paidAt: confirmed } },
    },
  });

  const finalDate = new Date(installed.getTime() + DAY);
  const due = money(total - advance);
  await prisma.invoice.create({
    data: {
      number: nextInvoiceNumber(finalDate),
      type: 'FINAL',
      status: c.finalPaid ? 'PAID' : 'SENT',
      customerId: customer.id,
      orderId: order.id,
      amount: due,
      issueDate: finalDate,
      sentAt: finalDate,
      dueDate: new Date(finalDate.getTime() + 15 * DAY),
      ...(c.finalPaid
        ? { payments: { create: { amount: due, method: 'BANK_TRANSFER', reference: `NEFT-${order.id}`, paidAt: new Date(finalDate.getTime() + 5 * DAY) } } }
        : {}),
    },
  });

  if (c.subsidy) {
    await prisma.subsidy.create({
      data: {
        orderId: order.id,
        scheme: 'PM Surya Ghar',
        amount: c.subsidy.amount,
        stage: c.subsidy.stage,
        stageUpdatedAt: new Date(finalDate.getTime() + 10 * DAY),
      },
    });
  }

  return { customer, order, units };
}

async function main() {
  if (await prisma.customer.findUnique({ where: { phone: '9000000001' } })) {
    console.log('Demo data is already loaded. Run "npx prisma migrate reset" first to start clean.');
    return;
  }

  users = Object.fromEntries((await prisma.user.findMany()).map((u) => [u.email.split('@')[0], u]));
  for (const key of ['sales', 'warehouse', 'ravi', 'vikas', 'gurpreet', 'aman']) {
    if (!users[key]) throw new Error(`Missing seed user ${key}@terravolt.test`);
  }
  invoiceSeq = await prisma.invoice.count();

  // ---------- 1. Past installations (oldest first) ----------
  const jobs = {};
  const history = [
    { key: 'kuldeep', name: 'Kuldeep Raj', phone: '9000000006', address: '45 Model Town', city: 'Jalandhar', pincode: '144003',
      kw: 2, type: 'ON_GRID', source: 'WALK_IN', confirmed: '2023-08-01', installed: '2023-08-10', techs: ['aman'], hours: [6], finalPaid: true },
    { key: 'harpreet', name: 'Harpreet Kaur', phone: '9000000001', address: '12 Green Avenue', city: 'Jalandhar', pincode: '144001',
      kw: 3, type: 'ON_GRID', source: 'WEB', confirmed: '2026-08-05', installed: '2026-08-12', techs: ['ravi', 'vikas'], hours: [7, 7],
      finalPaid: true, subsidy: { stage: 'DISBURSED', amount: 78000 } },
    { key: 'rohit', name: 'Rohit Sharma', phone: '9000000002', address: '8 GT Road', city: 'Phagwara', pincode: '144401',
      kw: 2, type: 'ON_GRID', source: 'CALL', confirmed: '2026-08-20', installed: '2026-08-27', techs: ['gurpreet'], hours: [6], finalPaid: true },
    { key: 'anita', name: 'Anita Verma', phone: '9000000003', address: '3 Civil Lines', city: 'Kapurthala', pincode: '144601',
      kw: 4, type: 'OFF_GRID', source: 'WHATSAPP', confirmed: '2026-09-10', installed: '2026-09-18', techs: ['ravi', 'aman'], hours: [9, 9],
      finalPaid: true, subsidy: { stage: 'APPROVED', amount: 78000 } },
    { key: 'manjit', name: 'Manjit Singh', phone: '9000000004', address: '21 Urban Estate', city: 'Jalandhar', pincode: '144022',
      kw: 3, type: 'ON_GRID', source: 'WEB', confirmed: '2026-10-03', installed: '2026-10-10', techs: ['vikas'], hours: [7], finalPaid: true },
    { key: 'neha', name: 'Neha Bansal', phone: '9000000005', address: '67 Sarabha Nagar', city: 'Ludhiana', pincode: '141001',
      kw: 5, type: 'ON_GRID', source: 'WEB', confirmed: '2026-11-04', installed: '2026-11-12', techs: ['ravi', 'gurpreet'], hours: [8, 8],
      finalPaid: false, subsidy: { stage: 'SUBMITTED', amount: 78000 } },
  ];
  for (const c of history) jobs[c.key] = await installedOrder(c);

  // ---------- 2. Warranty repair: Rohit's inverter swapped free in October ----------
  const rohit = jobs.rohit;
  const oldInverter = rohit.units.find((u) => u.product.category === 'INVERTER');
  const [newInverter] = await takeFreeUnits(oldInverter.productId, 1);
  const fixDay = at('2026-10-15', '15:00');
  const warrantyTicket = await prisma.ticket.create({
    data: {
      serialUnitId: oldInverter.id,
      customerId: rohit.customer.id,
      assignedToId: users.gurpreet.id,
      fault: 'Inverter shows error E03, no output since morning',
      faultCode: 'E03',
      faultDate: at('2026-10-14'),
      underWarranty: true,
      warrantyReason: `Fault on 14 Oct 2026 is within the 24-month warranty (ends ${fmt(oldInverter.warrantyEnd)})`,
      status: 'CLOSED',
      customerConfirmedAt: fixDay,
      confirmedByName: 'Rohit Sharma',
      closedAt: fixDay,
      createdAt: at('2026-10-14'),
    },
  });
  await prisma.serialUnit.update({
    where: { id: newInverter.id },
    data: { status: 'DELIVERED', orderId: rohit.order.id, customerId: rohit.customer.id, deliveredAt: fixDay, warrantyEnd: oldInverter.warrantyEnd },
  });
  await prisma.serialUnit.update({ where: { id: oldInverter.id }, data: { status: 'REPLACED' } });
  await prisma.repairLine.createMany({
    data: [
      { ticketId: warrantyTicket.id, type: 'PART', productId: oldInverter.productId,
        description: `${oldInverter.product.name}: replaced ${oldInverter.serialNo} with ${newInverter.serialNo}`,
        qty: 1, cost: Number(oldInverter.product.costPrice), priceCharged: 0 },
      { ticketId: warrantyTicket.id, type: 'LABOUR', description: 'Diagnosis and inverter swap',
        qty: 2, cost: money(2 * Number(users.gurpreet.hourlyRate)), priceCharged: 0 },
    ],
  });
  await prisma.timeLog.create({
    data: { technicianId: users.gurpreet.id, ticketId: warrantyTicket.id, workDate: at('2026-10-15', '00:00'), hours: 2 },
  });

  // ---------- 3. Out-of-warranty fault: Kuldeep's 2023 inverter (left open for the live demo) ----------
  const kuldeepInverter = jobs.kuldeep.units.find((u) => u.product.category === 'INVERTER');
  await prisma.ticket.create({
    data: {
      serialUnitId: kuldeepInverter.id,
      customerId: jobs.kuldeep.customer.id,
      assignedToId: users.aman.id,
      fault: 'Inverter display blank and cooling fan very noisy',
      faultCode: 'FAN',
      faultDate: at('2026-11-18'),
      underWarranty: false,
      warrantyReason: `Warranty ended on ${fmt(kuldeepInverter.warrantyEnd)}; fault reported on 18 Nov 2026`,
      status: 'DIAGNOSED',
      createdAt: at('2026-11-18'),
    },
  });

  // ---------- 4. Open pipeline this month (estimates from the real sizing service) ----------
  const pipeline = [
    { name: 'Gagan Deep', phone: '9000000011', city: 'Jalandhar', status: 'NEW', bill: 2400, roof: 300, grid: 'RELIABLE', daysAgo: 1, source: 'WEB' },
    { name: 'Priya Malhotra', phone: '9000000012', city: 'Amritsar', status: 'NEW', bill: 4200, roof: 420, grid: 'RELIABLE', daysAgo: 2, source: 'WEB' },
    { name: 'Sukhwinder Gill', phone: '9000000013', city: 'Moga', status: 'CONTACTED', bill: 3600, roof: 380, grid: 'FREQUENT_CUTS', daysAgo: 4, source: 'CALL' },
    { name: 'Deepak Arora', phone: '9000000014', city: 'Jalandhar', status: 'QUALIFIED', bill: 3000, roof: 350, grid: 'RELIABLE', daysAgo: 6, source: 'WHATSAPP' },
    { name: 'Ritu Khanna', phone: '9000000015', city: 'Phagwara', status: 'SURVEY_REQUESTED', bill: 2700, roof: 330, grid: 'RELIABLE', daysAgo: 7, source: 'WEB', survey: true },
    { name: 'Baljit Sandhu', phone: '9000000016', city: 'Hoshiarpur', status: 'LOST', bill: 1800, roof: 200, grid: 'RELIABLE', daysAgo: 9, source: 'WALK_IN', lostReason: 'Went with a cheaper local installer' },
  ];
  for (const p of pipeline) {
    const created = new Date(Date.now() - p.daysAgo * DAY);
    const estimate = await estimateSystem({ monthlyBill: p.bill, roofAreaSqft: p.roof, gridReliability: p.grid });
    const customer = await prisma.customer.create({
      data: { name: p.name, phone: p.phone, address: `${10 + p.daysAgo} Main Bazaar`, city: p.city, pincode: '144001', createdAt: created },
    });
    const lead = await prisma.lead.create({
      data: {
        customerId: customer.id,
        source: p.source,
        status: p.status,
        wantsSubsidy: p.bill >= 3000,
        monthlyBill: p.bill,
        roofAreaSqft: p.roof,
        gridReliability: p.grid,
        recommendedKw: estimate.feasible ? estimate.kw : null,
        recommendedType: estimate.feasible ? estimate.systemType : null,
        recommendedKitId: estimate.feasible ? estimate.kit.id : null,
        assignedToId: users.sales.id,
        lostReason: p.lostReason ?? null,
        createdAt: created,
      },
    });
    if (p.survey && estimate.feasible) {
      await prisma.survey.create({
        data: {
          leadId: lead.id,
          technicianId: users.ravi.id,
          scheduledDate: new Date(Date.now() - 2 * DAY),
          status: 'SUBMITTED',
          roofDirection: 'S',
          tiltDeg: 12,
          cableDistanceM: 15,
          measuredRoofSqft: p.roof - 20,
          roofType: 'RCC flat',
          recommendedKw: estimate.kw,
          photos: [],
          notes: 'Water tank on north side, no shade on panels',
          submittedAt: new Date(Date.now() - 1 * DAY),
          createdAt: new Date(Date.now() - 5 * DAY),
        },
      });
    }
  }

  // ---------- 5. Technician pay already settled for Aug–Oct ----------
  const technicians = ['ravi', 'vikas', 'gurpreet', 'aman'].map((k) => users[k]);
  for (const month of [7, 8, 9]) {
    const start = new Date(2026, month, 1);
    const end = new Date(2026, month + 1, 1);
    for (const t of technicians) {
      const sum = await prisma.timeLog.aggregate({
        where: { technicianId: t.id, workDate: { gte: start, lt: end } },
        _sum: { hours: true },
      });
      const hours = Number(sum._sum.hours || 0);
      if (hours > 0) {
        await prisma.technicianPayout.create({
          data: { technicianId: t.id, periodStart: start, periodEnd: end, hours, amount: money(hours * Number(t.hourlyRate)), paidAt: new Date(2026, month + 1, 3) },
        });
      }
    }
  }

  console.log('✅ Demo history loaded:', {
    customers: await prisma.customer.count(),
    leads: await prisma.lead.count(),
    orders: await prisma.salesOrder.count(),
    invoices: await prisma.invoice.count(),
    tickets: await prisma.ticket.count(),
    payouts: await prisma.technicianPayout.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());