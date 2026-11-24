const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./db");
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const registrationRoutes = require("./routes/registrationRoutes");
const chatRoutes = require("./routes/chatRoutes");

const app = express();

const CORS_ORIGIN_ERROR = "Origin is not allowed by CORS";
const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(CORS_ORIGIN_ERROR));
  }
}));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
  res.send("Campus 360 Backend is Running!");
});

app.use((error, req, res, next) => {
  if (error.message === CORS_ORIGIN_ERROR) {
    return res.status(403).json({ message: CORS_ORIGIN_ERROR });
  }
  next(error);
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();