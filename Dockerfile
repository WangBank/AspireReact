FROM node:22-alpine AS frontend-build
WORKDIR /src/frontend

COPY frontend/package*.json ./
RUN npm ci

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

RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

COPY --from=backend-build /app/publish ./
COPY --from=frontend-build /src/frontend/dist ./wwwroot

RUN mkdir -p /app/Logs /app/RuntimeData/RapidOcr

EXPOSE 8080

ENTRYPOINT ["dotnet", "Lies.Server.dll"]
