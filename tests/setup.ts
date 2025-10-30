import dotenv from "dotenv";
import { mock } from "bun:test";

dotenv.config({ path: "tests/.env.test" });

mock.module("@/services/github.service", () => ({
  handlePullRequestOpened: () => Promise.resolve(),
}));

mock.module("@/services/openai.service", () => ({
  generatePRDescription: () => Promise.resolve("Mocked PR description"),
}));

