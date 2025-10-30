# GitHub PR Description Generator

This project is a webhook server that automatically generates pull request descriptions using the OpenAI API. It is built with Bun, Express, and TypeScript, and is designed for deployment on Google Cloud Run.

## Overview

This server listens for `pull_request.opened` events from a GitHub App. When a new PR is opened, it fetches the diff, sends it to OpenAI to generate a summary, and then updates the PR's description with the AI-generated content. This automation is designed to accelerate PR reviews by providing clear, concise summaries of changes.

## Features

- **Automated PR Descriptions**: Generates descriptions for new pull requests.
- **GitHub App Integration**: Authenticates and interacts with the GitHub API using a GitHub App.
- **Webhook Security**: Verifies webhook signatures to ensure requests are from GitHub.
- **Asynchronous Processing**: Responds immediately to webhooks and processes requests in the background.
- **Containerized**: Includes a `Dockerfile` for easy deployment.
- **CI/CD Ready**: Comes with a `cloudbuild.yaml` for automated deployments to Google Cloud Run.

## Getting Started

### Prerequisites

- Bun.js
- A GitHub account and a repository
- An OpenAI API key
- Google Cloud SDK (`gcloud`)

### 1. Create a GitHub App

1.  Go to **Settings > Developer settings > GitHub Apps** and click **New GitHub App**.
2.  Fill in the app details.
3.  Under **Webhooks**, set the **Webhook URL** to a temporary URL from [smee.io](https://smee.io) for local testing.
4.  Create a **Webhook secret** and save it.
5.  Under **Repository permissions**, set:
    - `Pull requests`: Read & write
    - `Contents`: Read-only
6.  Under **Subscribe to events**, select `Pull request`.
7.  Save the app, generate a **private key**, and note the **App ID**.

### 2. Local Development

1.  Clone the repository.
2.  Create a `.env` file from `.env.example` and fill in the values:
    - `GITHUB_APP_ID`: Your GitHub App ID.
    - `GITHUB_APP_PRIVATE_KEY`: The contents of the private key file you downloaded.
    - `GITHUB_WEBHOOK_SECRET`: Your webhook secret.
    - `OPENAI_API_KEY`: Your OpenAI API key.
3.  Install dependencies:
    ```bash
    bun install
    ```
4.  Start the development server:
    ```bash
    bun run dev
    ```
5.  Use `smee-client` to forward webhooks to your local server:
    ```bash
    smee --url <your_smee_url> --path /webhook --port 3000
    ```

### 3. Deployment to Google Cloud Run

1.  Authenticate with `gcloud` and set project:
    ```bash
    gcloud auth login
    gcloud config set project <YOUR_PROJECT_ID>
    ```
2.  Enable required APIs:
    ```bash
    gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
    ```
3.  Create secrets in Secret Manager (one per env var):
    ```bash
    printf "%s" "<GITHUB_APP_ID>" | gcloud secrets create GITHUB_APP_ID --data-file=- || gcloud secrets versions add GITHUB_APP_ID --data-file=-
    printf "%s" "<PASTE_FULL_PEM_CONTENT>" | gcloud secrets create GITHUB_APP_PRIVATE_KEY --data-file=- || gcloud secrets versions add GITHUB_APP_PRIVATE_KEY --data-file=-
    printf "%s" "<WEBHOOK_SECRET>" | gcloud secrets create GITHUB_WEBHOOK_SECRET --data-file=- || gcloud secrets versions add GITHUB_WEBHOOK_SECRET --data-file=-
    printf "%s" "<OPENAI_API_KEY>" | gcloud secrets create OPENAI_API_KEY --data-file=- || gcloud secrets versions add OPENAI_API_KEY --data-file=-
    ```
4.  Build and deploy via Cloud Build → Cloud Run:
    ```bash
    gcloud builds submit --config cloudbuild.yaml .
    ```
5.  If deploying manually (optional), deploy with secrets wired:
    ```bash
    gcloud run deploy deeployed-webhook-server \
      --image gcr.io/$PROJECT_ID/deeployed-webhook-server \
      --region us-central1 \
      --platform managed \
      --allow-unauthenticated \
      --port 3000 \
      --set-secrets GITHUB_APP_ID=GITHUB_APP_ID:latest,GITHUB_APP_PRIVATE_KEY=GITHUB_APP_PRIVATE_KEY:latest,GITHUB_WEBHOOK_SECRET=GITHUB_WEBHOOK_SECRET:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest
    ```
6.  Update the GitHub App **Webhook URL** to:
    ```
    https://<cloud-run-service-url>/webhook
    ```
    Content type: `application/json`. Ensure events: Pull request; permissions: Pull requests (Read/Write), Contents (Read).

## Design Decisions

### PR Diff Handling

We avoid fetching the raw diff for large PRs (which can return 406). Instead, we:
1.  Use `GET /repos/{owner}/{repo}/pulls/{pull_number}/files` with pagination to safely list changed files.
2.  Build a structured, size-capped summary per file (status, additions/deletions, truncated `patch`).
3.  Send this summary to OpenAI to generate a concise PR description, then PATCH the PR body.

Benefits: scalable to large PRs, predictable token costs, and higher-quality prompts.

### Additional Production Considerations

- HMAC validation of webhook signatures (`X-Hub-Signature-256`).
- Idempotency guard using `X-GitHub-Delivery` to prevent duplicate processing.
- Immediate 202 response to webhooks; background processing.
- Ready to extend with rate limit backoff and persistent dedupe (Redis/Memorystore) when horizontally scaled.

## Google Cloud quick setup

If you already created the project in the console, run these once locally to finish setup:

```bash
export PROJECT_ID=<YOUR_PROJECT_ID>
export REGION=us-central1

gcloud auth login
gcloud config set project $PROJECT_ID

# Enable core services
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# Create/update secrets
printf "%s" "<GITHUB_APP_ID>" | gcloud secrets create GITHUB_APP_ID --data-file=- || gcloud secrets versions add GITHUB_APP_ID --data-file=-
printf "%s" "<PASTE_FULL_PEM_CONTENT>" | gcloud secrets create GITHUB_APP_PRIVATE_KEY --data-file=- || gcloud secrets versions add GITHUB_APP_PRIVATE_KEY --data-file=-
printf "%s" "<WEBHOOK_SECRET>" | gcloud secrets create GITHUB_WEBHOOK_SECRET --data-file=- || gcloud secrets versions add GITHUB_WEBHOOK_SECRET --data-file=-
printf "%s" "<OPENAI_API_KEY>" | gcloud secrets create OPENAI_API_KEY --data-file=- || gcloud secrets versions add OPENAI_API_KEY --data-file=-

# Build and deploy (Cloud Build → Cloud Run)
gcloud builds submit --config cloudbuild.yaml .

# Or manual deploy (optional)
gcloud run deploy deeployed-webhook-server \
  --image gcr.io/$PROJECT_ID/deeployed-webhook-server \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --set-secrets GITHUB_APP_ID=GITHUB_APP_ID:latest,GITHUB_APP_PRIVATE_KEY=GITHUB_APP_PRIVATE_KEY:latest,GITHUB_WEBHOOK_SECRET=GITHUB_WEBHOOK_SECRET:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest

# Logs
gcloud run services logs read deeployed-webhook-server --region $REGION --limit 100
```

After deploy, set your GitHub App Webhook URL to `https://<cloud-run-service-url>/webhook`.

## Interview talking points (architecture and decisions)

- Architecture
  - Bun + Express + TypeScript service, exposed `POST /webhook`.
  - GitHub App auth → installation token with Octokit.
  - Processing pipeline: Webhook → validate signature → dedupe via `X-GitHub-Delivery` → paginate PR files → build capped summary → OpenAI → PATCH PR body.
- Why GitHub App (not personal token / repository webhook)
  - Fine-grained permissions, secure, installable per-repo/org, rotation-free private key auth.
- Diff strategy justification
  - Raw diff can fail for large PRs (HTTP 406) and is token-expensive.
  - Listing PR files with pagination is reliable, scalable, and enables structured prompts, cost control, and filtering.
- Async and time limits
  - Immediate 202 response to meet webhook delivery expectations; background processing continues.
- Security
  - HMAC-SHA256 signature validation; secrets stored in Secret Manager; server has no CORS exposure.
- Idempotency and redelivery
  - In-memory dedupe keyed by `X-GitHub-Delivery`; safe for GitHub redeliveries. Can be swapped for Redis for multi-instance scaling.
- Rate limiting
  - Compatible with GitHub primary/secondary limits and OpenAI 429; add retry-after + exponential backoff if needed.
- Observability
  - Structured logs and request IDs planned; Cloud Run logs used for triage.
- Testing strategy
  - Local: smee.io forwarding; unit tests with Bun test runner and service mocks.
  - Prod: use GitHub App delivery console to inspect/redeliver events.
