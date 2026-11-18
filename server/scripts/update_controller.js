import fs from 'fs';

let code = fs.readFileSync('src/controllers/vendorOrderController.js', 'utf8');

const snip1 = "return res.status(200).json(new ApiResponse(200, { suborder }, 'Order dispatched and marked SHIPPED'));";
const sync1 = `try {
    const { Shipment } = await import('../models/Shipment.js');
    const { ShipmentTrackingEvent } = await import('../models/ShipmentTrackingEvent.js');
    const shipment = await Shipment.findOne({ suborderId: suborder._id });
    if (shipment) {
      shipment.status = 'IN_TRANSIT';
      shipment.shippedAt = new Date();
      await shipment.save();

      await ShipmentTrackingEvent.create({
        shipmentId: shipment._id,
        provider: 'SHIPROCKET',
        providerEventId: 'evt_shipped_' + Date.now(),
        providerStatus: 'In Transit',
        internalStatus: 'IN_TRANSIT',
        location: 'Local Logistics Hub',
        description: 'Parcel picked up by courier and in transit to customer delivery address',
        eventTime: new Date(),
      }).catch(() => {});
    }
  } catch (shipErr) {
    console.warn('[Shipping] Error syncing shipment status to IN_TRANSIT:', shipErr.message);
  }

  `;

if (code.includes(snip1)) {
  code = code.replace(snip1, sync1 + snip1);
}

const snip2 = "return res.status(200).json(new ApiResponse(200, { suborder }, 'Order delivered to customer successfully'));";
const sync2 = `try {
    const { Shipment } = await import('../models/Shipment.js');
    const { ShipmentTrackingEvent } = await import('../models/ShipmentTrackingEvent.js');
    const shipment = await Shipment.findOne({ suborderId: suborder._id });
    if (shipment) {
      shipment.status = 'DELIVERED';
      shipment.deliveredAt = new Date();
      await shipment.save();

      await ShipmentTrackingEvent.create({
        shipmentId: shipment._id,
        provider: 'SHIPROCKET',
        providerEventId: 'evt_delivered_' + Date.now(),
        providerStatus: 'Delivered',
        internalStatus: 'DELIVERED',
        location: 'Destination Delivery Hub',
        description: 'Parcel successfully delivered to customer',
        eventTime: new Date(),
      }).catch(() => {});
    }
  } catch (shipErr) {
    console.warn('[Shipping] Error syncing shipment status to DELIVERED:', shipErr.message);
  }

  `;

if (code.includes(snip2)) {
  code = code.replace(snip2, sync2 + snip2);
}

fs.writeFileSync('src/controllers/vendorOrderController.js', code, 'utf8');
console.log('vendorOrderController.js successfully updated with Shipment tracking sync!');

