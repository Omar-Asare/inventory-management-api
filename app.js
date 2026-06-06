const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const categoryRoutes = require("./src/routes/categoryRoutes");
const productRoutes = require("./src/routes/productRoutes");
const authRoutes = require("./src/routes/authRoutes");
const stockRoutes = require("./src/routes/stockRoutes");

const AppError = require("./src/utils/appError");
const globalErrorHandler = require("./src/middleware/errorMiddleware");

const app = express();

app.use(helmet());

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    status: "fail",
    message:
      "Too many requests from this IP, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", generalLimiter);

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    status: "fail",
    message:
      "Too many authentication attempts from this IP. Access locked for 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);

app.use(express.json({ limit: "10kb" })); // Body limits add a layer against payload attacks

app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/stock", stockRoutes);

app.get("/", (req, res) => {
  res.send("Inventory API is running!");
});

app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
