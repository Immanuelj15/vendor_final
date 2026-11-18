import { fairCoinService } from '../services/fairCoinService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

export const getSuperAdminFairCoinsOverview = asyncWrapper(async (req, res) => {
  const analytics = await fairCoinService.getSuperAdminAnalytics();
  return res.status(200).json(new ApiResponse(200, analytics, 'Fair Coins analytics retrieved'));
});

export const getSuperAdminFairCoinsCustomers = asyncWrapper(async (req, res) => {
  const result = await fairCoinService.getSuperAdminCustomers(req.query);
  return res.status(200).json(new ApiResponse(200, result, 'Customer Fair Coins balances retrieved'));
});

export const getSuperAdminFairCoinsTransactions = asyncWrapper(async (req, res) => {
  const result = await fairCoinService.getSuperAdminTransactions(req.query);
  return res.status(200).json(new ApiResponse(200, result, 'Fair Coins transactions retrieved'));
});

export const getSuperAdminFairCoinsOrders = asyncWrapper(async (req, res) => {
  const result = await fairCoinService.getSuperAdminOrderCoinDetails(req.query);
  return res.status(200).json(new ApiResponse(200, result, 'Order-wise Fair Coins details retrieved'));
});
