import { App } from "octokit";
import { generatePRDescription } from "./openai.service";
import { PullRequestOpenedPayload } from "../types";

let appInstance: App | null = null;

function getApp(): App {
  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GitHub App credentials are not set");
  }
  if (!appInstance) {
    appInstance = new App({
      appId: process.env.GITHUB_APP_ID,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
    });
  }
  return appInstance;
}

export async function handlePullRequestOpened(payload: PullRequestOpenedPayload) {
  const { repository, pull_request, installation } = payload;
  if (!installation) {
    throw new Error("Installation ID is missing from the payload");
  }

  const octokit = await getApp().getInstallationOctokit(installation.id);

  const owner = repository.owner.login;
  const repo = repository.name;
  const pull_number = pull_request.number;

  try {
    // Build a size-capped summary of changed files using pagination to avoid 406 for large diffs
    // See: List PR files and Pagination docs
    const MAX_SUMMARY_CHARS = 20000; // guardrail for token/cost control
    const MAX_PATCH_PER_FILE = 800;  // keep only the head/tail of each patch

    let summary = `PR #${pull_number} in ${owner}/${repo}\n`;

    const iterator = octokit.paginate.iterator(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
      {
        owner,
        repo,
        pull_number,
        per_page: 100,
      }
    );

    for await (const { data: files } of iterator) {
      for (const f of files as Array<any>) {
        if (summary.length >= MAX_SUMMARY_CHARS) break;

        const filename = f.filename as string;
        const status = f.status as string; // added | removed | modified | renamed | ...
        const additions = f.additions as number;
        const deletions = f.deletions as number;
        const changes = f.changes as number;
        const patch = typeof f.patch === "string" ? f.patch : "";

        let patchSnippet = patch;
        if (patch && patch.length > MAX_PATCH_PER_FILE) {
          const head = patch.slice(0, Math.floor(MAX_PATCH_PER_FILE / 2));
          const tail = patch.slice(-Math.floor(MAX_PATCH_PER_FILE / 2));
          patchSnippet = `${head}\n... truncated ...\n${tail}`;
        }

        summary += `\n---\nfile: ${filename}\nstatus: ${status}, additions: ${additions}, deletions: ${deletions}, changes: ${changes}\n`;
        if (patchSnippet) {
          summary += `patch:\n${patchSnippet}\n`;
        }
      }
      if (summary.length >= MAX_SUMMARY_CHARS) break;
    }

    const description = await generatePRDescription(summary);

    await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner,
      repo,
      pull_number,
      body: description,
      headers: {
        "x-github-api-version": "2022-11-28",
      },
    });
  } catch (error) {
    console.error("Error processing pull request:", error);
  }
}

