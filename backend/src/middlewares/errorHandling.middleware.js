import { apiError } from "../utils/apiError.js";

const errorHandler = (err, req, res, next) => {
  // 1. Custom apiError (Controllers se jo hum throw karte hain)
  if (err instanceof apiError) {
    return res.status(err.statusCode).json({
      statusCode: err.statusCode,
      message: err.message,
      success: false,
      errors: err.errors,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // 2. Mongoose Validation Error (Schema rules fail hone pe)
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      statusCode: 400,
      message: "Validation failed",
      success: false,
      errors,
    });
  }

  // 3. Mongoose CastError (Invalid ObjectId format)
  if (err.name === "CastError") {
    return res.status(400).json({
      statusCode: 400,
      message: `Invalid ${err.path}: ${err.value}`,
      success: false,
      errors: [],
    });
  }

  // 4. MongoDB Duplicate Key Error (11000 - Unique field match)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      statusCode: 409,
      message: `${field} already exists`,
      success: false,
      errors: [],
    });
  }

  // 5. JWT Errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      statusCode: 401,
      message: "Invalid token",
      success: false,
      errors: [],
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      statusCode: 401,
      message: "Token expired",
      success: false,
      errors: [],
    });
  }

  // 6. Fallback: Unknown/Unhandled Server Errors
  console.error("💥 Unhandled Error:", err);
  return res.status(500).json({
    statusCode: 500,
    message: "Internal server error",
    success: false,
    errors: [],
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export { errorHandler };
