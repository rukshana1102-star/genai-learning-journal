# GenAI Learning Journal

A secure, production-ready full-stack web application designed for active learning. Users record their daily insights, concepts, and challenges, and engage in guided multi-turn dialogues with Google Gemini to test comprehension, clarify nuances, and reinforce knowledge.

All learning records and AI guidance are persistently and privately stored in Google Cloud Firestore under strict per-user UID isolation.

---

## Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React icons, React-Markdown.
- **Backend**: Node.js Express server (`server.ts`) running on port 3000 with Vite middleware in development and bundled `dist/server.cjs` in production.
- **Authentication**: Firebase Authentication with Google Sign-In (`signInWithPopup`).
- **Persistence**: Google Cloud Firestore with Attribute-Based Access Control (ABAC) rules.
- **AI Engine**: `@google/genai` TypeScript SDK using `gemini-3.8-flash` executing strictly on the server-side (`/api/chat`) to protect credentials and prevent browser exposure.

---

## Key Features

1. **Clean Landing Page**:
   - Clear value proposition highlighting daily reflection and AI Socratic guidance.
   - Dedicated "Sign in with Google" flow.
   - Resilient popup handling with browser blocker notifications.

2. **Authenticated Private Dashboard**:
   - Direct access control: only authenticated users can access the dashboard.
   - User profile display: Google avatar, display name, email, and authenticated UID security badge.

3. **Multi-Turn Gemini AI Guidance**:
   - Server-side invocation via `ai.models.generateContent` (`gemini-3.8-flash`).
   - Socratic prompt framing: reinforces valid takeaways, clarifies misconceptions, and asks 1-2 reflective questions.
   - Multi-turn conversation retention: sends conversational history context to maintain dialogue coherence across turns.
   - Prompt-injection defense: user text is strictly bounded as untrusted learning notes.

4. **Firestore Data Isolation**:
   - Documents are stored strictly under `/users/{userId}/entries/{entryId}`.
   - Strict `firestore.rules` verify that `request.auth.uid == userId` for all read, create, list, and delete operations.
   - Catch-all default-deny rule (`match /{document=**} { allow read, write: if false; }`).

5. **Original Feature: Summarise My Learning + Next Action**:
   - Analyzes recent learning reflections with Gemini 3.8 and synthesizes exactly three structured sections:
     - **Learning Summary**: Concise, beginner-friendly summary of core takeaways.
     - **Concept to Revise**: Identifies key concept requiring reinforcement.
     - **Next Action for Tomorrow**: Actionable, practical learning task for the next day.
   - Displayed in a clean card below the journal conversation.
   - Privately stored in Firestore at `/users/{userId}/summaries/{summaryId}` strictly isolated to the authenticated user's UID.
   - Automatic retry and 503 handling with exponential backoff and duplicate prevention (updates same summary document without creating duplicate journal entries).

6. **Fault Tolerance & State Preservation**:
   - If an API error or network failure occurs, the user's typed learning notes are never erased.
   - Clear, dismissible error notifications with retry actions.
   - Automatic retry loop with exponential backoff and jitter for transient Gemini 503 / high demand spikes.

---

## Security & Access Control

### Firestore Security Rules Summary
- **No Open Rules**: All database operations require `request.auth != null`.
- **Identity Integrity**: `incoming().userId == request.auth.uid` is enforced.
- **Per-User Subcollections**: Users can only query and list entries inside their own subcollection `/users/{userId}/entries`.
- **Field & Size Validation**: String lengths are constrained to prevent denial-of-wallet / resource exhaustion attacks.
- **Strict User Profile Isolation**: User profiles in `/users/{userId}` can only be read (`get`) by the owner.

### Secret Management
- `GEMINI_API_KEY` is kept exclusively on the server (`process.env.GEMINI_API_KEY`) and is never leaked to the client bundle.
- In Google Cloud Run, secrets should be injected via Secret Manager environment variables.

---

## Environment Configuration

Create a `.env` file (or configure environment variables in Cloud Run / Google AI Studio):

```env
# GEMINI_API_KEY: Required for Gemini AI API calls.
GEMINI_API_KEY="your-gemini-api-key"

# APP_URL: The URL where this applet is hosted.
APP_URL="https://your-service-url.run.app"
```

Firebase credentials are read from `firebase-applet-config.json` at the root of the project.

---

## Development & Local Testing

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The application will start on `http://localhost:3000`.

3. **Deploy Firestore Security Rules**:
   Ensure `firestore.rules` is deployed using Firebase CLI or the platform deployment tool:
   ```bash
   firebase deploy --only firestore:rules
   ```

4. **Run Linter / Type Check**:
   ```bash
   npm run lint
   ```

---

## Cloud Run Deployment

1. **Build Step**:
   The production build bundles the frontend assets via Vite and packages `server.ts` into CommonJS `dist/server.cjs`:
   ```bash
   npm run build
   ```

2. **Start Command**:
   ```bash
   npm start
   ```
   This runs `node dist/server.cjs` listening on `0.0.0.0:3000`.

3. **Cloud Run Container Execution**:
   - The container port is `3000`.
   - `NODE_ENV=production` serves static files from `dist/` and proxies `/api/*` endpoints.
   - Configure `GEMINI_API_KEY` in Cloud Run Service Configuration (Environment Variables or Secret Manager).

## Cloud Run Challenge Verification Label

After the application is deployed to Cloud Run, the following mandatory Hack2Skill verification label must be applied to the Cloud Run service:

`dev-tutorial=cloud-run-ai-challenge`

Apply the label using the Google Cloud CLI (`gcloud`):

```bash
gcloud run services update <SERVICE_NAME> \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=<REGION>
```

- `<SERVICE_NAME>` must be replaced with the actual deployed Cloud Run service name.
- `<REGION>` must be replaced with the actual Cloud Run deployment region.
- This label is required for Hack2Skill automated verification of the Gen AI Academy Cloud Run AI Challenge submission.

---

## Original Ideathon Enhancement

### Summarise My Learning + Next Action

"Summarise My Learning + Next Action" uses Gemini to analyze the authenticated user's recent learning journal and synthesize actionable insights across three core areas:

1. **Learning Summary**: A concise, structured overview of key insights and takeaways acquired during the session.
2. **Concept to Revise**: Pinpoints the specific technical concept or nuance that warrants targeted review or reinforcement.
3. **Next Action for Tomorrow**: Formulates a concrete, actionable learning challenge or experiment to undertake the following day.

All generated summaries are stored privately in Google Cloud Firestore under the authenticated user's UID (`/users/{userId}/summaries/{summaryId}`), ensuring absolute data privacy and strict user isolation.
