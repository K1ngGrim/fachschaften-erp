FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
# pg_dump für das Backup. Die Version muss mindestens der des Datenbankservers (postgres:17)
# entsprechen; das Paketarchiv der Distribution hat nur eine ältere, daher das von PostgreSQL.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg tzdata \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-17 \
    && apt-get purge -y curl gnupg && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*
# Verzeichnis für die Data-Protection-Schlüssel (Volume), muss dem App-Benutzer gehören.
RUN mkdir -p /keys && chown $APP_UID /keys
USER $APP_UID
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
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
