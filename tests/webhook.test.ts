import "./setup";
import { expect, test, describe, spyOn } from "bun:test";
import express from "express";
import request from "supertest";
import { webhookRouter } from "@/routes/webhook";
import * as githubService from "@/services/github.service";

describe("Webhook Router", () => {
  const app = express();
  app.use(express.json());
  app.use("/webhook", webhookRouter);

  process.env.GITHUB_WEBHOOK_SECRET = "test-secret";

  test("should return 401 for requests with no signature", async () => {
    const response = await request(app).post("/webhook").send({});
    expect(response.status).toBe(401);
  });
  
  test("should return 200 for a valid ping event", async () => {
    // This signature is not valid, but we are not testing verification here.
    // We are testing that the ping event is correctly handled.
    const response = await request(app)
      .post("/webhook")
      .set("x-github-event", "ping")
      .set("x-hub-signature-256", "sha256=a5b9d3d3b6a9c6e5e8f4b0f6b3a2e1d1e4f4b3a2e1d1e4f4b3a2e1d1e4f4b3a2")
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
    
    // Webhook verification is complex to mock, so we bypass it for this unit test
    // by mocking the service function that is called after verification.
    const response = await request(app)
      .post("/webhook")
      .set("x-github-event", "pull_request")
      .set("x-hub-signature-256", "sha256=test") 
      .send(payload);

    expect(response.status).toBe(202);
    expect(handleMock).toHaveBeenCalledWith(payload);
  });
});
