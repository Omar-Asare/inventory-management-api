module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Production-grade error formatting
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    // Show the exact stack trace lines only if we are troubleshooting in development
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
