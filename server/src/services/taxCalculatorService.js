/**
 * Tax & Monetary Calculation Service for BAAPOO MART Invoicing
 *
 * Implements:
 *  - Intra-state (CGST + SGST) vs Inter-state (IGST) determination
 *  - GST registered vs non-registered seller tax treatment
 *  - Tax-inclusive product price breakdown
 *  - Fair Coins discount allocation
 *  - Coupon discount allocation
 *  - Decimal-safe monetary arithmetic (rounded to 2 decimal places)
 */

function roundToTwo(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

function cleanStateName(state) {
  if (!state || typeof state !== 'string') return '';
  return state.trim().toLowerCase().replace(/[^a-z]/g, '');
}

export const taxCalculatorService = {
  round: roundToTwo,

  /**
   * Determine whether a transaction is Inter-State (IGST) or Intra-State (CGST+SGST)
   */
  isInterState(sellerState, buyerState) {
    const sState = cleanStateName(sellerState);
    const bState = cleanStateName(buyerState);
    if (!sState || !bState) return false; // Default to intra-state if missing
    return sState !== bState;
  },

  /**
   * Calculate line item tax and totals
   *
   * @param {Object} item
   *   - unitPrice (Number, selling price inclusive of tax)
   *   - quantity (Number)
   *   - mrp (Number, optional)
   *   - taxRate (Number, e.g. 5, 12, 18)
   *   - allocatedDiscount (Number, portion of coupon + fair coin discount allocated to this item)
   * @param {Boolean} isSellerGstRegistered
   * @param {Boolean} isInterState
   */
  calculateLineItem(item, isSellerGstRegistered, isInterState) {
    const qty = Number(item.quantity) || 1;
    const unitPrice = roundToTwo(item.unitPrice || item.price || 0);
    const rawLineTotal = roundToTwo(unitPrice * qty);
    const discount = roundToTwo(item.allocatedDiscount || item.discount || 0);
    const netLineTotal = Math.max(0, roundToTwo(rawLineTotal - discount));

    const taxRate = isSellerGstRegistered ? Number(item.taxRate || 0) : 0;

    let taxableAmount = netLineTotal;
    let taxAmount = 0;

    if (taxRate > 0) {
      // Net price is tax-inclusive: Taxable = Net / (1 + Rate/100)
      taxableAmount = roundToTwo(netLineTotal / (1 + taxRate / 100));
      taxAmount = roundToTwo(netLineTotal - taxableAmount);
    }

    let cgstRate = 0, cgstAmount = 0;
    let sgstRate = 0, sgstAmount = 0;
    let igstRate = 0, igstAmount = 0;

    if (taxAmount > 0) {
      if (isInterState) {
        igstRate = taxRate;
        igstAmount = taxAmount;
      } else {
        cgstRate = roundToTwo(taxRate / 2);
        cgstAmount = roundToTwo(taxAmount / 2);
        sgstRate = cgstRate;
        sgstAmount = roundToTwo(taxAmount - cgstAmount); // Balance rounding check
      }
    }

    return {
      sNo: item.sNo || 1,
      productId: item.productId,
      sku: item.sku || item.skuSnapshot || '',
      name: item.name || item.productNameSnapshot || 'Product',
      hsnCode: item.hsnCode || item.hsn || '',
      quantity: qty,
      mrp: roundToTwo(item.mrp || unitPrice),
      unitPrice,
      discount,
      taxableAmount,
      taxRate,
      isInterState,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      totalAmount: netLineTotal,
    };
  },

  /**
   * Distribute order-level discounts (Coupon + Fair Coins) proportionally across items
   */
  allocateDiscounts(items, totalDiscount) {
    if (!totalDiscount || totalDiscount <= 0 || items.length === 0) {
      return items.map((i) => ({ ...i, allocatedDiscount: 0 }));
    }

    const totalGross = items.reduce((sum, i) => sum + (Number(i.unitPrice || i.price) * (Number(i.quantity) || 1)), 0);
    if (totalGross <= 0) {
      return items.map((i) => ({ ...i, allocatedDiscount: 0 }));
    }

    let remainingDiscount = totalDiscount;
    return items.map((i, idx) => {
      const gross = (Number(i.unitPrice || i.price) * (Number(i.quantity) || 1));
      let share;
      if (idx === items.length - 1) {
        share = remainingDiscount; // Allocate remainder to last item
      } else {
        share = roundToTwo((gross / totalGross) * totalDiscount);
        remainingDiscount = roundToTwo(remainingDiscount - share);
      }
      return {
        ...i,
        allocatedDiscount: Math.min(gross, share),
      };
    });
  },
};

export default taxCalculatorService;

