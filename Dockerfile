FROM node:22-alpine AS frontend-build
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
          fonts-noto-cjk; then \
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

RUN mkdir -p /app/Logs /app/RuntimeData/RapidOcr

EXPOSE 8080

ENTRYPOINT ["dotnet", "Lies.Server.dll"]
