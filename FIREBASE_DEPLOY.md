# Deploy GGC TOSS To Firebase

This app uses Socket.io, so it needs Firebase Hosting plus Cloud Run. Firebase Hosting serves the React build and rewrites `/api/**` and `/socket.io/**` to the Cloud Run backend.

## One-Time Setup

Install the CLIs:

```bash
npm install -g firebase-tools
brew install --cask google-cloud-sdk
```

Log in:

```bash
firebase login
gcloud auth login
gcloud auth application-default login
```

Set your project and enable required services:

```bash
PROJECT_ID=your-firebase-project-id
REGION=asia-south1
SERVICE=ggc-toss-api

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
firebase use "$PROJECT_ID"
```

## Deploy Backend To Cloud Run

```bash
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "CLIENT_ORIGINS=https://$PROJECT_ID.web.app,https://$PROJECT_ID.firebaseapp.com" \
  --timeout 3600 \
  --memory 512Mi \
  --cpu 1
```

## Deploy Frontend To Firebase Hosting

```bash
npm ci
npm run build
firebase deploy --only hosting --project "$PROJECT_ID"
```

After deploy, open:

```text
https://PROJECT_ID.web.app
```

## Verify

```bash
curl "https://PROJECT_ID.web.app/api/health"
```

Then open two browser windows, create a room in one, join from the share link in the other, and flip as admin.

## Important Notes

- Room history is still in memory. If the Cloud Run instance restarts, room state clears.
- Cloud Run supports WebSockets, but WebSocket connections are still subject to request timeouts. The client already reconnects automatically.
- If you use a custom domain, add it to the `CLIENT_ORIGINS` env var on the Cloud Run service.
