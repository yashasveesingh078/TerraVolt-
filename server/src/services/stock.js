// Stock rules for TerraVolt
//  - Serialised products (panels, inverters, batteries, charge controllers):
//    every physical unit is a SerialUnit row.
//      free     = status IN_STOCK and orderId null
//      reserved = status IN_STOCK and orderId set (held for a confirmed order)
//  - Loose parts (cable, boxes, mounting): counted with product.stockQty
//  - SERVICE items (installation labour) need no stock at all

export const needsStock = (product) => product.category !== 'SERVICE';

// Returns { productId: freeQuantity }, or null for products that need no stock
export async function availability(db, products) {
  const serialisedIds = products.filter((p) => p.isSerialized).map((p) => p.id);
  const grouped = serialisedIds.length
    ? await db.serialUnit.groupBy({
        by: ['productId'],
        where: { productId: { in: serialisedIds }, status: 'IN_STOCK', orderId: null },
        _count: { _all: true },
      })
    : [];
  const free = Object.fromEntries(grouped.map((g) => [g.productId, g._count._all]));

  return Object.fromEntries(
    products.map((p) => [p.id, !needsStock(p) ? null : p.isSerialized ? free[p.id] || 0 : p.stockQty]),
  );
}

function stockError(line) {
  const err = new Error(`Not enough stock for ${line.description}`);
  err.status = 400;
  return err;
}

// Reserve stock for every line of an order. Must run inside a transaction (tx).
export async function reserveForOrder(tx, orderId, lines) {
  for (const line of lines) {
    const { product } = line;
    if (!needsStock(product)) continue;

    if (product.isSerialized) {
      // Hold specific units for this order (oldest first)
      const units = await tx.serialUnit.findMany({
        where: { productId: product.id, status: 'IN_STOCK', orderId: null },
        orderBy: { id: 'asc' },
        take: line.qty,
        select: { id: true },
      });
      if (units.length !== line.qty) throw stockError(line);
      // "orderId: null" again: if someone else grabbed one in between, the count won't match
      const updated = await tx.serialUnit.updateMany({
        where: { id: { in: units.map((u) => u.id) }, orderId: null },
        data: { orderId },
      });
      if (updated.count !== line.qty) throw stockError(line);
    } else {
      const updated = await tx.product.updateMany({
        where: { id: product.id, stockQty: { gte: line.qty } },
        data: { stockQty: { decrement: line.qty } },
      });
      if (updated.count === 0) throw stockError(line);
    }
  }
}