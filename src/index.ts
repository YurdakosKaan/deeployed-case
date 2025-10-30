import express from "express";
import dotenv from "dotenv";
import { webhookRouter } from "./routes/webhook";

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());

app.use("/webhook", webhookRouter);

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});

