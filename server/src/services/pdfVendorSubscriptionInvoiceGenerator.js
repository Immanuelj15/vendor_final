import PDFDocument from 'pdfkit';
import fs from 'fs';

// Helper to format currency in INR cleanly with standard glyph-safe notation
function formatINR(val) {
  const num = Number(val) || 0;
  return 'Rs. ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const pdfVendorSubscriptionInvoiceGenerator = {
  /**
   * Generates a professional A4 PDF buffer for a VendorSubscriptionInvoice document.
   *
   * @param {Object} invoice - VendorSubscriptionInvoice record
   * @returns {Promise<Buffer>}
   */
  async generateBuffer(invoice) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36, // 0.5 inch margins
        info: {
          Title: `Vendor Subscription Invoice - ${invoice.invoiceNumber}`,
          Author: invoice.sellerSnapshot?.brandName || 'BAAPOO MART',
          Subject: `Subscription Invoice for ${invoice.vendorSnapshot?.storeName || 'Merchant'}`,
          Keywords: 'Vendor Subscription, Invoice, BAAPOO MART, B2B SaaS, GST',
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const seller = invoice.sellerSnapshot || {};
      const vendor = invoice.vendorSnapshot || {};
      const subDates = invoice.subscriptionDates || {};
      const plan = invoice.planSnapshot || {};
      const pricing = invoice.pricing || {};
      const primaryColor = seller.primaryColor || '#30358F';
      const secondaryColor = seller.secondaryColor || '#F7941D';

      // ─── 1. HEADER SECTION (Zero Overlap Grid) ──────────────────────────────
      const headerTop = 36;
      const leftColX = 36;
      let corporateDetailsX = leftColX;

      // Logo handling with fixed bounding box fit
      const hasLogo = Boolean(seller.logoPath && fs.existsSync(seller.logoPath));
      if (hasLogo) {
        try {
          doc.image(seller.logoPath, leftColX, headerTop, { fit: [60, 58] });
          corporateDetailsX = leftColX + 68; // Place text neatly beside logo
        } catch {
          doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text(seller.brandName || 'BAAPOO MART', leftColX, headerTop);
        }
      } else {
        doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text(seller.brandName || 'BAAPOO MART', leftColX, headerTop);
      }

      // Corporate Identity Details
      let textCursorY = headerTop;
      doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold')
        .text(seller.brandName || 'BAAPOO MART', corporateDetailsX, textCursorY);
      textCursorY += 15;

      doc.fillColor(secondaryColor).fontSize(7.5).font('Helvetica-Bold')
        .text(seller.tagline || 'BUY INDIAN • BUILD INDIA', corporateDetailsX, textCursorY);
      textCursorY += 11;

      doc.fillColor('#475569').fontSize(7.5).font('Helvetica')
        .text(seller.legalName || 'BAAPOO MART Digital Commerce Pvt. Ltd.', corporateDetailsX, textCursorY, { width: 230 });
      textCursorY += 10;

      if (seller.registeredAddress) {
        doc.text(seller.registeredAddress, corporateDetailsX, textCursorY, { width: 230 });
        textCursorY += 18;
      }

      if (seller.gstin) {
        doc.text(`Platform GSTIN: ${seller.gstin}`, corporateDetailsX, textCursorY, { width: 230 });
        textCursorY += 10;
      }

      doc.text(`Support: ${seller.supportEmail || 'support@baapoomart.com'} | Web: ${seller.websiteUrl || 'baapoomart.com'}`, corporateDetailsX, textCursorY, { width: 230 });
      textCursorY += 12;

      // ─── 2. INVOICE TITLE & METADATA (Right Column) ─────────────────────────
      const rightColX = 340;
      const rightColWidth = 220;
      let rightCursorY = headerTop;

      doc.fillColor(primaryColor).fontSize(15).font('Helvetica-Bold')
        .text('VENDOR SUBSCRIPTION INVOICE', rightColX, rightCursorY, { align: 'right', width: rightColWidth });
      rightCursorY += 20;

      doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold')
        .text(`Invoice No: ${invoice.invoiceNumber}`, rightColX, rightCursorY, { align: 'right', width: rightColWidth });
      rightCursorY += 13;

      const invoiceDateStr = new Date(invoice.issueDate || Date.now()).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      doc.font('Helvetica').fontSize(8).fillColor('#475569')
        .text(`Invoice Date: ${invoiceDateStr}`, rightColX, rightCursorY, { align: 'right', width: rightColWidth });
      rightCursorY += 12;

      if (invoice.transactionId) {
        doc.text(`Transaction ID: ${invoice.transactionId}`, rightColX, rightCursorY, { align: 'right', width: rightColWidth });
        rightCursorY += 12;
      }

      doc.text(`Payment Method: ${invoice.paymentMethod || 'RAZORPAY'} (${invoice.status || 'PAID'})`, rightColX, rightCursorY, { align: 'right', width: rightColWidth });
      rightCursorY += 12;

      if (seller.sacCode) {
        doc.text(`Service SAC Code: ${seller.sacCode}`, rightColX, rightCursorY, { align: 'right', width: rightColWidth });
        rightCursorY += 12;
      }

      // ─── 3. HORIZONTAL DIVIDER ──────────────────────────────────────────────
      const sectionDividerY = Math.max(textCursorY, rightCursorY, 115) + 6;
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(36, sectionDividerY).lineTo(559, sectionDividerY).stroke();

      // ─── 4. ENTITY INFORMATION BOXES (Two Columns) ──────────────────────────
      const infoBoxY = sectionDividerY + 8;
      const colWidth = 250;

      // Left Column: Issued By (Platform / Service Provider)
      doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold')
        .text('ISSUED BY / SERVICE PROVIDER:', 36, infoBoxY);

      let issuerY = infoBoxY + 12;
      doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold')
        .text(seller.legalName || seller.brandName || 'BAAPOO MART', 36, issuerY);
      issuerY += 12;

      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      if (seller.registeredAddress) {
        doc.text(seller.registeredAddress, 36, issuerY, { width: colWidth });
        issuerY += 22;
      }
      doc.text(`GSTIN: ${seller.gstin || 'Unregistered / Not Configured'}`, 36, issuerY);
      issuerY += 11;
      if (seller.pan) {
        doc.text(`PAN: ${seller.pan}`, 36, issuerY);
        issuerY += 11;
      }
      doc.text(`Email: ${seller.supportEmail || 'support@baapoomart.com'}`, 36, issuerY);
      issuerY += 11;
      doc.text(`Phone: ${seller.supportPhone || '+91 80 4567 8900'}`, 36, issuerY);

      // Right Column: Subscribed Vendor Details
      const vendorColX = 310;
      doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold')
        .text('SUBSCRIBED VENDOR DETAILS:', vendorColX, infoBoxY);

      let vendorY = infoBoxY + 12;
      doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold')
        .text(vendor.storeName || 'Merchant Store', vendorColX, vendorY);
      vendorY += 12;

      doc.font('Helvetica').fontSize(8).fillColor('#475569');
      if (vendor.ownerName) {
        doc.text(`Proprietor / Contact: ${vendor.ownerName}`, vendorColX, vendorY, { width: colWidth });
        vendorY += 11;
      }
      doc.text(`Vendor ID: ${vendor.vendorId || 'N/A'}`, vendorColX, vendorY);
      vendorY += 11;
      if (vendor.businessAddress) {
        doc.text(`Address: ${vendor.businessAddress}`, vendorColX, vendorY, { width: colWidth });
        vendorY += 22;
      }
      doc.text(`GSTIN: ${vendor.gstin || 'Unregistered / Composition Scheme'}`, vendorColX, vendorY);
      vendorY += 11;
      doc.text(`Email: ${vendor.email || 'N/A'}`, vendorColX, vendorY);
      vendorY += 11;
      doc.text(`Phone: ${vendor.phone || 'N/A'}`, vendorColX, vendorY);

      // ─── 5. SUBSCRIPTION PLAN DETAILS PANEL ─────────────────────────────────
      const planPanelY = Math.max(issuerY, vendorY, infoBoxY + 75) + 12;
      const planPanelHeight = 48;

      // Draw light background card for Subscription Highlights
      doc.rect(36, planPanelY, 523, planPanelHeight).fillAndStroke('#F8FAFC', '#E2E8F0');

      const cardColWidth = 523 / 4;
      const cardRow1Y = planPanelY + 8;
      const cardRow2Y = planPanelY + 22;

      // Column 1: Plan Name & Type
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748B')
        .text('SUBSCRIPTION PLAN', 46, cardRow1Y);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor)
        .text(plan.name || 'Vendor Plan', 46, cardRow2Y, { width: cardColWidth - 10 });

      // Column 2: Plan Duration / Billing
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748B')
        .text('DURATION / CYCLE', 46 + cardColWidth, cardRow1Y);
      const planDurationStr = `${subDates.durationValue || 1} ${subDates.durationUnit || 'Months'} (${subDates.planType || plan.planType || 'Standard'})`;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0F172A')
        .text(planDurationStr, 46 + cardColWidth, cardRow2Y, { width: cardColWidth - 10 });

      // Column 3: Validity Period
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748B')
        .text('VALIDITY PERIOD', 46 + cardColWidth * 2, cardRow1Y);
      const startStr = new Date(subDates.startDate || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const expiryStr = new Date(subDates.expiryDate || subDates.endDate || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      doc.font('Helvetica').fontSize(8).fillColor('#0F172A')
        .text(`${startStr} to ${expiryStr}`, 46 + cardColWidth * 2, cardRow2Y, { width: cardColWidth - 5 });

      // Column 4: Status
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748B')
        .text('SUBSCRIPTION STATUS', 46 + cardColWidth * 3, cardRow1Y);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#059669')
        .text(`${(subDates.subscriptionStatus || 'Active').toUpperCase()} • PAID`, 46 + cardColWidth * 3, cardRow2Y);

      // ─── 6. ITEMISED PRICING TABLE ──────────────────────────────────────────
      const tableTopY = planPanelY + planPanelHeight + 12;
      const headers = [
        { label: '#', x: 42, width: 18, align: 'left' },
        { label: 'Service Description', x: 62, width: 165, align: 'left' },
        { label: 'SAC', x: 230, width: 45, align: 'center' },
        { label: 'Plan Price', x: 278, width: 52, align: 'right' },
        { label: 'Discount', x: 333, width: 45, align: 'right' },
        { label: 'Subscription Amt', x: 381, width: 72, align: 'right' },
        { label: 'GST (18%)', x: 456, width: 45, align: 'center' },
        { label: 'Total Amount', x: 504, width: 51, align: 'right' },
      ];

      // Table Header Row
      doc.rect(36, tableTopY, 523, 20).fill(primaryColor);
      doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
      headers.forEach((h) => {
        doc.text(h.label, h.x, tableTopY + 5.5, { width: h.width, align: h.align });
      });

      // Table Data Row
      const rowY = tableTopY + 22;
      const rowHeight = 36;
      doc.rect(36, rowY, 523, rowHeight).fillAndStroke('#FFFFFF', '#E2E8F0');

      doc.fillColor('#0F172A').fontSize(7.5).font('Helvetica-Bold');
      doc.text('1', headers[0].x, rowY + 6, { width: headers[0].width, align: 'left' });

      // Service Description text
      const descTitle = `Vendor Subscription - ${plan.name || 'Merchant Plan'}`;
      doc.text(descTitle, headers[1].x, rowY + 6, { width: headers[1].width, align: 'left' });
      doc.font('Helvetica').fontSize(6.5).fillColor('#64748B')
        .text(`Duration: ${planDurationStr} | Valid to: ${expiryStr}`, headers[1].x, rowY + 18, { width: headers[1].width, align: 'left' });

      // SAC Code
      doc.font('Helvetica').fontSize(7.5).fillColor('#334155')
        .text(seller.sacCode || '998315', headers[2].x, rowY + 8, { width: headers[2].width, align: 'center' });

      // Plan Price
      doc.text(formatINR(pricing.planPrice || 0).replace('Rs. ', ''), headers[3].x, rowY + 8, { width: headers[3].width, align: 'right' });

      // Discount
      const discVal = Number(pricing.discount || 0);
      doc.text(discVal > 0 ? `-${formatINR(discVal).replace('Rs. ', '')}` : '-', headers[4].x, rowY + 8, { width: headers[4].width, align: 'right' });

      // Subscription Amount (Taxable)
      doc.text(formatINR(pricing.taxableAmount || 0).replace('Rs. ', ''), headers[5].x, rowY + 8, { width: headers[5].width, align: 'right' });

      // GST Rate
      doc.text(`${pricing.taxRate || 18}%`, headers[6].x, rowY + 8, { width: headers[6].width, align: 'center' });

      // Total
      doc.font('Helvetica-Bold').fillColor('#0F172A')
        .text(formatINR(pricing.finalAmount || 0).replace('Rs. ', ''), headers[7].x, rowY + 8, { width: headers[7].width, align: 'right' });

      // ─── 7. SUMMARY & PRICE BREAKDOWN ───────────────────────────────────────
      const summaryStartY = rowY + rowHeight + 10;

      // Left Box: Terms & Conditions
      const termsWidth = 260;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryColor)
        .text('Subscription Terms & Platform Information:', 36, summaryStartY);

      const terms = [
        '1. Vendor subscription fee is non-refundable once activated.',
        '2. Subscription automatically unlocks merchant dashboard features & catalog listing.',
        '3. Services are governed by BAAPOO MART Vendor Service Level Agreement.',
        '4. This is an authenticated computer-generated invoice and requires no physical seal.',
      ];

      let termY = summaryStartY + 12;
      doc.font('Helvetica').fontSize(6.5).fillColor('#64748B');
      terms.forEach((t) => {
        doc.text(t, 36, termY, { width: termsWidth });
        termY += 10;
      });

      // Right Box: Price Breakdown Grid
      const rightSummaryX = 330;
      const labelW = 125;
      const valW = 100;
      let sY = summaryStartY;

      const addSummaryRow = (label, valStr, isBold = false, customColor = '#475569') => {
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).fillColor(customColor)
          .text(label, rightSummaryX, sY, { width: labelW, align: 'right' })
          .text(valStr, rightSummaryX + labelW + 4, sY, { width: valW, align: 'right' });
        sY += 11;
      };

      if (Number(pricing.discount) > 0) {
        addSummaryRow('Plan Price:', formatINR(pricing.planPrice));
        addSummaryRow('Plan Discount:', `-${formatINR(pricing.discount)}`, false, '#059669');
      }

      addSummaryRow('Subscription Amount:', formatINR(pricing.taxableAmount), true, '#0F172A');

      if (pricing.isInterState && pricing.igstAmount > 0) {
        addSummaryRow(`GST (18% IGST):`, formatINR(pricing.igstAmount));
      } else if (!pricing.isInterState && (pricing.cgstAmount > 0 || pricing.sgstAmount > 0)) {
        addSummaryRow(`CGST (9%):`, formatINR(pricing.cgstAmount));
        addSummaryRow(`SGST (9%):`, formatINR(pricing.sgstAmount));
        addSummaryRow(`GST (18% Total):`, formatINR(pricing.totalTax));
      } else {
        addSummaryRow(`GST (18%):`, formatINR(pricing.totalTax));
      }

      // Grand Total Highlight Bar
      sY += 3;
      doc.rect(rightSummaryX, sY, labelW + valW + 6, 20).fill(primaryColor);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF')
        .text('Total Amount:', rightSummaryX + 8, sY + 5.5, { width: labelW })
        .text(formatINR(pricing.finalAmount), rightSummaryX + labelW + 4, sY + 5.5, { width: valW - 2, align: 'right' });
      sY += 24;

      addSummaryRow('Total Amount Paid:', formatINR(pricing.amountPaid || pricing.finalAmount), true, '#059669');
      addSummaryRow('Balance Due:', formatINR(pricing.balanceDue || 0), false, '#64748B');

      // ─── 8. FOOTER SECTION ──────────────────────────────────────────────────
      const footerY = 770;
      doc.strokeColor('#E2E8F0').lineWidth(0.75).moveTo(36, footerY).lineTo(559, footerY).stroke();

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryColor)
        .text('Thank you for partnering with BAAPOO MART! Together we Buy Indian • Build India.', 36, footerY + 6, {
          align: 'center',
          width: 523,
        });

      doc.font('Helvetica').fontSize(6.5).fillColor('#94A3B8')
        .text(
          `Registered Office: ${seller.registeredAddress || 'Bengaluru, India'} | Support: ${seller.supportEmail || 'support@baapoomart.com'} | URL: ${seller.websiteUrl || 'baapoomart.com'}`,
          36,
          footerY + 18,
          { align: 'center', width: 523 }
        );

      doc.end();
    });
  },
};

export default pdfVendorSubscriptionInvoiceGenerator;

