import express from "express";
import dotenv from "dotenv";
import { webhookRouter } from "./routes/webhook";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use("/webhook", webhookRouter);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

