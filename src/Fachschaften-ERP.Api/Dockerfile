FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
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
