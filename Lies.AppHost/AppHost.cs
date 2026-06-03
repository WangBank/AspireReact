using Aspire.Hosting;
using Aspire.Hosting.Docker;
using Aspire.Hosting.Docker.Resources.ComposeNodes;

var builder = DistributedApplication.CreateBuilder(args);

if (builder.ExecutionContext.IsPublishMode)
{
    ConfigureDockerComposeDeployment(builder);
}
else
{
    ConfigureLocalDevelopment(builder);
}

builder.Build().Run();

static void ConfigureLocalDevelopment(IDistributedApplicationBuilder builder)
{
    var postgresImageTag = GetConfig(builder, "Deployment:Docker:PostgresImageTag", "latest");
    var postgresDbName = GetConfig(builder, "Deployment:Docker:PostgresDatabase", "lies");
    var appPort = GetIntConfig(builder, "Deployment:Docker:AppPort", 5516);

    var postgres = builder.AddPostgres("postgres")
        .WithImageTag(postgresImageTag);
    var postgresDb = postgres.AddDatabase("liesdb", postgresDbName);
    var redis = builder.AddRedis("redis");

    var server = builder.AddProject<Projects.Lies_Server>("server")
        .WithReference(postgresDb, "PostgreSQL")
        .WithReference(redis, "Redis")
        .WaitFor(postgres)
        .WaitFor(postgresDb)
        .WaitFor(redis)
        .WithHttpHealthCheck("/health")
        .WithExternalHttpEndpoints();

    var webfrontend = builder.AddViteApp("webfrontend", "../frontend")
        .WithEndpoint(port: appPort, scheme: "http")
        .WithReference(server)
        .WaitFor(server);

    server.PublishWithContainerFiles(webfrontend, "wwwroot");
}

