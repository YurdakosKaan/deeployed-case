import { Router } from "express";
import { Webhooks } from "@octokit/webhooks";
import { handlePullRequestOpened } from "../services/github.service.js";

export const webhookRouter = Router();

let webhooksInstance: Webhooks | null = null;

function getWebhooks(): Webhooks {
  if (!process.env.GITHUB_WEBHOOK_SECRET) {
    throw new Error("GITHUB_WEBHOOK_SECRET is not set");
  }
  if (!webhooksInstance) {
    webhooksInstance = new Webhooks({
      secret: process.env.GITHUB_WEBHOOK_SECRET,
    });
  }
  return webhooksInstance;
}

// Simple in-memory idempotency guard for webhook redeliveries
// Stores recent X-GitHub-Delivery IDs to avoid duplicate processing
const recentlyProcessedDeliveryIds = new Set<string>();
const MAX_IDS = 1000;

function rememberDelivery(deliveryId: string) {
  recentlyProcessedDeliveryIds.add(deliveryId);
  if (recentlyProcessedDeliveryIds.size > MAX_IDS) {
    // remove oldest by recreating the set without the first element
    const first = recentlyProcessedDeliveryIds.values().next().value as string | undefined;
    if (first) recentlyProcessedDeliveryIds.delete(first);
  }
}

webhookRouter.post("/", async (req, res) => {
  const signature = req.headers["x-hub-signature-256"] as string;
  if (!signature) {
    console.error("Webhook: No signature header found");
    return res.status(401).send("No signature found");
  }

  const payload = JSON.stringify(req.body);
  const event = req.headers["x-github-event"] as string;
  console.log(`Webhook received: event=${event}, hasSignature=${!!signature}`);

  const isValid = await getWebhooks().verify(payload, signature);
  if (!isValid) {
    console.error("Webhook: Invalid signature - secret may not match");
    return res.status(401).send("Invalid signature");
  }
  
  const deliveryId = req.headers["x-github-delivery"] as string | undefined;

  if (deliveryId && recentlyProcessedDeliveryIds.has(deliveryId)) {
    // Idempotent: accept but skip duplicate work
    return res.status(200).send("Duplicate delivery");
  }

  if (event === "ping") {
    return res.status(200).send("pong");
  }
  
  if (event === "pull_request" && req.body.action === "opened") {
    res.status(202).send("Accepted");
    try {
      if (deliveryId) rememberDelivery(deliveryId);
      await handlePullRequestOpened(req.body);
    } catch (error) {
      console.error("Error handling pull request event:", error);
    }
    return;
  }

  res.status(200).send("Event received");
});

