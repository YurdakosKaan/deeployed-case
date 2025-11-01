import "./setup";
import { expect, test, describe, spyOn } from "bun:test";
import express from "express";
import request from "supertest";
import { webhookRouter } from "@/routes/webhook";
import * as githubService from "@/services/github.service";
import { createHmac } from "crypto";

// Helper to generate valid webhook signatures for testing
function generateSignature(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

describe("Webhook Router", () => {
  const app = express();
  app.use(express.json());
  app.use("/webhook", webhookRouter);

  const TEST_SECRET = "test-secret";
  process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;

  test("should return 401 for requests with no signature", async () => {
    const response = await request(app).post("/webhook").send({});
    expect(response.status).toBe(401);
  });
  
  test("should return 200 for a valid ping event", async () => {
    const payload = JSON.stringify({});
    const signature = generateSignature(payload, TEST_SECRET);
    
    const response = await request(app)
      .post("/webhook")
      .set("x-github-event", "ping")
      .set("x-hub-signature-256", signature)
      .send({});
    expect(response.status).toBe(200);
    expect(response.text).toBe("pong");
  });

  test("should return 202 and process a valid pull_request.opened event", async () => {
    const handleMock = spyOn(githubService, 'handlePullRequestOpened').mockResolvedValue(undefined);
    
    const payload = { 
      action: "opened", 
      pull_request: { number: 1 },
      repository: { name: 'test-repo', owner: { login: 'test-owner' } },
      installation: { id: 123 }
    };
    
    const payloadStr = JSON.stringify(payload);
    const signature = generateSignature(payloadStr, TEST_SECRET);
    
    const response = await request(app)
      .post("/webhook")
      .set("x-github-event", "pull_request")
      .set("x-hub-signature-256", signature) 
      .send(payload);

    expect(response.status).toBe(202);
    expect(handleMock).toHaveBeenCalledWith(payload);
  });
});