static void ConfigureDockerComposeDeployment(IDistributedApplicationBuilder builder)
{
    var composeProjectName = GetConfig(builder, "Deployment:Docker:ComposeProjectName", "lies");
    var appPort = GetIntConfig(builder, "Deployment:Docker:AppPort", 5516);
    var dashboardPort = GetNullableIntConfig(builder, "Deployment:Docker:DashboardPort", 18888);
    var postgresPort = GetNullableIntConfig(builder, "Deployment:Docker:PostgresPort", 5432);
    var redisPort = GetNullableIntConfig(builder, "Deployment:Docker:RedisPort", 6379);
    var postgresImageTag = GetConfig(builder, "Deployment:Docker:PostgresImageTag", "latest");
    var postgresDbName = GetConfig(builder, "Deployment:Docker:PostgresDatabase", "lies");
    var rapidOcrAutoDownloadModels = GetConfig(builder, "Deployment:Docker:RapidOcrAutoDownloadModels", "true");

    var postgresUser = builder.AddParameter(
        "postgresUser",
        GetConfig(builder, "Parameters:postgresUser", "postgres"),
        publishValueAsDefault: true,
        secret: false);

    var dashboardToken = builder.AddParameter(
        "dashboardToken",
        GetConfig(builder, "Parameters:dashboardToken", "lies-dashboard-local"),
        publishValueAsDefault: true,
        secret: false);

    var postgresPassword = builder.AddParameterFromConfiguration(
            "postgresPassword",
            "Parameters:postgresPassword",
            secret: true)
        .WithDescription("Docker PostgreSQL 管理员密码。");

    var redisPassword = builder.AddParameterFromConfiguration(
            "redisPassword",
            "Parameters:redisPassword",
            secret: true)
        .WithDescription("Docker Redis 访问密码。");

    var compose = builder.AddDockerComposeEnvironment("compose")
        .ConfigureComposeFile(file =>
        {
            file.Name = composeProjectName;
        });

    compose.WithDashboard(dashboard =>
    {
        dashboard
            .WithHostPort(dashboardPort)
            .WithEnvironment("DASHBOARD__FRONTEND__AUTHMODE", "BrowserToken")
            .WithEnvironment("DASHBOARD__FRONTEND__BROWSERTOKEN", dashboardToken)
            .WithEnvironment("DASHBOARD__OTLP__AUTHMODE", "Unsecured")
            .WithEnvironment("DASHBOARD__OTLP__SUPPRESSUNSECUREDMESSAGE", "true")
            .PublishAsDockerComposeService((_, service) =>
            {
                service.Name = "dashboard";
                service.Restart = "unless-stopped";
                BindServicePortToLoopback(service, dashboardPort, 18888);
            });
    });

    var postgres = builder.AddPostgres("postgres", postgresUser, postgresPassword, port: postgresPort)
        .WithImageTag(postgresImageTag)
        .WithDataVolume("postgres_data")
        .PublishAsDockerComposeService((_, service) =>
        {
            service.Name = "postgres";
            service.Restart = "unless-stopped";
            BindServicePortToLoopback(service, postgresPort, 5432);
            SetNamedVolumeTarget(service, "postgres_data", GetPostgresDataDirectory(postgresImageTag));
        });

    var postgresDb = postgres.AddDatabase("liesdb", postgresDbName);

    var redis = builder.AddRedis("redis", redisPort, redisPassword)
        .WithDataVolume("redis_data")
        .PublishAsDockerComposeService((_, service) =>
        {
            service.Name = "redis";
            service.Restart = "unless-stopped";
            BindServicePortToLoopback(service, redisPort, 6379);
        });

    builder.AddDockerfile("app", "..", "Dockerfile", "final")
        .WithReference(postgresDb, "PostgreSQL")
        .WithReference(redis, "Redis")
        .WaitFor(postgres)
        .WaitFor(postgresDb)
        .WaitFor(redis)
        .WithEnvironment("ASPNETCORE_URLS", "http://+:8080")
        .WithEnvironment("DOTNET_ENVIRONMENT", "Production")
        .WithEnvironment("RapidOcr__FontPath", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc")
        .WithEnvironment("RapidOcr__AutoDownloadModels", rapidOcrAutoDownloadModels)
        .WithEndpoint(targetPort: 8080, port: appPort, scheme: "http", name: "http", isExternal: true)
        .WithHttpHealthCheck("/health")
        .WithVolume("app_logs", "/app/Logs")
        .WithVolume("app_runtime", "/app/RuntimeData")
        .PublishAsDockerComposeService((_, service) =>
        {
            service.Name = "app";
            service.Restart = "unless-stopped";
        });
}

static string GetConfig(IDistributedApplicationBuilder builder, string key, string defaultValue)
{
    var value = builder.Configuration[key];
    return string.IsNullOrWhiteSpace(value) ? defaultValue : value.Trim();
}

static int GetIntConfig(IDistributedApplicationBuilder builder, string key, int defaultValue)
{
    return int.TryParse(builder.Configuration[key], out var value) ? value : defaultValue;
}

static int? GetNullableIntConfig(IDistributedApplicationBuilder builder, string key, int defaultValue)
{
    if (string.IsNullOrWhiteSpace(builder.Configuration[key]))
    {
        return defaultValue;
    }

    return int.TryParse(builder.Configuration[key], out var value) && value > 0
        ? value
        : null;
}

static void BindServicePortToLoopback(Service service, int? hostPort, int containerPort)
{
    if (hostPort is null)
    {
        return;
    }

    service.Ports ??= [];
    service.Ports.Clear();
    service.Ports.Add($"127.0.0.1:{hostPort}:{containerPort}");
}

static void SetNamedVolumeTarget(Service service, string source, string target)
{
    if (service.Volumes is null)
    {
        return;
    }

    var volume = service.Volumes.FirstOrDefault(item => string.Equals(item.Source, source, StringComparison.Ordinal));
    if (volume is not null)
    {
        volume.Target = target;
    }
}

static string GetPostgresDataDirectory(string imageTag)
{
    if (string.IsNullOrWhiteSpace(imageTag) || string.Equals(imageTag, "latest", StringComparison.OrdinalIgnoreCase))
    {
        return "/var/lib/postgresql";
    }

    var majorPart = imageTag.Split(['.', '-'], StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
    return int.TryParse(majorPart, out var majorVersion) && majorVersion >= 18
        ? "/var/lib/postgresql"
        : "/var/lib/postgresql/data";
}
