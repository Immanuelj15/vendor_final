import { ReturnPolicy } from '../models/ReturnPolicy.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';
import { ERROR_CODES } from '../constants/responseCodes.js';

export const returnPolicyController = {
  // Get all policies (optionally filtered by policyType or isActive)
  getPolicies: asyncWrapper(async (req, res) => {
    const { policyType, isActive } = req.query;
    const filter = {};
    if (policyType) filter.policyType = policyType;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const policies = await ReturnPolicy.find(filter)
      .populate('categoryId', 'name')
      .populate('productId', 'name sku')
      .sort({ policyType: 1, createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, policies, 'Return policies retrieved successfully'));
  }),

  // Get single policy
  getPolicyById: asyncWrapper(async (req, res) => {
    const { id } = req.params;
    const policy = await ReturnPolicy.findById(id)
      .populate('categoryId', 'name')
      .populate('productId', 'name sku');

    if (!policy) {
      throw new ApiError(404, 'Return policy not found', ERROR_CODES.NOT_FOUND);
    }

    return res.status(200).json(new ApiResponse(200, policy, 'Return policy retrieved successfully'));
  }),

  // Create new return policy
  createPolicy: asyncWrapper(async (req, res) => {
    const {
      name,
      policyType = 'GLOBAL_DEFAULT',
      categoryId,
      productId,
      returnAllowed = true,
      returnWindowDays = 7,
      replacementAllowed = true,
      replacementWindowDays = 7,
      refundAllowed = true,
      cancellationAllowed = true,
      applicableConditions = [],
      requiresEvidenceImages = false,
      requiresSerialVerification = false,
      description = '',
      isActive = true,
    } = req.body;

    if (!name) {
      throw new ApiError(400, 'Policy name is required', ERROR_CODES.BAD_REQUEST);
    }

    // If GLOBAL_DEFAULT, ensure only one active default or mark others inactive
    if (policyType === 'GLOBAL_DEFAULT') {
      await ReturnPolicy.updateMany({ policyType: 'GLOBAL_DEFAULT' }, { isDefault: false });
    }

    const policy = await ReturnPolicy.create({
      name,
      policyType,
      categoryId: categoryId || null,
      productId: productId || null,
      returnAllowed,
      returnWindowDays,
      replacementAllowed,
      replacementWindowDays,
      refundAllowed,
      cancellationAllowed,
      applicableConditions: Array.isArray(applicableConditions) ? applicableConditions : [],
      requiresEvidenceImages,
      requiresSerialVerification,
      description,
      isDefault: policyType === 'GLOBAL_DEFAULT',
      isActive,
    });

    return res.status(201).json(new ApiResponse(201, policy, 'Return policy created successfully'));
  }),

  // Update existing return policy
  updatePolicy: asyncWrapper(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const policy = await ReturnPolicy.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!policy) {
      throw new ApiError(404, 'Return policy not found', ERROR_CODES.NOT_FOUND);
    }

    return res.status(200).json(new ApiResponse(200, policy, 'Return policy updated successfully'));
  }),

  // Delete return policy
  deletePolicy: asyncWrapper(async (req, res) => {
    const { id } = req.params;
    const policy = await ReturnPolicy.findById(id);
    if (!policy) {
      throw new ApiError(404, 'Return policy not found', ERROR_CODES.NOT_FOUND);
    }

    if (policy.policyType === 'GLOBAL_DEFAULT' && policy.isDefault) {
      throw new ApiError(400, 'Cannot delete the active global default return policy', ERROR_CODES.BAD_REQUEST);
    }

    await ReturnPolicy.findByIdAndDelete(id);
    return res.status(200).json(new ApiResponse(200, null, 'Return policy deleted successfully'));
  }),
};

