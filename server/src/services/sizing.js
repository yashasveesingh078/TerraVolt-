import prisma from '../db.js';

// Read all settings as a simple object: { price_per_unit: '8', gst_percent: '12', ... }
export async function getSettings() {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

// The sizing rule: bill + roof + grid → recommended kit, price and savings.
// Used by the public enquiry page now, and by sales later.
export async function estimateSystem({ monthlyBill, roofAreaSqft, gridReliability }) {
  const settings = await getSettings();
  const pricePerUnit = Number(settings.price_per_unit);
  const unitsPerKwMonth = Number(settings.units_per_kw_month);
  const gstPercent = Number(settings.gst_percent);

  const rules = await prisma.sizingRule.findMany({ orderBy: { kw: 'asc' } });

  // 1. Units used per month
  const monthlyUnits = Math.round(monthlyBill / pricePerUnit);

  // 2. kW needed by usage (the rule whose unit range contains monthlyUnits)
  const ruleByUnits = rules.find(
    (r) => monthlyUnits >= r.unitsFrom && (r.unitsTo === null || monthlyUnits <= r.unitsTo)
  );
  const kwByUnits = ruleByUnits ? ruleByUnits.kw : rules[rules.length - 1].kw;

  // 3. kW the roof can hold (largest rule whose minimum roof area fits)
  const rulesThatFit = rules.filter((r) => roofAreaSqft >= r.minRoofSqft);
  if (rulesThatFit.length === 0) {
    return {
      feasible: false,
      monthlyUnits,
      reason: `Your roof looks too small. Even a 1 kW system needs about ${rules[0].minRoofSqft} sq ft of shadow-free roof.`,
    };
  }
  const kwByRoof = rulesThatFit[rulesThatFit.length - 1].kw;

  // 4. Final size: the smaller of the two, never above 5 kW
  const kw = Math.min(kwByUnits, kwByRoof, 5);

  // 5. Type: reliable grid → On-Grid, otherwise Off-Grid (with batteries)
  const systemType = gridReliability === 'RELIABLE' ? 'ON_GRID' : 'OFF_GRID';

  // 6. Find the matching kit with its products
  const kit = await prisma.kit.findUnique({
    where: { kw_type: { kw, type: systemType } },
    include: { items: { include: { product: true } } },
  });
  if (!kit) {
    throw new Error(`No kit is set up for ${kw} kW ${systemType}`);
  }

  // 7. Price = sum of (sale price × qty) + GST
  const subtotal = kit.items.reduce(
    (sum, item) => sum + Number(item.product.salePrice) * item.qty,
    0
  );
  const gst = Math.round((subtotal * gstPercent) / 100);
  const total = subtotal + gst;

  // 8. Savings: you can't save more than you currently use
  const monthlyGeneration = kw * unitsPerKwMonth;
  const monthlySaving = Math.round(Math.min(monthlyGeneration, monthlyUnits) * pricePerUnit);

  // 9. Payback in years (one decimal place)
  const paybackYears = monthlySaving > 0 ? Number((total / (monthlySaving * 12)).toFixed(1)) : null;

  return {
    feasible: true,
    monthlyUnits,
    kwByUnits,
    kwByRoof,
    kw,
    limitedByRoof: kwByRoof < kwByUnits,
    systemType,
    kit: {
      id: kit.id,
      name: kit.name,
      // Show the customer the main serial-tracked parts (panels, inverter, battery, controller)
      highlights: kit.items
        .filter((item) => item.product.isSerialized)
        .map((item) => ({ name: item.product.name, qty: item.qty })),
    },
    price: { subtotal, gstPercent, gst, total },
    savings: { monthlyGeneration, monthlySaving, paybackYears },
  };
}
