ARG FRONTEND_BUILD_IMAGE=mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm
FROM ${FRONTEND_BUILD_IMAGE} AS frontend-build
WORKDIR /src/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src

COPY Lies.Server/Lies.Server.csproj Lies.Server/
RUN dotnet restore Lies.Server/Lies.Server.csproj

COPY Lies.Server/ Lies.Server/
RUN dotnet publish Lies.Server/Lies.Server.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS apphost-build
WORKDIR /src

COPY Lies.AppHost/Lies.AppHost.csproj Lies.AppHost/
COPY Lies.Server/Lies.Server.csproj Lies.Server/
RUN dotnet restore Lies.AppHost/Lies.AppHost.csproj

COPY Lies.AppHost/ Lies.AppHost/
COPY Lies.Server/ Lies.Server/
RUN dotnet build Lies.AppHost/Lies.AppHost.csproj -c Release
RUN mkdir -p /app/apphost \
    && cp -a /src/Lies.AppHost/bin/Release/net10.0/. /app/apphost/
RUN set -eux; \
    mkdir -p /app/nuget-packages; \
    cp -a /root/.nuget/packages/aspire.dashboard.sdk.linux-* /app/nuget-packages/; \
    cp -a /root/.nuget/packages/aspire.hosting.orchestration.linux-* /app/nuget-packages/

FROM postgres:latest AS postgres-tools

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_ENVIRONMENT=Production

RUN set -eux; \
    installed=''; \
    for attempt in 1 2 3 4 5; do \
      if apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=30 update \
        && apt-get install -y --no-install-recommends -o Acquire::Retries=5 -o Acquire::http::Timeout=30 \
          fontconfig \
          libfontconfig1 \
          fonts-noto-cjk \
          libpq5 \
          libldap2 \
          libsasl2-2 \
          libgssapi-krb5-2; then \
        installed=1; \
        break; \
      fi; \
      rm -rf /var/lib/apt/lists/*; \
      echo "Retrying font package install (attempt ${attempt}/5)..." >&2; \
      sleep 5; \
    done; \
    test -n "$installed"; \
    rm -rf /var/lib/apt/lists/*

COPY --from=backend-build /app/publish ./
COPY --from=frontend-build /src/frontend/dist ./wwwroot
COPY --from=postgres-tools /usr/lib/postgresql/18/bin/pg_dump /usr/local/bin/pg_dump

RUN mkdir -p /app/Logs /app/RuntimeData/RapidOcr

EXPOSE 8080

ENTRYPOINT ["dotnet", "Lies.Server.dll"]

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS apphost-monitor
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:17100
ENV DOTNET_ENVIRONMENT=Production
ENV ASPIRE_ALLOW_UNSECURED_TRANSPORT=true
ENV ASPIRE_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS=true

COPY --from=apphost-build /app/apphost ./
COPY --from=apphost-build /app/nuget-packages /root/.nuget/packages

ENTRYPOINT ["dotnet", "Lies.AppHost.dll"]
