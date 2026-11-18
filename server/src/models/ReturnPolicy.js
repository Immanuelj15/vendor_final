import mongoose from 'mongoose';

const returnPolicySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    policyType: {
      type: String,
      enum: ['GLOBAL_DEFAULT', 'CATEGORY', 'PRODUCT'],
      default: 'GLOBAL_DEFAULT',
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true,
    },
    returnAllowed: {
      type: Boolean,
      default: true,
    },
    returnWindowDays: {
      type: Number,
      default: 7,
      min: 0,
      max: 90,
    },
    replacementAllowed: {
      type: Boolean,
      default: true,
    },
    replacementWindowDays: {
      type: Number,
      default: 7,
      min: 0,
      max: 90,
    },
    refundAllowed: {
      type: Boolean,
      default: true,
    },
    cancellationAllowed: {
      type: Boolean,
      default: true,
    },
    applicableConditions: {
      type: [String],
      default: [
        'Original brand packaging must be intact',
        'All accessories, user manuals, and warranty cards included',
        'Item must be unused and in original condition',
        'Product tags and serial number labels must be unremoved',
      ],
    },
    requiresEvidenceImages: {
      type: Boolean,
      default: false,
    },
    requiresSerialVerification: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      default: '',
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

/**
 * Resolves the applicable return & replacement policy for a specific product.
 * Priority: PRODUCT-specific -> CATEGORY-specific -> GLOBAL_DEFAULT -> Hardcoded safe fallback.
 */
returnPolicySchema.statics.resolvePolicyForProduct = async function (productId, categoryId = null) {
  // 1. Check Product-level policy override
  if (productId) {
    const productPolicy = await this.findOne({
      policyType: 'PRODUCT',
      productId,
      isActive: true,
    }).lean();
    if (productPolicy) return productPolicy;
  }

  // 2. Check Category-level policy override
  if (categoryId) {
    const categoryPolicy = await this.findOne({
      policyType: 'CATEGORY',
      categoryId,
      isActive: true,
    }).lean();
    if (categoryPolicy) return categoryPolicy;
  }

  // 3. Fallback to Global Default Policy
  const globalPolicy = await this.findOne({
    policyType: 'GLOBAL_DEFAULT',
    isActive: true,
  }).lean();
  if (globalPolicy) return globalPolicy;

  // 4. Safe hardcoded baseline if no policy configured yet
  return {
    name: 'Standard BAAPOO MART 7-Day Policy',
    policyType: 'GLOBAL_DEFAULT',
    returnAllowed: true,
    returnWindowDays: 7,
    replacementAllowed: true,
    replacementWindowDays: 7,
    refundAllowed: true,
    cancellationAllowed: true,
    applicableConditions: [
      'Original packaging intact',
      'All tags and accessories included',
      'No physical damage',
    ],
    requiresEvidenceImages: false,
    requiresSerialVerification: false,
  };
};

export const ReturnPolicy = mongoose.model('ReturnPolicy', returnPolicySchema);
export default ReturnPolicy;

