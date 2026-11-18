import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';

export const errorHandler = (err, req, res, next) => {
  let error = err;

  console.error('[Error Details]', err);

  // Catch Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError' || err.kind === 'ObjectId') {
    error = new ApiError(400, `Invalid ID format for field '${err.path || 'id'}'`, ERROR_CODES.BAD_REQUEST);
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'resource';
    error = new ApiError(409, `Duplicate value for unique field '${field}'`, ERROR_CODES.CONFLICT);
  } else if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    error = new ApiError(400, messages.join(', ') || 'Validation error', ERROR_CODES.BAD_REQUEST, messages);
  } else if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'An unexpected internal server error occurred' : (error.message || 'Internal Server Error');
    error = new ApiError(statusCode, message, ERROR_CODES.INTERNAL_SERVER_ERROR);
  }

  const response = {
    success: false,
    message: error.message,
    errorCode: error.errorCode,
    errors: error.errors || [],
    requestId: req.requestId,
  };

  res.status(error.statusCode).json(response);
};
