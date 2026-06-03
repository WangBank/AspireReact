FROM node:22-alpine AS frontend-build
WORKDIR /src/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src

COPY AspireReact.Server/AspireReact.Server.csproj AspireReact.Server/
RUN dotnet restore AspireReact.Server/AspireReact.Server.csproj

COPY AspireReact.Server/ AspireReact.Server/
RUN dotnet publish AspireReact.Server/AspireReact.Server.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_ENVIRONMENT=Production

COPY --from=backend-build /app/publish ./
COPY --from=frontend-build /src/frontend/dist ./wwwroot

RUN mkdir -p /app/Logs /app/RuntimeData/RapidOcr

EXPOSE 8080

ENTRYPOINT ["dotnet", "AspireReact.Server.dll"]
