# TEÑ BILIM · Тең Білім

A free learning platform for school students, with Kazakh, Russian and English interfaces and lesson content. This release adds a Node.js backend, persistent SQLite records, role-based accounts, and a server-side OpenAI tutor connection.

## Docker Compose setup on your VM

From your project directory, prepare the server-only configuration. Create `.env` only if it does not already exist; keep an existing file so credentials and settings are preserved:

```bash
if [ ! -e .env ]; then cp .env.example .env; fi
chmod 600 .env
nano .env
```

Set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` (12-128 characters) for the first administrator. Single-quote a password containing spaces or `$`/`#` in `.env`. Set `APP_ORIGIN` to the exact address students will open, including the scheme and port, for example `http://YOUR_VM_IP:8080`; replace `YOUR_VM_IP` with your actual address. Keep `COOKIE_SECURE=false` for this HTTP development address, or use the HTTPS settings below for a public deployment. Add your own `OPENAI_API_KEY` if you want the live tutor, otherwise leave it empty. Keep both the administrator password and API key private in the server's `.env`; never paste them into chat, frontend JavaScript, or GitHub.

Build and launch with Docker Compose:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 web
```

Use `sudo docker ...` if your VM requires it. Open `http://YOUR_VM_IP:8080`. Log in with the administrator credentials from `.env`. Admin creation happens during startup; there is no built-in password. Changing the bootstrap password variable is not a password reset for an existing account.

The named `tenbilim-data` volume retains accounts, sessions, progress and assignments across container rebuilds. Do not delete that volume when updating. This release replaces the old static Nginx container, so rebuilding is required.

## Local development

Requires Node.js **22.14 or newer** with built-in `node:sqlite`. There are no npm dependencies to install.

```bash
if [ ! -e .env ]; then cp .env.example .env; fi
```

For local development, set `APP_ORIGIN=http://localhost:3000`, `HOST=127.0.0.1`, `PORT=3000`, and your initial admin credentials in `.env`. Then:

```bash
npm start
```

Open http://localhost:3000. The startup script reads `.env` when present. SQLite files live in `./data` by default. Some Node 22 versions print an experimental SQLite warning; this is not a startup error.

```bash
npm test
npm run build
```

`npm run build` exports frontend files into `dist/` for asset inspection. **A static-only deployment does not provide accounts, server progress or live AI.** Deploy the full Node service for this release, not only `dist/`.

## Accounts and permissions

| Role | Capabilities |
| --- | --- |
| Student | Self-register, read lessons, complete tests, save personal progress and study plans, view assigned lessons, and use the tutor when configured. |
| Teacher | View progress for students assigned to them by an admin and assign lessons to those students. |
| Admin | Create student/teacher/admin accounts, change roles, disable accounts, and assign students to teachers. |

Public registration creates students only. Teachers and administrators are provisioned by an administrator. Role checks are enforced by the server. The last active administrator cannot be disabled or demoted. Passwords are hashed; sessions use HttpOnly cookies and state-changing requests require CSRF protection.

The original guest demo progress remains in its browser. It is not automatically imported into a registered student's account. Account progress is stored in SQLite and available on another device after login. Quizzes are scored on the server. The bundled questions remain learning material rather than a protected examination bank.

## OpenAI tutor configuration

Set these variables in the server's `.env`:

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

The placeholder above is not a valid key. Replace it locally on the server. After changing `.env`, recreate the service:

```bash
docker compose up -d --force-recreate
```

For direct Node development, restart `npm start`. The browser sends messages to the app backend; only the backend calls OpenAI. The API key is never returned to the client. A configured API key requires API access and billing/quota on the provider account; an ordinary ChatGPT subscription does not supply the app's API credits.

The tutor uses input/output moderation, the Responses API, request limits and bounded output. `AI_DAILY_LIMIT` defaults to 50 requests per account per day, including failed provider requests, and is retained in SQLite until the next UTC day. An additional short-window limit is held in memory and resets when the server restarts. Configure provider-side project budgets as well. It sends the question and recent chat context to OpenAI; do not include personal or sensitive student information in prompts. AI replies may be incorrect and should be checked against course materials. Without a configured key, the app indicates the tutor is unavailable rather than pretending a live model answered. A real API key is required to verify end-to-end provider connectivity; no key is bundled.

Before a school-wide rollout, the operator must configure appropriate access and consent for the students' ages and applicable requirements. OpenAI's [under-18 guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance) requires Zero Data Retention before processing personal data of children under 13 or the applicable age of digital consent. `store: false` is not Zero Data Retention. This starter does not implement an age-verification or parental-consent workflow.

