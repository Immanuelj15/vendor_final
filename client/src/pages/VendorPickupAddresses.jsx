import React from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import VendorPickupAddressManager from '../components/shipping/VendorPickupAddressManager';

export const VendorPickupAddresses = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
          <MapPin className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Vendor Pickup Locations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure your warehouse and dispatch addresses synchronized with Shiprocket pickup points
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-xs">
        <VendorPickupAddressManager />
      </div>
    </motion.div>
  );
};

export default VendorPickupAddresses;

