function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
}

function errorHandler(err, req, res, next) {
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || "Internal server error";

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid product ID";
  }
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors).map((item) => item.message).join(", ");
  }
  if (err.code === 11000) {
    statusCode = 409;
    message = `A product with this ${Object.keys(err.keyValue).join(", ")} already exists`;
  }
  if (err.name === "SyntaxError" && "body" in err) {
    statusCode = 400;
    message = "Invalid JSON request body";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {})
  });
}

module.exports = { notFound, errorHandler };