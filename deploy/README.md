# Deploying Fachschaften ERP with Docker Compose

This folder contains everything needed to run Fachschaften ERP on a single host
with Docker Compose.

```
            ┌─────────────────────────── docker network ───────────────────────────┐
 browser ──►│ web (nginx, :80) ──/api/──► api (.NET, :8080) ──► db (PostgreSQL 17) │
            │   serves the Angular app                                             │
            └──────────────────────────────────────────────────────────────────────┘
```

- **web** serves the frontend and forwards every request under `/api/` to the
  API. It is the only service with a published port. Because the frontend and
  the API share one origin, the login cookie works without any CORS setup.
- **api** runs the ASP.NET Core backend. On startup it applies database
  migrations and, on the very first start, creates the initial admin account.
- **db** is PostgreSQL. It is not reachable from outside the Docker network.

## Requirements

- Docker Engine 24 or newer with the Compose plugin (`docker compose version`)
- About 2 GB of free disk space for the images and the build

## Quick start

```bash
cd deploy
cp .env.example .env
```

Edit `.env` and set at least:

- `POSTGRES_PASSWORD`: a long random value, for example from `openssl rand -base64 32`
- `APP_BASE_URL`: the URL users open in their browser (used in invitation emails)

Then build and start the stack:

```bash
docker compose up -d --build
```

The app is now available at `http://<host>:8080` (or the `HTTP_PORT` you set).

### First login

On the first start, with an empty database, the API creates an admin account.
If you did not set `ADMIN_INITIAL_PASSWORD`, a random password is generated and
written to the API log once:

```bash
docker compose logs api | grep "initial admin"
```

Log in with the user name from `ADMIN_USERNAME` (default `admin`) and that
password. You are asked to choose your own password before you can use the app.
Afterwards, invite further users under **Benutzer**. Invitations are sent by
email, so configure the email settings below before you rely on them.

## Configuration

All settings are read from `.env`. The table lists every variable used by
`docker-compose.yml`.

| Variable | Default | Description |
| --- | --- | --- |
| `APP_BASE_URL` | – (required) | Public URL of the app. Used to build invitation links. |
| `HTTP_PORT` | `8080` | Host port the web container is published on. |
| `HTTP_BIND` | `0.0.0.0` | Host interface to bind. Use `127.0.0.1` behind a local reverse proxy. |
| `POSTGRES_DB` | `erp` | Database name. |
| `POSTGRES_USER` | `erp` | Database user. |
| `POSTGRES_PASSWORD` | – (required) | Database password. |
| `ADMIN_USERNAME` | `admin` | User name of the initial admin. |
| `ADMIN_EMAIL` | empty | Optional email address of the initial admin. |
| `ADMIN_INITIAL_PASSWORD` | empty | Initial admin password. Empty means a random one is generated and logged. |
| `EMAIL_PROVIDER` | `Dev` | `Dev` writes emails to the API log only. `Mailjet` sends them via Mailjet. |
| `EMAIL_FROM_ADDRESS` | empty | Sender address. Required for every provider except `Dev`. |
| `EMAIL_FROM_NAME` | `Fachschaften ERP` | Sender display name. |
| `MAILJET_API_KEY` | empty | Mailjet API key. Required when `EMAIL_PROVIDER=Mailjet`. |
| `MAILJET_SECRET_KEY` | empty | Mailjet secret key. Required when `EMAIL_PROVIDER=Mailjet`. |
| `MAILJET_SANDBOX_MODE` | `false` | `true` makes Mailjet validate emails without delivering them. |
| `IMAGE_TAG` | `latest` | Tag for the locally built images. |

The initial admin settings only take effect when the database contains no users
yet. Changing them later has no effect.

If the email configuration is incomplete (for example `EMAIL_PROVIDER=Mailjet`
without keys), the API refuses to start and names the missing setting in its log.

### Email with Mailjet

1. Create API credentials in the Mailjet dashboard under *Account settings → API keys*.
2. Add and validate the sender address (or its domain) under *Senders & domains*.
   Mailjet rejects emails from unvalidated senders.
3. Set the variables in `.env`:

   ```dotenv
   EMAIL_PROVIDER=Mailjet
   EMAIL_FROM_ADDRESS=noreply@your-domain.example
   MAILJET_API_KEY=...
   MAILJET_SECRET_KEY=...
   ```

4. Apply the change with `docker compose up -d`.

To test the setup without delivering mail, set `MAILJET_SANDBOX_MODE=true`.
If Mailjet rejects an invitation email, the API answers with an error and rolls
the invitation back, so you can send it again once the configuration is fixed.
Details about the rejection are in the API log.

