# API Sample Test

## Result

![terminal-screenshot](./Screenshot_20250518_033021.png)

## Debrief

### (1) Code Quality & Readability
- Logging was standardized with contextual tags for better traceability.
- Dense expressions (e.g., expiration calculation) could be replaced with named constants.
- Utility functions lack input validation; defensive checks would improve robustness.
- Some `.then()` chains should be refactored to `async/await` for clarity.
- Unused variables and minimal commenting reduce code clarity.
- Functions like `processContacts`, `processCompanies`, and `processMeetings` contain repetitive logic.
- A helper like `fetchWithPagination()` is suggested to centralize shared patterns.

### (2) Project Architecture
- Original implementation was monolithic (`worker.js`), limiting scalability and testability.
- Refactored into modular structure (`worker/`) separating concerns by entity.
- Shared logic (e.g., account lookup, queue management) should be extracted into utilities.
- Project lacks `.nvmrc` or `package.json > engines` and Docker support, which may lead to environment inconsistencies.
- Node.js 23.11.0 was used to complete this task.

### (3) Code Performance
- Original ETL process exceeded 10 minutes due to incorrect date filter operators (`GTQ`, `LTQ`), which were fixed by using `GTE`, `LTE`.
- Meeting ingestion uses `offset` pagination and filters for `type: MEETING`.
- Exponential backoff is implemented but concurrency is absent.
- No caching or pipelining; batching is size-based only.
- Performance could be improved with concurrent entity fetching and enforcing per-request timeouts.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up the environment:
   - Rename `.env.example` to `.env`
   - Fill in required values (e.g., `HUBSPOT_CID`, `HUBSPOT_CS`, `MONGO_URI`)

3. Run the app:
   ```bash
   node app.js
   ```

> Ensure Node.js v23.11.0 or higher is used.

## Project Overview

This project pulls and processes company and contact data from HubSpot's CRM API. Contacts are associated with companies via HubSpot's association API. The system simulates ingestion by building actions in memory without writing to a database. The `Domain` model represents a HockeyStack test account. Only the `hubspot` object in `integrations` is relevant.

The `server.js` file is present but not required for this challenge.

HubSpot requests should complete in under 5 seconds. Longer durations may indicate an implementation issue.

---

> This project used [`ripissue`](https://github.com/cwnt-io/ripissue) to manage issues from the command line.
