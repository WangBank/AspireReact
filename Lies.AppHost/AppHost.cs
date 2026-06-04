using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Docker;
using Aspire.Hosting.Docker.Resources.ComposeNodes;
using Microsoft.Extensions.DependencyInjection;

var appHostMonitorMode = IsTrue(Environment.GetEnvironmentVariable("LIES_APPHOST_MONITOR_MODE"));
var disableBuiltInDashboard = IsTrue(Environment.GetEnvironmentVariable("LIES_APPHOST_DISABLE_DASHBOARD"));

var builder = DistributedApplication.CreateBuilder(new DistributedApplicationOptions
{
    Args = args,
    DisableDashboard = disableBuiltInDashboard
});

if (builder.ExecutionContext.IsPublishMode)
{
    ConfigureDockerComposeDeployment(builder);
}
else if (appHostMonitorMode)
{
    ConfigureDeploymentMonitoring(builder);
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
    const int resourceServicePort = 20252;

    var postgresUser = builder.AddParameter(
        "postgresUser",
        GetConfig(builder, "Parameters:postgresUser", "postgres"),
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

    builder.AddDockerComposeEnvironment("compose")
        .ConfigureComposeFile(file =>
        {
            file.Name = composeProjectName;
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

    var app = builder.AddDockerfile("app", "..", "Dockerfile", "final")
        .WithReference(postgresDb, "PostgreSQL")
        .WithReference(redis, "Redis")
        .WaitFor(postgres)
        .WaitFor(postgresDb)
        .WaitFor(redis)
        .WithEnvironment("ASPNETCORE_URLS", "http://+:8080")
        .WithEnvironment("DOTNET_ENVIRONMENT", "Production")
        .WithEnvironment("OTEL_EXPORTER_OTLP_ENDPOINT", "http://apphost-monitor:18889")
        .WithEnvironment("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc")
        .WithEnvironment("Redis__ConnectionString", ReferenceExpression.Create($"redis:6379,password={redisPassword}"))
        .WithEnvironment("ConnectionStrings__Redis", ReferenceExpression.Create($"redis:6379,password={redisPassword}"))
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

    builder.AddDockerfile("apphost-monitor", "..", "Dockerfile", "apphost-monitor")
        .WithReference(postgresDb, "PostgreSQL")
        .WithReference(redis, "Redis")
        .WaitFor(postgres)
        .WaitFor(postgresDb)
        .WaitFor(redis)
        .WithEnvironment("ASPNETCORE_URLS", "http://0.0.0.0:17100")
        .WithEnvironment("DOTNET_ENVIRONMENT", "Production")
        .WithEnvironment("LIES_APPHOST_MONITOR_MODE", "true")
        .WithEnvironment("ASPIRE_ALLOW_UNSECURED_TRANSPORT", "true")
        .WithEnvironment("ASPIRE_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS", "true")
        .WithEnvironment("ASPIRE_DASHBOARD_OTLP_ENDPOINT_URL", "http://0.0.0.0:18889")
        .WithEnvironment("DOTNET_RESOURCE_SERVICE_ENDPOINT_URL", "http://127.0.0.1:" + resourceServicePort)
        .WithEnvironment(
            "Monitoring__PostgresConnectionString",
            ReferenceExpression.Create(
                $"Host=postgres;Port=5432;Database={postgresDbName};Username={postgresUser};Password={postgresPassword}"))
        .WithEnvironment(
            "Monitoring__RedisConnectionString",
            ReferenceExpression.Create($"redis:6379,password={redisPassword}"))
        .WithEndpoint(targetPort: 17100, port: dashboardPort, scheme: "http", name: "dashboard", isExternal: true)
        .WithEnvironment("Monitoring__ServerUrl", "http://app:8080")
        .WithEnvironment("Monitoring__FrontendUrl", "http://app:8080")
        .WithEnvironment("Monitoring__PostgresUrl", "http://postgres:5432")
        .WithEnvironment("Monitoring__RedisUrl", "http://redis:6379")
        .PublishAsDockerComposeService((_, service) =>
        {
            service.Name = "apphost-monitor";
            service.Restart = "unless-stopped";
            BindServicePortToLoopback(service, dashboardPort, 17100);
        });
}

static void ConfigureDeploymentMonitoring(IDistributedApplicationBuilder builder)
{
    var postgresConnectionString = GetOptionalConfig(
        builder,
        "Monitoring:PostgresConnectionString",
        "ConnectionStrings:PostgreSQL",
        "PostgreSQL");

    var redisConnectionString = GetOptionalConfig(
        builder,
        "Monitoring:RedisConnectionString",
        "ConnectionStrings:Redis",
        "Redis");

    var healthChecks = builder.Services.AddHealthChecks();

    if (!string.IsNullOrWhiteSpace(postgresConnectionString))
    {
        healthChecks.AddNpgSql(postgresConnectionString, name: "postgres");
    }

    if (!string.IsNullOrWhiteSpace(redisConnectionString))
    {
        healthChecks.AddRedis(redisConnectionString, name: "redis");
    }

    var postgresService = builder.AddExternalService(
        "postgres",
        GetUriConfig(builder, "Monitoring:PostgresUrl", "http://postgres:5432"));
    if (!string.IsNullOrWhiteSpace(postgresConnectionString))
    {
        postgresService.WithHealthCheck("postgres");
    }

    var redisService = builder.AddExternalService(
        "redis",
        GetUriConfig(builder, "Monitoring:RedisUrl", "http://redis:6379"));
    if (!string.IsNullOrWhiteSpace(redisConnectionString))
    {
        redisService.WithHealthCheck("redis");
    }

    builder.AddExternalService("server", GetUriConfig(builder, "Monitoring:ServerUrl", "http://app:8080"))
        .WithHttpHealthCheck("/health");

    builder.AddExternalService("webfrontend", GetUriConfig(builder, "Monitoring:FrontendUrl", "http://app:8080"))
        .WithHttpHealthCheck("/");
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

static string? GetOptionalConfig(IDistributedApplicationBuilder builder, params string[] keys)
{
    foreach (var key in keys)
    {
        var value = builder.Configuration[key];
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value.Trim();
        }
    }

    return null;
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

static Uri GetUriConfig(IDistributedApplicationBuilder builder, string key, string defaultValue)
{
    var value = GetConfig(builder, key, defaultValue);
    if (Uri.TryCreate(value, UriKind.Absolute, out var uri))
    {
        return uri;
    }

    throw new InvalidOperationException($"配置项 {key} 不是合法的绝对 URL：{value}");
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

static bool IsTrue(string? value)
{
    return value is not null
        && (string.Equals(value, "true", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "1", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "yes", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "on", StringComparison.OrdinalIgnoreCase));
}