Other providers can be added in the backend by implementing `IEmailSender`. See
`src/Fachschaften-ERP.Api/Services/Email/EmailServiceCollectionExtensions.cs`.

### Password policy

By default, passwords need at least 10 characters with an upper case letter, a
lower case letter and a digit, and at least 4 different characters. The frontend
reads the active rules from the API, so you only change them in one place.

To change the rules, create a `docker-compose.override.yml` next to
`docker-compose.yml`. Compose picks it up automatically:

```yaml
services:
  api:
    environment:
      Identity__Password__RequiredLength: "12"
      Identity__Password__RequireNonAlphanumeric: "true"
```

Available keys are `RequiredLength`, `RequiredUniqueChars`, `RequireLowercase`,
`RequireUppercase`, `RequireDigit` and `RequireNonAlphanumeric`.

## HTTPS

The stack itself speaks plain HTTP. For anything beyond a local test, put a
reverse proxy with TLS in front of it, for example Caddy, Traefik or nginx.

1. Bind the web container to localhost only and set the public HTTPS URL in `.env`:

   ```dotenv
   HTTP_BIND=127.0.0.1
   HTTP_PORT=8080
   APP_BASE_URL=https://erp.your-domain.example
   ```

2. Point the reverse proxy at `http://127.0.0.1:8080` and make sure it sends the
   `X-Forwarded-Proto` header. Caddy does this automatically:

   ```caddy
   erp.your-domain.example {
       reverse_proxy 127.0.0.1:8080
   }
   ```

The web container passes `X-Forwarded-Proto` on to the API, so the API knows the
original request used HTTPS.

## Operations

### Logs

```bash
docker compose logs -f api
docker compose logs -f web
```

### Updating

```bash
git pull
docker compose up -d --build
```

Database migrations run automatically when the API starts. Take a backup before
updating.

### Backup and restore

The data lives in two named volumes:

- `db-data`: the PostgreSQL database
- `api-keys`: the keys that sign login cookies and invitation links and that
  encrypt the backup passwords stored in the settings. If this volume is lost,
  every user is logged out, open invitations become invalid and the backup
  passwords have to be entered again, but no data is lost.

#### Automatic backups to WebDAV

Under **Einstellungen → Backup** the app backs itself up once a day to a WebDAV
folder, for example in a Nextcloud
(`https://cloud.example.org/remote.php/dav/files/<user>/Backups/ERP/`, use an
app password). Each backup is a ZIP file `erp-backup-<date>_<time>.zip` with:

- `database.dump`: the complete database (`pg_dump`, custom format)
- `csv/`: readable copies of the data for Excel (optional)
- `wiki/`: the wiki pages as Markdown (optional)
- `LIESMICH.txt`: what is inside and how to restore it

With a backup password the ZIP is encrypted with AES-256. Open it with 7-Zip,
Keka or `bsdtar`; the built-in unzip tools of macOS and Windows cannot. Older
backups beyond the configured number are deleted from the folder. A missed
backup (server was off) is made up as soon as the app is running again.

Confidential tables are end-to-end encrypted and therefore only contained in
`database.dump`, never in the CSV files. After a restore they can be read again
with a vault that has access or with the recovery key.

The schedule uses the time zone `Europe/Berlin`. Set `Backup__TimeZone` on the
`api` service to change it.

#### Manual backup

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > erp-$(date +%F).dump
```

#### Restore

1. Unpack the backup (skip for a manual dump):

   ```bash
   7z x erp-backup-2026-01-31_0300.zip            # asks for the backup password
   # or: bsdtar -xf erp-backup-2026-01-31_0300.zip --passphrase '<password>'
   ```

2. Restore the database into the running stack and restart the API:

   ```bash
   docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < database.dump
   docker compose restart api
   ```

`--clean` replaces the current data. To try a backup first, restore it into a
fresh stack on another machine.

### Stopping

```bash
docker compose down       # stops the stack, keeps all data
docker compose down -v    # also deletes the volumes, so all data is gone
```

## Troubleshooting

- **The API keeps restarting.** Check `docker compose logs api`. The usual causes
  are a missing `POSTGRES_PASSWORD` or an incomplete email configuration.
- **No initial admin password in the log.** The admin is only created when the
  database has no users. If you started the stack before, the password was logged
  on that first start.
- **Invitation links point to the wrong host.** Set `APP_BASE_URL` to the public
  URL and run `docker compose up -d`.
- **Everyone is logged out after an update.** The `api-keys` volume was removed
  or recreated. Keep it between updates.
