import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  MapPin, Plus, Edit2, Trash2, CheckCircle2, AlertCircle,
  Loader2, Package, Save, X, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EMPTY_FORM = {
  contactName: '',
  businessName: '',
  phone: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  district: '',
  area: '',
  pincode: '',
  landmark: '',
  isDefault: false,
};

export default function VendorPickupAddressManager() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/shipping/vendor/addresses');
      if (res.data?.success) {
        setAddresses(res.data.data.addresses || []);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load pickup addresses');
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setForm({ ...EMPTY_FORM, isDefault: addresses.length === 0 });
    setEditingId(null);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (addr) => {
    setForm({
      contactName: addr.contactName || '',
      businessName: addr.businessName || '',
      phone: addr.phone || '',
      email: addr.email || '',
      addressLine1: addr.addressLine1 || '',
      addressLine2: addr.addressLine2 || '',
      city: addr.city || addr.cityName || addr.district?.name || '',
      state: addr.stateName || addr.state?.name || '',
      district: '',
      area: '',
      pincode: addr.pincode || '',
      landmark: addr.landmark || '',
      isDefault: addr.isDefault || false,
    });
    setEditingId(addr._id);
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!/^\d{6}$/.test(form.pincode)) {
      setFormError('PIN code must be exactly 6 digits');
      return;
    }

    const payload = { ...form };
    if (addresses.length === 0) {
      payload.isDefault = true;
    }
    if (payload.state && !/^[0-9a-fA-F]{24}$/.test(payload.state)) {
      payload.stateName = payload.state;
      delete payload.state;
    } else if (!payload.state) {
      delete payload.state;
    }

    if (payload.district && !/^[0-9a-fA-F]{24}$/.test(payload.district)) {
      payload.city = payload.district;
      delete payload.district;
    } else if (!payload.district) {
      delete payload.district;
    }

    if (payload.area && !/^[0-9a-fA-F]{24}$/.test(payload.area)) {
      delete payload.area;
    } else if (!payload.area) {
      delete payload.area;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/shipping/vendor/addresses/${editingId}`, payload);
      } else {
        await api.post('/shipping/vendor/addresses', payload);
      }
      setShowForm(false);
      setEditingId(null);
      await fetchAddresses();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to save address');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this pickup address?')) return;
    try {
      await api.delete(`/shipping/vendor/addresses/${id}`);
      await fetchAddresses();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to delete address');
    }
  };

  const getRegistrationBadge = (status) => {
    switch (status) {
      case 'REGISTERED':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Shiprocket Registered
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <Loader2 className="w-3 h-3 animate-spin" /> Registering...
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
            <AlertCircle className="w-3 h-3" /> Registration Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
            <Package className="w-3 h-3" /> Not Registered
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Pickup Addresses</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your pickup addresses for Shiprocket shipments.
            Your default address will be used for all shipments unless overridden.
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Address
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Address Cards */}
      {addresses.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
          <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No pickup addresses yet</p>
          <p className="text-slate-400 text-sm mt-1">Add a pickup address to start creating shipments</p>
          <button
            onClick={openAddForm}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Address
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {addresses.map((addr) => (
            <motion.div
              key={addr._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative p-4 rounded-xl border-2 transition-colors ${
                addr.isDefault
                  ? 'border-indigo-300 bg-indigo-50/30'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {addr.isDefault && (
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3" /> Default
                  </span>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-100 rounded-lg mt-0.5">
                  <MapPin className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0 pr-20">
                  <p className="font-semibold text-slate-900 text-sm">{addr.contactName}</p>
                  <p className="text-slate-600 text-sm">{addr.businessName}</p>
                  <p className="text-slate-500 text-sm mt-1">
                    {addr.addressLine1}
                    {addr.addressLine2 && `, ${addr.addressLine2}`}
                    {addr.landmark && ` (${addr.landmark})`}
                  </p>
                  <p className="text-slate-500 text-sm">
                    {addr.city || addr.cityName || addr.district?.name || addr.district || ''}
                    {(addr.stateName || addr.state?.name || addr.state) ? ` • ${addr.stateName || addr.state?.name || addr.state}` : ''}
                    {` • PIN: ${addr.pincode}`}
                  </p>
                  <p className="text-slate-500 text-sm">📞 {addr.phone}</p>
                  <div className="mt-2">{getRegistrationBadge(addr.shiprocketRegistrationStatus)}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                <button
                  onClick={() => openEditForm(addr)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-600 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
                {addr.shiprocketRegistrationStatus !== 'REGISTERED' && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await api.post(`/shipping/vendor/addresses/${addr._id}/register`);
                        alert(res.data?.message || 'Registered with Shiprocket successfully!');
                        fetchAddresses();
                      } catch (err) {
                        alert(err.response?.data?.message || 'Failed to register with Shiprocket');
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 font-bold hover:text-blue-800 transition-colors ml-2"
                  >
                    <Package className="w-3.5 h-3.5" />
                    Register with Shiprocket
                  </button>
                )}
                {!addr.isDefault && (
                  <>
                    <button
                      onClick={async () => {
                        try {
                          await api.put(`/shipping/vendor/addresses/${addr._id}`, { isDefault: true });
                          fetchAddresses();
                        } catch (err) {
                          alert('Failed to set address as default');
                        }
                      }}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 font-bold hover:text-indigo-800 transition-colors ml-2"
                    >
                      <Star className="w-3.5 h-3.5" />
                      Set as Default
                    </button>
                    <button
                      onClick={() => handleDelete(addr._id)}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-red-600 transition-colors ml-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">
                  {editingId ? 'Edit Pickup Address' : 'Add Pickup Address'}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Contact Name *
                    </label>
                    <input
                      required
                      value={form.contactName}
                      onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Contact person name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Business Name *
                    </label>
                    <input
                      required
                      value={form.businessName}
                      onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Business/Store name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Phone *
                    </label>
                    <input
                      required
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="10-digit phone"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="pickup@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Address Line 1 *
                  </label>
                  <input
                    required
                    value={form.addressLine1}
                    onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Street, Building, Area"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Address Line 2
                  </label>
                  <input
                    value={form.addressLine2}
                    onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Apartment, Floor, etc."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Landmark
                  </label>
                  <input
                    value={form.landmark}
                    onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Near landmark"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      City / District
                    </label>
                    <input
                      value={form.city || ''}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g. Kovilpatti"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      State
                    </label>
                    <input
                      value={form.state || ''}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g. Tamil Nadu"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    PIN Code * (6 digits)
                  </label>
                  <input
                    required
                    maxLength={6}
                    pattern="\d{6}"
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="110001"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">Set as default pickup address</span>
                </label>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {editingId ? 'Update Address' : 'Save Address'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
