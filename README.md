# TEÑ BILIM · Тең Білім

A free learning platform for school students, with Kazakh, Russian and English interfaces and lesson content. It includes a Node.js backend, persistent SQLite records, role-based accounts, and a tutor that can use OpenAI or a local Ollama model.

## Docker Compose setup on your VM

For the host-installed Ollama/Qwen option, follow [Local tutor: Ollama Snap + Qwen3-1.7B Q8_0](#local-tutor-ollama-snap--qwen3-17b-q8_0) and use its standalone Compose file. The commands in this section use the default bridged container configuration.

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

## Local tutor: Ollama Snap + Qwen3-1.7B Q8_0

This setup assumes **Ollama and Docker Engine run on the same Linux machine**. If Docker runs inside a VM, install Ollama in that VM for these loopback addresses to work. The VM needs GPU passthrough to use a physical RX 580; otherwise Ollama may use the CPU. No GPU device needs to be passed into the TenOku web container because inference runs in the host's Ollama service.

### 1. Start your existing Snap installation and download the model

```bash
snap services ollama
sudo snap start --enable ollama
ollama --version
ollama pull qwen3:1.7b-q8_0
ollama run --think=false qwen3:1.7b-q8_0 "Explain 2 + 2 in one short sentence."
ollama ps
```

The exact model tag is [`qwen3:1.7b-q8_0`](https://ollama.com/library/qwen3:1.7b-q8_0), with a download of about 2.2 GB. It needs additional memory for conversation context and inference. Internet access is needed to download the model; generation with this downloaded model does not require OpenAI credits or an OpenAI key.

Look at `PROCESSOR` in `ollama ps` immediately after the test: `100% GPU` indicates GPU placement, `100% CPU` indicates CPU inference, and a split indicates partial GPU offload. A working response alone does not prove the RX 580 is being used. See the [Ollama FAQ](https://docs.ollama.com/faq#how-can-i-tell-if-my-model-was-loaded-onto-the-gpu).

The RX 580 is not on Ollama's current supported ROCm list. [Ollama documents Vulkan support](https://docs.ollama.com/gpu#vulkan-gpu-support), but whether your installed Snap includes a usable Vulkan backend and can access this card must be checked on your machine. CPU inference is sufficient to test the app connection first. This project has not been benchmarked on your GPU.

If host `vulkaninfo --summary` detects the RX 580 but Snap's startup logs show `OLLAMA_VULKAN:true`, a Vulkan library directory, and `initial_count=0`, Vulkan is already enabled: enabling it again will not resolve that discovery failure. CUDA library errors are NVIDIA backend probes, not instructions to install CUDA for an AMD card. The difference between host and Snap detection points to the packaged runtime or its environment; it does not establish the exact cause.

You can test the [official Docker image's Vulkan backend](https://docs.ollama.com/docker#vulkan-support) separately. These commands assume the Snap log confirms the model directory `/var/snap/ollama/common/models`. They expose only loopback port 11435, leave Snap on 11434, and mount its existing models read-only. The Docker image must be downloaded, but the model is reused. Vulkan uses `/dev/dri`; this test does not require a ROCm `/dev/kfd` device.

```bash
sudo docker run -d --name tenoku-ollama-vulkan --pull=always \
  --device /dev/dri \
  -p 127.0.0.1:11435:11434 \
  -e OLLAMA_HOST=0.0.0.0:11434 \
  -e OLLAMA_VULKAN=1 \
  -e OLLAMA_NO_CLOUD=1 \
  -e OLLAMA_NOPRUNE=1 \
  -e OLLAMA_CONTEXT_LENGTH=4096 \
  -e OLLAMA_MODELS=/models \
  --mount type=bind,source=/var/snap/ollama/common/models,target=/models,readonly \
  docker.io/ollama/ollama:latest

sudo docker exec tenoku-ollama-vulkan ollama run --think=false qwen3:1.7b-q8_0 "Say hello briefly."
sudo docker exec tenoku-ollama-vulkan ollama ps
sudo docker logs --tail=100 tenoku-ollama-vulkan
```

Inspect `ollama ps` and the logs for the actual RX 580 and GPU offload. A successful answer alone is not proof of acceleration. If the container is not ready yet, inspect its logs before retrying. A startup error about a read-only model directory means this runtime wants to modify the store; keep the original mount read-only and use a separate copy for further testing. Do not pull or delete models through this read-only test service.

If GPU inference succeeds, set `OLLAMA_BASE_URL=http://127.0.0.1:11435` in TenOku's existing `.env`, then recreate the web service with `sudo docker compose -f compose.ollama.yaml up -d --force-recreate web` and run its AI diagnostic. This connection assumes Docker Engine and TenOku are on the same Linux host. The test container has no restart policy; it is not yet a permanent deployment. Stop it with `sudo docker stop tenoku-ollama-vulkan` when finished. Use `sudo docker start tenoku-ollama-vulkan` to reuse it; a second `docker run` with the same name will conflict. Removing this test container does not remove the Snap's read-only bind-mounted models. If the app was pointed at port 11435, restore its original URL and recreate it before stopping the test.

Ollama's [CLI thinking controls](https://ollama.com/blog/thinking) include the explicit flag `--think=false`. A `/no_think` prompt is not a reliable substitute in every runtime. TenOku already sends `think: false` in its [native API requests](https://docs.ollama.com/capabilities/thinking).

For a failed model download, service start, or CPU-only result, collect these diagnostics without posting your `.env`:

```bash
snap list ollama
snap connections ollama
sudo snap logs ollama -n=50
curl -fsS http://127.0.0.1:11434/api/version
ss -ltn '( sport = :11434 )'
```

Keep Ollama bound to loopback (`127.0.0.1` or `::1`). If it is listening on `0.0.0.0` or `[::]`, restrict it before using student data. The [Snap package](https://snapcraft.io/ollama) is separately packaged, so use that package's supported settings rather than assuming a standard `ollama.service` unit or guessing `snap set` option names. Setting `OLLAMA_HOST` in TenOku's `.env` would not change the already-running Snap service. Do not publish port 11434 or use wildcard browser origins for this setup.

### 2. Configure the existing TenOku `.env`

Keep the current administrator credentials, database settings and `APP_ORIGIN`. Add or update:

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:1.7b-q8_0
OLLAMA_TIMEOUT_MS=120000
```

`OLLAMA_BASE_URL` is the server root, without `/api/chat`, credentials, query parameters or fragments. It is controlled by the server operator, never by students. An existing `OPENAI_API_KEY` is ignored in Ollama mode; there is no automatic cloud fallback. For native Node development on the same machine, these values also work with `npm start`.

### 3. Rebuild using the Linux Ollama Compose file

From the same project directory and Compose project name used for your existing deployment:

```bash
sudo docker compose -f compose.ollama.yaml up -d --build
sudo docker compose -f compose.ollama.yaml ps
sudo docker compose -f compose.ollama.yaml exec web npm run check:ai
```

Use **only** `-f compose.ollama.yaml` for this configuration; it is a complete standalone file, not an override to merge with `compose.yaml`. It retains the `web` service and `tenbilim-data` volume. If your earlier commands used `-p`, keep that same project name. Do not use `down -v` or copy the example over your existing `.env`.

The web service uses [Linux host networking](https://docs.docker.com/engine/network/drivers/host/) to reach the Snap service on loopback. It listens on port **8080**, so the browser address and `APP_ORIGIN` can stay the same. There is no `ports:` mapping in this file. Docker shares the host network namespace in this mode; the ordinary bridged-container network isolation no longer applies. Ollama's port stays private.

If a reverse proxy is already serving your site, change `HOST` in `compose.ollama.yaml` to `127.0.0.1` so only the proxy can reach port 8080. Keep your HTTPS origin and cookie settings. The port-mapping instruction in the HTTPS section below applies to the default `compose.yaml`; host networking uses this bind address instead.

Continue using `-f compose.ollama.yaml` for subsequent updates, logs, diagnostics and restarts. A plain `docker compose up` selects the default bridged configuration again, where `127.0.0.1` refers to the web container rather than the host's Ollama service.

### Local tutor behavior and limits

The backend sends requests only to the configured Ollama endpoint. It uses the selected local model for an input safety check, the tutor answer and an output safety check. Failed or malformed checks withhold the answer. These small-model checks are **not equivalent to a dedicated moderation service** and can make mistakes; teacher review and testing in all three languages are necessary before broad student use.

The app asks for non-thinking responses, limits context to 4096 tokens and answer generation to 700 tokens, and keeps recent history bounded. Only one local tutor request runs at a time per backend instance; simultaneous requests receive a busy message. Existing sign-in, CSRF protection, per-account daily limits and escaped answer rendering remain in place. Three local model calls per answer can take time on an older GPU or CPU. `OLLAMA_TIMEOUT_MS` applies to each call, not the entire three-call exchange.

`npm run check:ai` follows the selected provider using a fixed arithmetic question. In Ollama mode it checks local input safety, generation and output safety without an OpenAI request or student data. It does not prove that the model uses your GPU or that all educational answers are accurate.

| Diagnostic code | What to check |
| --- | --- |
| `AI_LOCAL_UNAVAILABLE` | Start the Snap service; check the host URL and the selected Compose file. |
| `AI_LOCAL_MODEL_MISSING` | Run `ollama pull qwen3:1.7b-q8_0`; match `OLLAMA_MODEL` to the downloaded tag. |
| `AI_LOCAL_BUSY` | Wait for the current question to finish, then retry. |
| `AI_TIMEOUT` | Check service logs and CPU/GPU placement; the first model load can be slower. |
| `AI_LOCAL_INCOMPLETE` | Ask a shorter question; the local model hit its response limit. |
| `AI_LOCAL_SAFETY_UNAVAILABLE` | The local safety check did not return a valid decision; no answer was released. Check model compatibility and retry. |
| `AI_INVALID_RESPONSE` | Check that the installed Ollama version supports this model, JSON schema output and `think: false`. |

## OpenAI tutor configuration

Set these variables in the server's `.env`:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

The placeholder above is not a valid key. Replace it locally on the server. After changing `.env`, recreate the service:

```bash
docker compose up -d --force-recreate
```

For direct Node development, restart `npm start`. The browser sends messages to the app backend; only the backend calls OpenAI. The API key is never returned to the client. A configured API key requires API access and available credits or billing/quota on the provider account. Check the API billing dashboard separately from ChatGPT usage.

The tutor uses input/output moderation, the Responses API, request limits and bounded output. `AI_DAILY_LIMIT` defaults to 50 requests per account per day, including failed provider requests, and is retained in SQLite until the next UTC day. An additional short-window limit is held in memory and resets when the server restarts. Configure provider-side project budgets as well. It sends the question and recent chat context to OpenAI; do not include personal or sensitive student information in prompts. AI replies may be incorrect and should be checked against course materials. Without a configured key, the app indicates the tutor is unavailable rather than pretending a live model answered. A real API key is required to verify end-to-end provider connectivity; no key is bundled.

Before a school-wide rollout, the operator must configure appropriate access and consent for the students' ages and applicable requirements. OpenAI's [under-18 guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance) requires Zero Data Retention before processing personal data of children under 13 or the applicable age of digital consent. `store: false` is not Zero Data Retention. This starter does not implement an age-verification or parental-consent workflow.

### Troubleshooting a failed AI request

First confirm that the running container received a key, without displaying it:

```bash
docker compose exec web node -e "console.log('OPENAI_API_KEY configured:', Boolean(process.env.OPENAI_API_KEY?.trim()))"
```

If this prints `false`, edit the existing server `.env` and recreate the container. A plain `docker compose restart` does not reload changed environment variables. Do not replace an existing `.env` with the example or post the key in diagnostic output.

After updating the project source, build the image containing the diagnostic script and reload the configuration:

```bash
docker compose up -d --build --force-recreate web
docker compose exec web node scripts/check-ai.mjs
```

For direct Node development, run `npm run check:ai`. This explicit diagnostic sends only a fixed arithmetic prompt, then checks input moderation, text generation, and output moderation. It consumes a small amount of API usage and does not print the API key, generated answer, or raw provider errors. It exits successfully only when all three checks pass. It does not use student data or create a student account.

| Diagnostic code | What to check |
| --- | --- |
| `AI_NOT_CONFIGURED` | Set the server key and recreate the container. |
| `AI_AUTH_FAILED` | The key is invalid, revoked, or not accepted. Replace it privately on the server. |
| `AI_QUOTA_EXCEEDED` | Check API billing, available credits, expiry dates and project quota. |
| `AI_ACCESS_DENIED` | Check that the key's project has permission to call Responses and Moderations. |
| `AI_MODEL_UNAVAILABLE` | Select an `OPENAI_MODEL` available to that API project. |
| `AI_RATE_LIMITED` | Wait and retry; check request/token limits. |
| `AI_CONNECTION_FAILED` / `AI_TIMEOUT` | Check VM DNS, certificates, firewall and outbound HTTPS access to `api.openai.com`. |
| `AI_BAD_REQUEST` / `AI_INVALID_RESPONSE` | Check model compatibility, update the application, and check provider service status. |
| `AI_INCOMPLETE_RESPONSE` | OpenAI was reachable but did not finish the text. Check model compatibility and output-token requirements; this is not an invalid-key error. |
| `AI_CONTENT_BLOCKED` | The moderation check blocked the diagnostic; no generated content is logged. |
| `AI_MODEL_CONFIG_INVALID` | Correct the model identifier in `.env`; no invalid value is printed. |
| `AI_UNAVAILABLE` | Retry later; provide only the safe diagnostic code when requesting support. |

If the diagnostic passes but the browser still fails, check the browser's displayed error code, sign-in session, and `APP_ORIGIN` configuration. The diagnostic isolates provider access; it does not bypass or validate the application's account, CSRF, or per-user quota checks.

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

For the Linux Ollama setup, include `-f compose.ollama.yaml` in each command above so the service keeps its host-network connection to Ollama.

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
scripts/check-ai.mjs Safe operator-only AI connectivity diagnostic
test/               Automated checks
deploy/nginx.conf   HTTPS reverse-proxy location example
.env.example        Server configuration template, without secrets
```

Edit lesson and question content in `src/content.js`; provide `kk`, `ru` and `en` values for every localized field. Question answers are zero-based option indices. Keep lesson IDs stable so stored progress and assignments remain valid. Run `npm test` after changes.
