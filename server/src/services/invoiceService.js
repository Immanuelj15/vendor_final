import fs from 'fs';
import path from 'path';
import { Invoice } from '../models/Invoice.js';
import { InvoiceSequence } from '../models/InvoiceSequence.js';
import { Order } from '../models/Order.js';
import { VendorOrder } from '../models/VendorOrder.js';
import { Vendor } from '../models/Vendor.js';
import { VendorBusiness } from '../models/VendorBusiness.js';
import { Payment } from '../models/Payment.js';
import { Shipment } from '../models/Shipment.js';
import { User } from '../models/User.js';
import { brandingService } from './brandingService.js';
import { taxCalculatorService } from './taxCalculatorService.js';
import { pdfInvoiceGenerator } from './pdfInvoiceGenerator.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';

export const invoiceService = {
  /**
   * Generates invoices for an order.
   * If the order has multiple vendor suborders, it generates a tax invoice for each vendor suborder
   * plus a master consolidated invoice if needed.
   * Idempotent: returns existing invoices if already created.
   *
   * @param {string} orderId
   * @returns {Promise<Array<Invoice>>}
   */
  async generateInvoicesForOrder(orderId) {
    const order = await Order.findById(orderId).populate('userId', 'name email phone');
    if (!order) {
      throw new ApiError(404, 'Order not found', ERROR_CODES.NOT_FOUND);
    }

    // Check if invoices have already been generated for this order
    const existingInvoices = await Invoice.find({ orderId: order._id }).sort({ createdAt: 1 });
    if (existingInvoices.length > 0) {
      return existingInvoices;
    }

    // Resolve Branding Snapshot
    const brandingSnapshot = await brandingService.getBrandingSnapshot();

    // Resolve Customer & Payment Details
    const customer = order.userId || {};
    const buyerAddress = order.deliveryAddressSnapshot || order.shippingAddress || {};
    const buyerSnapshot = {
      customerId: order.userId?._id || order.userId,
      name: buyerAddress.fullName || buyerAddress.name || customer.name || 'Valued Customer',
      email: customer.email || '',
      phone: buyerAddress.phone || customer.phone || '',
      customerGstin: buyerAddress.gstin || '',
      billingAddress: order.billingAddress || buyerAddress,
      shippingAddress: buyerAddress,
    };

    const latestPayment = await Payment.findOne({ orderId: order._id }).sort({ createdAt: -1 });
    const paymentSnapshot = {
      method: order.paymentMethod || 'ONLINE',
      transactionId: latestPayment?.razorpayPaymentId || latestPayment?.paymentId || '',
      status: order.paymentStatus || 'PAID',
      paidAt: order.paidAt || latestPayment?.createdAt || new Date(),
    };

    // Find all suborders (multi-vendor)
    const suborders = await VendorOrder.find({ parentOrderId: order._id });
    const createdInvoices = [];

    if (suborders.length > 0) {
      // ── MULTI-VENDOR: Generate Vendor-Specific Tax Invoices ────────────────
      for (let i = 0; i < suborders.length; i++) {
        const suborder = suborders[i];

        // Fetch vendor & GST registration details
        const vendor = await Vendor.findById(suborder.vendorId);
        const vendorBusiness = await VendorBusiness.findOne({ vendorId: suborder.vendorId });

        const isGstRegistered = vendorBusiness?.gstStatus === 'VERIFIED' && !!vendorBusiness.gstNumber;
        const sellerState = vendor?.address?.state || brandingSnapshot.registeredAddress || '';
        const buyerState = buyerAddress.state || '';
        const isInterState = taxCalculatorService.isInterState(sellerState, buyerState);

        // Calculate line items with tax breakdown
        const rawItems = (suborder.items || []).map((item, idx) => ({
          sNo: idx + 1,
          productId: item.productId,
          sku: item.skuSnapshot || item.variantSku || '',
          name: item.productNameSnapshot || item.name || 'Product',
          hsnCode: item.hsnCode || '',
          quantity: Number(item.quantity) || 1,
          mrp: item.mrp || item.unitPrice || item.price,
          unitPrice: item.unitPrice || item.price,
          taxRate: item.taxRate || 5, // Default 5% GST if not configured
        }));

        // Allocate vendor portion of discounts
        const vendorCouponDiscount = suborder.discountTotal || 0;
        // Fair coins discount allocated proportionally to vendor share
        const suborderRatio = order.subtotal > 0 ? (suborder.subtotal / order.subtotal) : 1;
        const vendorCoinDiscount = taxCalculatorService.round((order.coinDiscount || 0) * suborderRatio);
        const totalVendorDiscount = taxCalculatorService.round(vendorCouponDiscount + vendorCoinDiscount);

        const discountedItems = taxCalculatorService.allocateDiscounts(rawItems, totalVendorDiscount);

        const calculatedItems = discountedItems.map((item) =>
          taxCalculatorService.calculateLineItem(item, isGstRegistered, isInterState)
        );

        // Compute invoice level pricing totals
        const subtotal = calculatedItems.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);
        const taxableAmount = calculatedItems.reduce((acc, it) => acc + it.taxableAmount, 0);
        const cgstTotal = calculatedItems.reduce((acc, it) => acc + it.cgstAmount, 0);
        const sgstTotal = calculatedItems.reduce((acc, it) => acc + it.sgstAmount, 0);
        const igstTotal = calculatedItems.reduce((acc, it) => acc + it.igstAmount, 0);
        const taxTotal = taxCalculatorService.round(cgstTotal + sgstTotal + igstTotal);
        const shippingFee = suborder.shippingTotal || 0;
        const grandTotal = suborder.grandTotal || taxCalculatorService.round(taxableAmount + taxTotal + shippingFee);

        // Associated shipment info
        const shipment = await Shipment.findOne({ suborderId: suborder._id });

        // Generate unique sequential invoice number
        const invoiceNumber = await InvoiceSequence.getNextInvoiceNumber('BM');

        const invoiceDoc = new Invoice({
          invoiceNumber,
          invoiceType: isGstRegistered ? 'TAX_INVOICE' : 'RETAIL_INVOICE',
          status: order.paymentStatus === 'PAID' ? 'PAID' : 'ISSUED',
          issueDate: new Date(),
          orderId: order._id,
          orderNumber: order.orderNumber,
          suborderId: suborder._id,
          subOrderNumber: suborder.subOrderNumber || suborder.publicSuborderId,
          vendorId: vendor?._id || suborder.vendorId,
          customerId: order.userId?._id || order.userId,
          brandingSnapshot,
          sellerSnapshot: {
            vendorId: vendor?._id || suborder.vendorId,
            storeName: vendor?.storeName || suborder.vendorNameSnapshot || 'Marketplace Seller',
            legalBusinessName: vendorBusiness?.businessType || vendor?.storeName || '',
            businessType: vendorBusiness?.businessType || '',
            gstin: isGstRegistered ? vendorBusiness.gstNumber : '',
            pan: vendorBusiness?.panNumber || '',
            email: vendor?.email || '',
            phone: vendor?.phone || '',
            address: vendor?.address || {},
          },
          buyerSnapshot,
          items: calculatedItems,
          pricing: {
            subtotal: taxCalculatorService.round(subtotal),
            discountTotal: totalVendorDiscount,
            couponCode: order.couponCode || '',
            couponDiscount: vendorCouponDiscount,
            fairCoinsUsed: Math.round((order.fairCoinsUsed || 0) * suborderRatio),
            fairCoinsDiscount: vendorCoinDiscount,
            shippingFee,
            taxableAmount: taxCalculatorService.round(taxableAmount),
            cgstTotal: taxCalculatorService.round(cgstTotal),
            sgstTotal: taxCalculatorService.round(sgstTotal),
            igstTotal: taxCalculatorService.round(igstTotal),
            taxTotal,
            grandTotal: taxCalculatorService.round(grandTotal),
            amountPaid: order.paymentStatus === 'PAID' ? taxCalculatorService.round(grandTotal) : 0,
            outstandingAmount: order.paymentStatus === 'PAID' ? 0 : taxCalculatorService.round(grandTotal),
          },
          paymentSnapshot,
          shippingSnapshot: {
            courierPartnerName: shipment?.courierPartnerName || '',
            awbNumber: shipment?.awbNumber || '',
            trackingUrl: shipment?.trackingUrl || '',
          },
        });

        // Save PDF to disk
        const pdfPath = await pdfInvoiceGenerator.saveToStorage(invoiceDoc);
        invoiceDoc.pdfStoragePath = pdfPath;
        await invoiceDoc.save();

        createdInvoices.push(invoiceDoc);
      }
    } else {
      // ── SINGLE SELLER / CONSOLIDATED ORDER INVOICE ─────────────────────────
      const rawItems = (order.items || []).map((item, idx) => ({
        sNo: idx + 1,
        productId: item.productId,
        sku: item.skuSnapshot || item.variantSku || '',
        name: item.productNameSnapshot || item.name || 'Product',
        hsnCode: item.hsnCode || '',
        quantity: Number(item.quantity) || 1,
        mrp: item.mrp || item.unitPrice || item.price,
        unitPrice: item.unitPrice || item.price,
        taxRate: item.taxRate || 5,
      }));

      const totalDiscount = taxCalculatorService.round((order.discount || 0) + (order.coinDiscount || 0));
      const discountedItems = taxCalculatorService.allocateDiscounts(rawItems, totalDiscount);

      const calculatedItems = discountedItems.map((item) =>
        taxCalculatorService.calculateLineItem(item, !!brandingSnapshot.gstin, false)
      );

      const subtotal = calculatedItems.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);
      const taxableAmount = calculatedItems.reduce((acc, it) => acc + it.taxableAmount, 0);
      const cgstTotal = calculatedItems.reduce((acc, it) => acc + it.cgstAmount, 0);
      const sgstTotal = calculatedItems.reduce((acc, it) => acc + it.sgstAmount, 0);
      const igstTotal = calculatedItems.reduce((acc, it) => acc + it.igstAmount, 0);
      const taxTotal = taxCalculatorService.round(cgstTotal + sgstTotal + igstTotal);
      const shippingFee = order.shippingFee || 0;
      const grandTotal = order.grandTotal || order.total || taxCalculatorService.round(taxableAmount + taxTotal + shippingFee);

      const invoiceNumber = await InvoiceSequence.getNextInvoiceNumber('BM');

      const invoiceDoc = new Invoice({
        invoiceNumber,
        invoiceType: brandingSnapshot.gstin ? 'TAX_INVOICE' : 'RETAIL_INVOICE',
        status: order.paymentStatus === 'PAID' ? 'PAID' : 'ISSUED',
        issueDate: new Date(),
        orderId: order._id,
        orderNumber: order.orderNumber,
        vendorId: null,
        customerId: order.userId?._id || order.userId,
        brandingSnapshot,
        sellerSnapshot: {
          vendorId: null,
          storeName: brandingSnapshot.brandName,
          legalBusinessName: brandingSnapshot.legalName,
          businessType: 'Private Limited Company',
          gstin: brandingSnapshot.gstin,
          pan: brandingSnapshot.pan,
          email: brandingSnapshot.supportEmail,
          phone: brandingSnapshot.supportPhone,
          address: {
            street: brandingSnapshot.registeredAddress,
            city: 'Bengaluru',
            state: 'Karnataka',
            zip: '560103',
            country: 'India',
          },
        },
        buyerSnapshot,
        items: calculatedItems,
        pricing: {
          subtotal: taxCalculatorService.round(subtotal),
          discountTotal: totalDiscount,
          couponCode: order.couponCode || '',
          couponDiscount: order.discount || 0,
          fairCoinsUsed: order.fairCoinsUsed || 0,
          fairCoinsDiscount: order.coinDiscount || 0,
          shippingFee,
          taxableAmount: taxCalculatorService.round(taxableAmount),
          cgstTotal: taxCalculatorService.round(cgstTotal),
          sgstTotal: taxCalculatorService.round(sgstTotal),
          igstTotal: taxCalculatorService.round(igstTotal),
          taxTotal,
          grandTotal: taxCalculatorService.round(grandTotal),
          amountPaid: order.paymentStatus === 'PAID' ? taxCalculatorService.round(grandTotal) : 0,
          outstandingAmount: order.paymentStatus === 'PAID' ? 0 : taxCalculatorService.round(grandTotal),
        },
        paymentSnapshot,
      });

      const pdfPath = await pdfInvoiceGenerator.saveToStorage(invoiceDoc);
      invoiceDoc.pdfStoragePath = pdfPath;
      await invoiceDoc.save();

      createdInvoices.push(invoiceDoc);
    }

    return createdInvoices;
  },

  /**
   * Get all invoices for a specific order with role verification
   */
  async getInvoicesForOrder(orderId, user) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found', ERROR_CODES.NOT_FOUND);
    }

    // Role-based access check
    if (user.role === 'CUSTOMER' && order.userId.toString() !== user._id.toString()) {
      throw new ApiError(403, 'Access denied: You do not own this order', ERROR_CODES.FORBIDDEN);
    }

    let query = { orderId: order._id };

    if (user.role === 'VENDOR') {
      const vendor = await Vendor.findOne({ userId: user._id });
      if (!vendor) throw new ApiError(404, 'Vendor profile not found', ERROR_CODES.NOT_FOUND);
      query.vendorId = vendor._id;
    }

    let invoices = await Invoice.find(query).sort({ createdAt: 1 });

    // If order is confirmed/paid and no invoices exist, generate them on the fly
    if (invoices.length === 0 && (order.paymentStatus === 'PAID' || ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'].includes(order.orderStatus))) {
      await this.generateInvoicesForOrder(orderId);
      invoices = await Invoice.find(query).sort({ createdAt: 1 });
    }

    return invoices;
  },

  /**
   * Get single invoice by ID with strict security check
   */
  async getInvoiceById(invoiceId, user) {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw new ApiError(404, 'Invoice not found', ERROR_CODES.NOT_FOUND);
    }

    // Role verification
    if (user.role === 'CUSTOMER') {
      if (invoice.customerId.toString() !== user._id.toString()) {
        throw new ApiError(403, 'Access denied: You do not own this invoice', ERROR_CODES.FORBIDDEN);
      }
    } else if (user.role === 'VENDOR') {
      const vendor = await Vendor.findOne({ userId: user._id });
      if (!vendor || !invoice.vendorId || invoice.vendorId.toString() !== vendor._id.toString()) {
        throw new ApiError(403, 'Access denied: You do not own this invoice', ERROR_CODES.FORBIDDEN);
      }
    }

    return invoice;
  },

  /**
   * Stream invoice PDF to HTTP response
   */
  async streamInvoicePdf(invoiceId, user, res) {
    const invoice = await this.getInvoiceById(invoiceId, user);

    const pdfBuffer = await pdfInvoiceGenerator.generateBuffer(invoice);
    if (invoice.pdfStoragePath) {
      try {
        fs.writeFileSync(path.resolve(process.cwd(), invoice.pdfStoragePath), pdfBuffer);
      } catch (err) {
        // Disk write fallback
      }
    }

    const safeFilename = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  },

  /**
   * Vendor invoice query with filters & pagination
   */
  async getVendorInvoices(vendorId, filters = {}, page = 1, limit = 20) {
    const query = { vendorId };

    if (filters.invoiceNumber) {
      query.invoiceNumber = { $regex: filters.invoiceNumber, $options: 'i' };
    }
    if (filters.orderNumber) {
      query.orderNumber = { $regex: filters.orderNumber, $options: 'i' };
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.dateFrom || filters.dateTo) {
      query.issueDate = {};
      if (filters.dateFrom) query.issueDate.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.issueDate.$lte = new Date(filters.dateTo);
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort({ issueDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Invoice.countDocuments(query),
    ]);

    return { invoices, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /**
   * Super Admin platform invoice query
   */
  async getAdminInvoices(filters = {}, page = 1, limit = 20) {
    const query = {};

    if (filters.vendorId) query.vendorId = filters.vendorId;
    if (filters.customerId) query.customerId = filters.customerId;
    if (filters.invoiceNumber) query.invoiceNumber = { $regex: filters.invoiceNumber, $options: 'i' };
    if (filters.orderNumber) query.orderNumber = { $regex: filters.orderNumber, $options: 'i' };
    if (filters.status) query.status = filters.status;
    if (filters.invoiceType) query.invoiceType = filters.invoiceType;
    if (filters.dateFrom || filters.dateTo) {
      query.issueDate = {};
      if (filters.dateFrom) query.issueDate.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.issueDate.$lte = new Date(filters.dateTo);
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate('vendorId', 'storeName email')
        .populate('customerId', 'name email')
        .sort({ issueDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Invoice.countDocuments(query),
    ]);

    return { invoices, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /**
   * Super Admin invoice metrics
   */
  async getAdminInvoiceStats() {
    const [total, paid, pending, cancelled, aggregate] = await Promise.all([
      Invoice.countDocuments(),
      Invoice.countDocuments({ status: 'PAID' }),
      Invoice.countDocuments({ status: 'ISSUED' }),
      Invoice.countDocuments({ status: 'CANCELLED' }),
      Invoice.aggregate([
        { $match: { status: 'PAID' } },
        {
          $group: {
            _id: null,
            totalValue: { $sum: '$pricing.grandTotal' },
            totalTax: { $sum: '$pricing.taxTotal' },
          },
        },
      ]),
    ]);

    const stats = aggregate[0] || { totalValue: 0, totalTax: 0 };
    return {
      totalInvoices: total,
      paidInvoices: paid,
      pendingInvoices: pending,
      cancelledInvoices: cancelled,
      totalPaidValue: stats.totalValue || 0,
      totalCollectedTax: stats.totalTax || 0,
    };
  },

  /**
   * Cancel invoice & issue Credit Note
   */
  async cancelInvoice(invoiceId, reason, user) {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw new ApiError(404, 'Invoice not found', ERROR_CODES.NOT_FOUND);

    if (invoice.status === 'CANCELLED') {
      throw new ApiError(400, 'Invoice has already been cancelled', ERROR_CODES.BAD_REQUEST);
    }

    invoice.status = 'CANCELLED';
    invoice.cancelledAt = new Date();
    invoice.cancellationReason = reason || 'Order cancelled / refunded';
    await invoice.save();

    // Generate Credit Note
    const creditNoteNumber = await InvoiceSequence.getNextInvoiceNumber('CN');
    const creditNoteDoc = new Invoice({
      invoiceNumber: creditNoteNumber,
      invoiceType: 'CREDIT_NOTE',
      isCreditNote: true,
      originalInvoiceId: invoice._id,
      creditNoteReason: reason || 'Goods return / Order cancellation',
      status: 'ISSUED',
      issueDate: new Date(),
      orderId: invoice.orderId,
      orderNumber: invoice.orderNumber,
      suborderId: invoice.suborderId,
      subOrderNumber: invoice.subOrderNumber,
      vendorId: invoice.vendorId,
      customerId: invoice.customerId,
      brandingSnapshot: invoice.brandingSnapshot,
      sellerSnapshot: invoice.sellerSnapshot,
      buyerSnapshot: invoice.buyerSnapshot,
      items: invoice.items,
      pricing: invoice.pricing,
      paymentSnapshot: {
        method: invoice.paymentSnapshot?.method,
        transactionId: invoice.paymentSnapshot?.transactionId,
        status: 'REFUNDED',
        paidAt: new Date(),
      },
    });

    const pdfPath = await pdfInvoiceGenerator.saveToStorage(creditNoteDoc);
    creditNoteDoc.pdfStoragePath = pdfPath;
    await creditNoteDoc.save();

    return { cancelledInvoice: invoice, creditNote: creditNoteDoc };
  },

  /**
   * Backward-compatible HTML generator
   */
  async generateInvoiceHtml(orderId, user) {
    const invoices = await this.getInvoicesForOrder(orderId, user);
    const invoice = invoices[0];
    if (!invoice) {
      throw new ApiError(404, 'No invoice found for order', ERROR_CODES.NOT_FOUND);
    }
    return {
      html: `<html><body><h1>Invoice ${invoice.invoiceNumber}</h1><p>Please download the official PDF directly.</p></body></html>`,
      invoiceNumber: invoice.invoiceNumber,
    };
  },
};

export default invoiceService;
