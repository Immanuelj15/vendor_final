import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Helper to format currency in INR with clean glyph-safe standard notation
function formatINR(val) {
  const num = Number(val) || 0;
  return 'Rs. ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const pdfInvoiceGenerator = {
  /**
   * Generates a professional A4 PDF buffer for an Invoice document.
   *
   * @param {Object} invoice
   * @returns {Promise<Buffer>}
   */
  async generateBuffer(invoice) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36, // 0.5 inch margins
        info: {
          Title: `Invoice - ${invoice.invoiceNumber}`,
          Author: invoice.brandingSnapshot?.brandName || 'BAAPOO MART',
          Subject: `Tax Invoice for Order #${invoice.orderNumber}`,
          Keywords: 'Invoice, BAAPOO MART, Tax Invoice, GST',
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const branding = invoice.brandingSnapshot || {};
      const seller = invoice.sellerSnapshot || {};
      const buyer = invoice.buyerSnapshot || {};
      const pricing = invoice.pricing || {};
      const primaryColor = branding.primaryColor || '#30358F';
      const secondaryColor = branding.secondaryColor || '#F7941D';

      // ─── HEADER SECTION (Zero Overlap Grid) ──────────────────────────────
      const headerTop = 36;
      const leftColX = 36;
      let corporateDetailsX = leftColX;
      let logoBottom = headerTop;

      // 1. Logo Handling (Aspect ratio preserved, bounded cleanly)
      const hasLogo = Boolean(branding.logoPath && fs.existsSync(branding.logoPath));
      if (hasLogo) {
        try {
          doc.image(branding.logoPath, leftColX, headerTop, { fit: [60, 58] });
          logoBottom = headerTop + 60;
          corporateDetailsX = leftColX + 68; // Place corporate details to the right of the logo
        } catch (e) {
          doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text(branding.brandName || 'BAAPOO MART', leftColX, headerTop);
          logoBottom = headerTop + 20;
        }
      } else {
        doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text(branding.brandName || 'BAAPOO MART', leftColX, headerTop);
        logoBottom = headerTop + 20;
      }

      // Corporate Branding Info
      let textCursorY = headerTop;
      doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold')
        .text(branding.brandName || 'BAAPOO MART', corporateDetailsX, textCursorY);
      textCursorY += 15;

      doc.fillColor(secondaryColor).fontSize(7.5).font('Helvetica-Bold')
        .text(branding.tagline || 'BUY INDIAN • BUILD INDIA', corporateDetailsX, textCursorY);
      textCursorY += 11;

      doc.fillColor('#475569').fontSize(7.5).font('Helvetica')
        .text(branding.legalName || 'BAAPOO MART Digital Commerce Pvt. Ltd.', corporateDetailsX, textCursorY, { width: 230 });
      textCursorY += 10;

      if (branding.registeredAddress) {
        doc.text(branding.registeredAddress, corporateDetailsX, textCursorY, { width: 230 });
        textCursorY += 18;
      }

      if (branding.gstin) {
        doc.text(`Platform GSTIN: ${branding.gstin}`, corporateDetailsX, textCursorY, { width: 230 });
        textCursorY += 10;
      }

      doc.text(`Support: ${branding.supportEmail || 'support@baapoomart.com'} | Web: ${branding.websiteUrl || 'baapoomart.com'}`, corporateDetailsX, textCursorY, { width: 230 });
      textCursorY += 12;

      // 2. Invoice Title & Metadata (Right Aligned Column)
      const rightColX = 340;
      const rightColWidth = 220;
      let rightCursorY = headerTop;

      const titleText = invoice.isCreditNote ? 'CREDIT NOTE' : (invoice.invoiceType?.replace(/_/g, ' ') || 'TAX INVOICE');
      doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold')
        .text(titleText, rightColX, rightCursorY, { align: 'right', width: rightColWidth });
      rightCursorY += 20;

      doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold')
        .text(`Invoice No: ${invoice.invoiceNumber}`, rightColX, rightCursorY, { align: 'right', width: rightColWidth });
      rightCursorY += 13;

      doc.font('Helvetica').fontSize(8).fillColor('#475569')
        .text(`Date: ${new Date(invoice.issueDate || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, rightColX, rightCursorY, { align: 'right', width: rightColWidth });
      rightCursorY += 12;

      doc.text(`Order No: #${invoice.orderNumber}`, rightColX, rightCursorY, { align: 'right', width: rightColWidth });
      rightCursorY += 12;

      if (invoice.subOrderNumber) {
        doc.text(`Sub-Order: #${invoice.subOrderNumber}`, rightColX, rightCursorY, { align: 'right', width: rightColWidth });
        rightCursorY += 12;
      }

      if (invoice.paymentSnapshot?.method) {
        doc.text(`Payment: ${invoice.paymentSnapshot.method} (${invoice.status})`, rightColX, rightCursorY, { align: 'right', width: rightColWidth });
        rightCursorY += 12;
      }

      // ─── DIVIDER (Guaranteed clearance below logo & text) ─────────────────
      const headerBottom = Math.max(logoBottom, textCursorY, rightCursorY) + 12;
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(36, headerBottom).lineTo(560, headerBottom).stroke();

      // ─── SELLER & BUYER DETAILS (2-Column Grid) ───────────────────────────
      const partySectionY = headerBottom + 12;
      const colWidth = 240;

      // Column 1: Seller / Sold By
      let sellerY = partySectionY;
      doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold').text('SOLD BY / SELLER DETAILS:', 36, sellerY);
      sellerY += 13;

      doc.fillColor('#0F172A').fontSize(9.5).font('Helvetica-Bold').text(seller.storeName || seller.legalBusinessName || branding.brandName, 36, sellerY);
      sellerY += 13;

      doc.fillColor('#475569').fontSize(8).font('Helvetica');
      let sellerAddrStr = '';
      if (seller.address) {
        sellerAddrStr = [seller.address.street, seller.address.city, seller.address.state, seller.address.zip].filter(Boolean).join(', ');
      }
      if (sellerAddrStr) {
        doc.text(sellerAddrStr, 36, sellerY, { width: colWidth });
        sellerY += 18;
      }

      if (seller.gstin) {
        doc.fillColor('#0F172A').font('Helvetica-Bold').text(`GSTIN: ${seller.gstin}`, 36, sellerY);
        sellerY += 11;
      } else {
        doc.fillColor('#64748B').font('Helvetica').text('GST: Unregistered / Composition', 36, sellerY);
        sellerY += 11;
      }

      if (seller.email) {
        doc.fillColor('#475569').font('Helvetica').text(`Email: ${seller.email}`, 36, sellerY);
        sellerY += 11;
      }

      // Column 2: Billed To / Shipping Address
      const buyerX = 310;
      let buyerY = partySectionY;
      doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold').text('BILLED / DELIVERED TO:', buyerX, buyerY);
      buyerY += 13;

      doc.fillColor('#0F172A').fontSize(9.5).font('Helvetica-Bold').text(buyer.name || 'Valued Customer', buyerX, buyerY);
      buyerY += 13;

      doc.fillColor('#475569').fontSize(8).font('Helvetica');
      const bAddr = buyer.shippingAddress || buyer.billingAddress || {};
      const buyerAddrStr = [bAddr.streetAddress || bAddr.street, bAddr.city, bAddr.state, bAddr.postalCode || bAddr.zip].filter(Boolean).join(', ');
      if (buyerAddrStr) {
        doc.text(buyerAddrStr, buyerX, buyerY, { width: colWidth });
        buyerY += 18;
      }

      if (buyer.phone) {
        doc.text(`Phone: ${buyer.phone}`, buyerX, buyerY);
        buyerY += 11;
      }

      if (buyer.email) {
        doc.text(`Email: ${buyer.email}`, buyerX, buyerY);
        buyerY += 11;
      }

      if (buyer.customerGstin) {
        doc.font('Helvetica-Bold').text(`Customer GSTIN: ${buyer.customerGstin}`, buyerX, buyerY);
        buyerY += 11;
      }

      // ─── ITEMS TABLE ──────────────────────────────────────────────────────
      const tableTop = Math.max(sellerY, buyerY) + 14;

      // Table Header Background
      doc.rect(36, tableTop, 524, 18).fill('#F1F5F9');

      // Table Column Definitions
      const col = {
        sNo: { x: 40, w: 20 },
        desc: { x: 62, w: 175 },
        hsn: { x: 240, w: 40 },
        qty: { x: 282, w: 25 },
        rate: { x: 310, w: 56 },
        taxable: { x: 368, w: 56 },
        tax: { x: 426, w: 48 },
        total: { x: 476, w: 80 },
      };

      doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold');
      doc.text('#', col.sNo.x, tableTop + 5);
      doc.text('Product Description', col.desc.x, tableTop + 5);
      doc.text('HSN', col.hsn.x, tableTop + 5);
      doc.text('Qty', col.qty.x, tableTop + 5, { align: 'center', width: col.qty.w });
      doc.text('Unit Price', col.rate.x, tableTop + 5, { align: 'right', width: col.rate.w });
      doc.text('Taxable', col.taxable.x, tableTop + 5, { align: 'right', width: col.taxable.w });
      doc.text('GST Rate', col.tax.x, tableTop + 5, { align: 'center', width: col.tax.w });
      doc.text('Total (INR)', col.total.x, tableTop + 5, { align: 'right', width: col.total.w });

      let currentY = tableTop + 22;

      // Render Rows
      (invoice.items || []).forEach((item, index) => {
        // Page break check
        if (currentY > 690) {
          doc.addPage();
          currentY = 40;
        }

        const isEven = index % 2 === 0;
        if (isEven) {
          doc.rect(36, currentY - 3, 524, 22).fill('#FAFAFA');
        }

        doc.fillColor('#0F172A').fontSize(8).font('Helvetica');
        doc.text(String(index + 1), col.sNo.x, currentY);

        // Product Name + SKU
        const prodName = item.name || 'Product';
        doc.font('Helvetica-Bold').text(prodName, col.desc.x, currentY, { width: col.desc.w, lineBreak: false });
        if (item.sku) {
          doc.font('Helvetica').fontSize(6.5).fillColor('#64748B').text(`SKU: ${item.sku}`, col.desc.x, currentY + 10, { width: col.desc.w });
        }

        doc.fontSize(7.5).fillColor('#0F172A').font('Helvetica');
        doc.text(item.hsnCode || '—', col.hsn.x, currentY);
        doc.text(String(item.quantity), col.qty.x, currentY, { align: 'center', width: col.qty.w });
        doc.text(formatINR(item.unitPrice), col.rate.x, currentY, { align: 'right', width: col.rate.w });
        doc.text(formatINR(item.taxableAmount), col.taxable.x, currentY, { align: 'right', width: col.taxable.w });

        // Tax rate display
        let taxDisplay = '0%';
        if (item.taxRate > 0) {
          if (item.isInterState) {
            taxDisplay = `${item.taxRate}% IGST`;
          } else {
            taxDisplay = `${item.cgstRate}%+${item.sgstRate}%`;
          }
        }
        doc.text(taxDisplay, col.tax.x, currentY, { align: 'center', width: col.tax.w });
        doc.font('Helvetica-Bold').text(formatINR(item.totalAmount), col.total.x, currentY, { align: 'right', width: col.total.w });

        currentY += 24;
      });

      // Bottom line of table
      doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(36, currentY).lineTo(560, currentY).stroke();
      currentY += 14;

      // ─── TOTALS & BREAKDOWN SECTION ───────────────────────────────────────
      const summaryBoxWidth = 230;
      const summaryBoxX = 560 - summaryBoxWidth;

      // Left Column: Notes & Policies
      const notesY = currentY;
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold').text('Terms & Conditions / Return Policy:', 36, notesY);
      doc.fillColor('#64748B').fontSize(7).font('Helvetica')
        .text('1. Returns/refunds are governed by the BAAPOO MART 7-day verified return policy.', 36, notesY + 12, { width: 270 })
        .text('2. Goods once sold can be returned only if damaged, defective, or incorrect.', 36, doc.y + 2, { width: 270 })
        .text('3. This is an authentic computer-generated invoice and requires no physical signature.', 36, doc.y + 2, { width: 270 });

      // Right Column: Financial Summary Table
      let sumY = notesY;
      const renderSummaryRow = (label, valStr, isBold = false, color = '#0F172A') => {
        doc.fillColor(color).fontSize(8).font(isBold ? 'Helvetica-Bold' : 'Helvetica');
        doc.text(label, summaryBoxX, sumY, { width: 130 });
        doc.text(valStr, summaryBoxX + 130, sumY, { align: 'right', width: 100 });
        sumY += 15;
      };

      renderSummaryRow('Gross Items Total:', formatINR(pricing.subtotal));

      if (pricing.couponDiscount > 0) {
        renderSummaryRow(`Coupon Discount (${pricing.couponCode || 'PROMO'}):`, `-${formatINR(pricing.couponDiscount)}`, false, '#059669');
      }

      if (pricing.fairCoinsDiscount > 0) {
        renderSummaryRow(`Fair Coins (${pricing.fairCoinsUsed || 0} Coins):`, `-${formatINR(pricing.fairCoinsDiscount)}`, false, '#D97706');
      }

      renderSummaryRow('Shipping Charges:', pricing.shippingFee > 0 ? formatINR(pricing.shippingFee) : 'FREE');
      renderSummaryRow('Net Taxable Value:', formatINR(pricing.taxableAmount));

      if (pricing.cgstTotal > 0) {
        renderSummaryRow('CGST Total:', formatINR(pricing.cgstTotal));
      }
      if (pricing.sgstTotal > 0) {
        renderSummaryRow('SGST Total:', formatINR(pricing.sgstTotal));
      }
      if (pricing.igstTotal > 0) {
        renderSummaryRow('IGST Total:', formatINR(pricing.igstTotal));
      }

      // Grand Total Highlight Bar
      sumY += 4;
      doc.rect(summaryBoxX - 4, sumY - 2, summaryBoxWidth + 4, 22).fill(primaryColor);
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
      doc.text('Grand Total:', summaryBoxX + 4, sumY + 5);
      doc.text(formatINR(pricing.grandTotal), summaryBoxX + 120, sumY + 5, { align: 'right', width: 100 });

      // Amount paid & balance
      sumY += 28;
      doc.fillColor('#0F172A').fontSize(8).font('Helvetica-Bold');
      doc.text(`Amount Paid: ${formatINR(pricing.amountPaid)}`, summaryBoxX, sumY, { align: 'right', width: summaryBoxWidth });

      // ─── FOOTER ───────────────────────────────────────────────────────────
      const footerY = 780;
      doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(36, footerY).lineTo(560, footerY).stroke();
      doc.fillColor('#94A3B8').fontSize(7).font('Helvetica')
        .text(
          `Thank you for shopping on BAAPOO MART • Empowering Indian Merchants & Consumers • Queries: support@baapoomart.com`,
          36,
          footerY + 6,
          { align: 'center', width: 524 }
        );

      doc.end();
    });
  },

  /**
   * Generates and writes invoice to local disk storage
   *
   * @param {Object} invoice
   * @returns {Promise<string>} relative file path
   */
  async saveToStorage(invoice) {
    const storageDir = path.resolve(process.cwd(), 'storage/invoices');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    // Sanitize filename: replace / with _
    const safeNum = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeNum}.pdf`;
    const fullPath = path.join(storageDir, filename);

    const buffer = await this.generateBuffer(invoice);
    fs.writeFileSync(fullPath, buffer);

    return `storage/invoices/${filename}`;
  },
};

export default pdfInvoiceGenerator;
