# Die Basisimages sind zusätzlich zum Tag per Digest festgenagelt: ein neu
# veröffentlichter Tag verwirft sonst unbemerkt den Build-Cache und baut mitten
# im Deploy alle Schichten neu. Dafür müssen die Digests von Hand aufgefrischt
# werden, sonst fehlen Sicherheitsupdates des Basisimages:
#   docker buildx imagetools inspect mcr.microsoft.com/dotnet/aspnet:10.0 | grep Digest
#   docker buildx imagetools inspect mcr.microsoft.com/dotnet/sdk:10.0 | grep Digest
# Stand: 2026-11-08
FROM mcr.microsoft.com/dotnet/aspnet:10.0@sha256:1a48394b6f29d3a32c79d9edecd4abda0ecbe8776d567dbfc4590ed6979c740c AS base

# Manche Netze (Caching-Proxys, gestörte Verbindungen) liefern die Paketlisten
# beschädigt aus; apt bricht dann mit „At least one invalid signature was
# encountered“ ab, obwohl mit den Schlüsseln alles stimmt. Ohne Pipelining und
# ohne Zwischenspeicher kommen die Dateien sauber an.
RUN printf '%s\n' \
      'Acquire::http::Pipeline-Depth "0";' \
      'Acquire::http::No-Cache "true";' \
      'Acquire::https::Pipeline-Depth "0";' \
      'Acquire::https::No-Cache "true";' \
      'Acquire::BrokenProxy "true";' \
      'Acquire::Retries "3";' \
      > /etc/apt/apt.conf.d/99-robust-downloads

# pg_dump für das Backup. Die Version muss mindestens der des Datenbankservers (postgres:17)
# entsprechen; das Paketarchiv der Distribution hat nur eine ältere, daher das von PostgreSQL.
RUN set -eu; \
    apt_update() { \
      for versuch in 1 2 3; do \
        apt-get update && return 0; \
        echo "apt-get update fehlgeschlagen (Versuch $versuch) – neuer Versuch"; \
        rm -rf /var/lib/apt/lists/*; \
        sleep 5; \
      done; \
      return 1; \
    }; \
    apt_update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg tzdata; \
    install -d /usr/share/postgresql-common/pgdg; \
    curl -fsSL --retry 3 --retry-delay 5 https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg; \
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list; \
    apt_update; \
    apt-get install -y --no-install-recommends postgresql-client-17; \
    apt-get purge -y curl gnupg; \
    apt-get autoremove -y; \
    rm -rf /var/lib/apt/lists/*

# Typst für das Dokumente-Modul (einzelne Binärdatei, passend zur Architektur des Images).
ARG TYPST_VERSION=0.15.1
ARG TARGETARCH
RUN set -eu; \
    apt_update() { \
      for versuch in 1 2 3; do \
        apt-get update && return 0; \
        echo "apt-get update fehlgeschlagen (Versuch $versuch) – neuer Versuch"; \
        rm -rf /var/lib/apt/lists/*; \
        sleep 5; \
      done; \
      return 1; \
    }; \
    apt_update; \
    apt-get install -y --no-install-recommends curl xz-utils; \
    case "${TARGETARCH:-}" in arm64) arch=aarch64 ;; *) arch=x86_64 ;; esac; \
    curl -fsSL --retry 3 --retry-delay 5 \
      "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-${arch}-unknown-linux-musl.tar.xz" \
      | tar -xJ -C /tmp; \
    mv "/tmp/typst-${arch}-unknown-linux-musl/typst" /usr/local/bin/typst; \
    rm -rf "/tmp/typst-${arch}-unknown-linux-musl"; \
    apt-get purge -y curl xz-utils; \
    apt-get autoremove -y; \
    rm -rf /var/lib/apt/lists/*

# Verzeichnis für die Data-Protection-Schlüssel (Volume), muss dem App-Benutzer gehören.
RUN mkdir -p /keys && chown $APP_UID /keys
USER $APP_UID
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0@sha256:212fe4cb74627d5adf9817a4088906ae3edff1bd853bb27565d4b46731efe61e AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["Fachschaften-ERP.Api/Fachschaften-ERP.Api.csproj", "Fachschaften-ERP.Api/"]
COPY ["Fachschaften-ERP.Models/Fachschaften-ERP.Models.csproj", "Fachschaften-ERP.Models/"]
RUN dotnet restore "Fachschaften-ERP.Api/Fachschaften-ERP.Api.csproj"
COPY . .
WORKDIR "/src/Fachschaften-ERP.Api"
RUN dotnet build "./Fachschaften-ERP.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./Fachschaften-ERP.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENV DataProtection__KeysPath=/keys
ENTRYPOINT ["dotnet", "Fachschaften-ERP.Api.dll"]
