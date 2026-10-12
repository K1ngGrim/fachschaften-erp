# Fachschaften ERP

A small ERP for student councils (*Fachschaften*). It keeps track of the
inventory a student council sells, such as drinks and snacks, and of the money
that goes with it.

## Features

- **Inventory:** articles, article types with custom fields, suppliers, stock
  levels with minimum quantities, and stock corrections
- **Deliveries:** incoming goods with purchase prices, which update the stock
- **Finance:** income and expense bookings split by tax area (non-profit area,
  purpose-related operation, commercial operation), booking categories, cash
  books with transfers and closing, and recording cash income from sales
- **Dashboard** with stock value, articles below their minimum quantity, cash on
  hand and the yearly balance
- **Users and permissions:** invitation by email, roles with read and write
  permissions per area, optional two-factor authentication (TOTP), and a
  configurable password policy

The user interface is in German.

## Tech stack

| Part | Technology |
| --- | --- |
| Backend | ASP.NET Core (.NET 10), Entity Framework Core, ASP.NET Core Identity |
| Database | PostgreSQL |
| Frontend | Angular 21, Angular Material, Bootstrap utilities |
| API client | Generated from the OpenAPI document with openapi-generator |

## Repository layout

```
deploy/                    Docker Compose setup for production, see deploy/README.md
docker/                    PostgreSQL for local development
src/
  Fachschaften-ERP.Api/    ASP.NET Core API, migrations, Dockerfile
  Fachschaften-ERP.Models/ EF Core entities and DbContext
  erp-ui/                  Angular frontend, Dockerfile, nginx config
    projects/api/          Generated API client (do not edit by hand)
```

## Running it

To run Fachschaften ERP on a server, use the Docker Compose setup in
[`deploy/`](deploy/README.md). It covers the configuration, email delivery,
HTTPS, backups and updates.

## Development

### Prerequisites

- .NET SDK 10
- Node.js 22 LTS and npm
- Docker, for the development database and for regenerating the API client

### 1. Database

```bash
cd docker
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with user and password `postgres`.

### 2. API

```bash
dotnet run --project src/Fachschaften-ERP.Api --launch-profile http
```

The API listens on `http://localhost:5200` and applies migrations on startup.
Swagger UI is available at `http://localhost:5200/swagger` in development.

In development, the initial admin account is taken from `Seed` in
`src/Fachschaften-ERP.Api/appsettings.Development.json`. If that password does
not meet the password policy, a random one is generated and logged instead. The
admin has to change the password on first login. Development also seeds demo
data.

Secrets such as Mailjet keys belong in user secrets, not in `appsettings*.json`:

```bash
dotnet user-secrets set "Email:Mailjet:ApiKey" "<key>" --project src/Fachschaften-ERP.Api
```

### 3. Frontend

```bash
cd src/erp-ui
npm install
npm start
```

The app runs on `http://localhost:4200` and proxies `/api` to the API on port 5200
(see `proxy.conf.json`).

### Regenerating the API client

After changing controllers or DTOs, start the API and regenerate the TypeScript
client. The generator runs in Docker.

```bash
cd src/erp-ui
npm run gen-api
```

### Adding a migration

```bash
dotnet ef migrations add <Name> --project src/Fachschaften-ERP.Api
```

## Permissions

Every API endpoint requires a logged-in user, except login, accepting an
invitation and reading the password policy. Endpoints additionally check a
permission such as `finance.canread` or `inventory.canwrite`. Permissions are
assigned to roles. The built-in `Admin` role always has all of them. The
frontend hides navigation entries and routes the user has no permission for.

## License

Fachschaften ERP is released under the [MIT License](LICENSE).