## HTTPS production setup

1. Set a domain and TLS certificate in your existing reverse proxy.
2. Set `APP_ORIGIN=https://your-domain.example` and `COOKIE_SECURE=true` in `.env`.
3. Change the Compose port mapping to `127.0.0.1:8080:3000` when the reverse proxy is on the same host.
4. Use the `location` snippet in `deploy/nginx.conf` inside your proxy's HTTPS server block. It forwards both frontend pages and `/api/` to the Node service. Configure TLS outside that snippet.
5. If using the proxy, set `TRUSTED_PROXY_IPS` to its exact peer address as seen by Node; see below.
6. Recreate the service after environment changes.

The origin must match exactly: scheme, hostname and non-default port. A wrong `APP_ORIGIN` causes mutation requests to fail intentionally. Do not point Nginx at a public copy of the entire source directory. Do not publish the SQLite files or `.env`. The container runs as the unprivileged `node` user and uses its writable data volume.

`TRUSTED_PROXY_IPS` is empty by default, so forwarded client addresses are ignored. For a directly connected same-host proxy and native Node process, the peer may be `127.0.0.1` or `::1`. In Docker it is commonly the container network's bridge gateway. Verify the actual network peer for your deployment; do not copy a guessed bridge address. Supply only exact trusted peer IPs, separated by commas (no wildcards or CIDR ranges). IPv4-mapped IPv6 peers are normalized to IPv4. Only when the socket peer matches this list does the server use the last `X-Forwarded-For` address, if valid, for IP rate limits. The supplied Nginx snippet overwrites that header with its actual client peer.

Before enabling proxy trust, ensure public clients cannot reach the Node port directly: use the loopback-only port mapping above for same-host Nginx, or an isolated private network accessible only to your proxy. Otherwise clients could bypass proxy controls. Without proxy trust, students behind the same proxy share one IP-based login/registration limit. If additional proxies/CDNs are present, configure their trusted real-client handling explicitly; do not trust arbitrary forwarding headers.

Registration is limited to 60 requests per hour per client IP. Login allows 200 requests per 15 minutes per IP and 10 per email address. These temporary limits reset on server restart. The daily per-user AI quota is stored in SQLite, survives restarts, and resets at midnight UTC; attempted requests, including provider errors or moderated messages, count toward it.

Back up the database volume regularly. For a simple consistent backup, stop this service briefly and copy the whole data directory, including SQLite sidecar files, then restart it. Restore into a volume writable by container UID 1000. Single-instance SQLite is intended for a modest deployment; use a managed database strategy before running multiple independent replicas.

## Included learning content

- Responsive blue dashboard, keyboard focus indicators, course navigation, search and language switching.
- Mathematics, computer science and Kazakhstan history.
- Six translated text lessons and nine original practice questions with explanations.
- Study plans, completion tracking, weekly goal and test history.
- Account management, scoped teacher views and lesson assignments.

This is a small UNT-style practice set, not an official exam or complete school curriculum. Video lessons and an in-browser content authoring system are not included. Educators should review and expand learning content before broad student use. The app does not yet include email verification, email delivery or self-service password recovery.

## GitHub and updates

Commit project source and `.env.example`. The real `.env`, database files and local data directory are excluded by `.gitignore` and from the container build context.

```bash
git status
git add .
git commit -m "Add accounts, backend and AI tutor"
git push
```

After pulling updates on the server, rebuild and check the service:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 web
```

Keep the existing `.env` file and `tenbilim-data` volume. Do not copy `.env.example` over your settings or run `docker compose down -v` during an update; that command deletes the data volume. Never commit a real API key; if one was exposed, revoke it and create a replacement.

## Project structure

```text
src/app.js          Dashboard, learning flows and API integration
src/accounts.js     Translated authentication and role management views
src/content.js      Translated lessons, questions and scoring data
src/i18n.js         Interface translations
server.mjs          HTTP server, static routes and API entry point
backend/            Database, authentication and protected operations
styles.css          Responsive styling and keyboard focus behavior
assets/             Vector branding
scripts/build.mjs   Frontend asset export
test/               Automated checks
deploy/nginx.conf   HTTPS reverse-proxy location example
.env.example        Server configuration template, without secrets
```

Edit lesson and question content in `src/content.js`; provide `kk`, `ru` and `en` values for every localized field. Question answers are zero-based option indices. Keep lesson IDs stable so stored progress and assignments remain valid. Run `npm test` after changes.
