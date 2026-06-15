using Lies.Server.Data;
using Lies.Server.Hubs;
using Lies.Server.Infrastructure;
using Lies.Server.Middlewares;
using Lies.Server.Services;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using OpenTelemetry;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.OpenTelemetry;
using System.Threading.RateLimiting;

static OtlpProtocol ResolveOtlpProtocol(string? value)
{
    if (string.Equals(value, "http/protobuf", StringComparison.OrdinalIgnoreCase)
        || string.Equals(value, "httpprotobuf", StringComparison.OrdinalIgnoreCase))
    {
        return OtlpProtocol.HttpProtobuf;
    }

    return OtlpProtocol.Grpc;
}

static string ResolveRateLimitIdentity(HttpContext context)
{
    var userId = context.Items["UserId"]?.ToString();
    if (!string.IsNullOrWhiteSpace(userId))
    {
        return $"user:{userId}";
    }

    if (context.Request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor))
    {
        var forwardedValue = forwardedFor.FirstOrDefault()?.Split(',').FirstOrDefault()?.Trim();
        if (!string.IsNullOrWhiteSpace(forwardedValue))
        {
            return $"ip:{forwardedValue}";
        }
    }

    if (context.Request.Headers.TryGetValue("X-Real-IP", out var realIp))
    {
        var realIpValue = realIp.FirstOrDefault()?.Trim();
        if (!string.IsNullOrWhiteSpace(realIpValue))
        {
            return $"ip:{realIpValue}";
        }
    }

    return $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";
}

static RateLimitPartition<string> CreateApiRateLimitPartition(HttpContext context)
{
    var path = context.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;
    var identity = ResolveRateLimitIdentity(context);

    return path switch
    {
        var p when p.StartsWith("/api/auth/captcha", StringComparison.OrdinalIgnoreCase)
            => RateLimitPartition.GetFixedWindowLimiter(
                $"{identity}:captcha",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 20,
                    Window = TimeSpan.FromMinutes(1),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0,
                    AutoReplenishment = true
                }),
        var p when p.StartsWith("/api/auth/login", StringComparison.OrdinalIgnoreCase)
                 || p.StartsWith("/api/auth/quick-login", StringComparison.OrdinalIgnoreCase)
                 || p.StartsWith("/api/auth/register", StringComparison.OrdinalIgnoreCase)
            => RateLimitPartition.GetFixedWindowLimiter(
                $"{identity}:auth-write",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0,
                    AutoReplenishment = true
                }),
        var p when p.StartsWith("/api/portfolio-import/screenshot", StringComparison.OrdinalIgnoreCase)
            => RateLimitPartition.GetFixedWindowLimiter(
                $"{identity}:ocr",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 12,
                    Window = TimeSpan.FromMinutes(1),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0,
                    AutoReplenishment = true
                }),
        var p when p.StartsWith("/api/stock/search", StringComparison.OrdinalIgnoreCase)
            => RateLimitPartition.GetFixedWindowLimiter(
                $"{identity}:stock-search",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 60,
                    Window = TimeSpan.FromMinutes(1),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0,
                    AutoReplenishment = true
                }),
        var p when p.StartsWith("/api/admin/export/database", StringComparison.OrdinalIgnoreCase)
            => RateLimitPartition.GetFixedWindowLimiter(
                $"{identity}:admin-export",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 3,
                    Window = TimeSpan.FromMinutes(1),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0,
                    AutoReplenishment = true
                }),
        _ => RateLimitPartition.GetFixedWindowLimiter(
            $"{identity}:api-default",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 180,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true
            })
    };
}

static void ApplyStaticAssetCacheHeaders(StaticFileResponseContext context)
{
    var path = context.Context.Request.Path.Value ?? string.Empty;
    var fileName = Path.GetFileName(path);
    var headers = context.Context.Response.Headers;

    if (string.Equals(fileName, "sw.js", StringComparison.OrdinalIgnoreCase))
    {
        headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
        headers["Pragma"] = "no-cache";
        headers["Expires"] = "0";
        headers["Service-Worker-Allowed"] = "/";
        return;
    }

    if (string.Equals(fileName, "manifest.webmanifest", StringComparison.OrdinalIgnoreCase)
        || string.Equals(fileName, "index.html", StringComparison.OrdinalIgnoreCase))
    {
        headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
        headers["Pragma"] = "no-cache";
        headers["Expires"] = "0";
        return;
    }

    if (path.Contains("/assets/", StringComparison.OrdinalIgnoreCase)
        || fileName.StartsWith("workbox-", StringComparison.OrdinalIgnoreCase)
        || fileName.EndsWith(".js", StringComparison.OrdinalIgnoreCase)
        || fileName.EndsWith(".css", StringComparison.OrdinalIgnoreCase))
    {
        headers["Cache-Control"] = "public, max-age=31536000, immutable";
    }
}

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("正在启动 Lies.Server");

    var builder = WebApplication.CreateBuilder(args);
    var webRootPath = builder.Environment.WebRootPath ?? Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
    Directory.CreateDirectory(webRootPath);
    builder.WebHost.UseWebRoot(webRootPath);

    AuthConfig.ValidateJwtConfiguration(builder.Configuration);

    builder.Host.UseSerilog((context, services, configuration) =>
    {
        var logDirectory = Path.Combine(context.HostingEnvironment.ContentRootPath, "Logs");
        Directory.CreateDirectory(logDirectory);
        var otlpEndpoint = context.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];
        var otlpProtocol = context.Configuration["OTEL_EXPORTER_OTLP_PROTOCOL"];

        var loggerConfiguration = configuration
            .ReadFrom.Configuration(context.Configuration)
            .ReadFrom.Services(services)
            .Enrich.FromLogContext()
            .Enrich.WithProperty("Application", context.HostingEnvironment.ApplicationName)
            .WriteTo.File(
                path: Path.Combine(logDirectory, "server-.log"),
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 14,
                shared: true,
                flushToDiskInterval: TimeSpan.FromSeconds(3),
                outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Level:u3}] [{TraceId}] {Message:lj} <s:{SourceContext}>{NewLine}{Exception}")
            .WriteTo.File(
                path: Path.Combine(logDirectory, "error-.log"),
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 30,
                restrictedToMinimumLevel: LogEventLevel.Error,
                shared: true,
                flushToDiskInterval: TimeSpan.FromSeconds(1),
                outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Level:u3}] [{TraceId}] {Message:lj}{NewLine}{Exception}");

        if (!string.IsNullOrWhiteSpace(otlpEndpoint))
        {
            loggerConfiguration.WriteTo.OpenTelemetry(options =>
            {
                options.Endpoint = otlpEndpoint;
                options.Protocol = ResolveOtlpProtocol(otlpProtocol);
                options.OnBeginSuppressInstrumentation = SuppressInstrumentationScope.Begin;
                options.ResourceAttributes = new Dictionary<string, object>
                {
                    ["service.name"] = context.HostingEnvironment.ApplicationName,
                    ["deployment.environment"] = context.HostingEnvironment.EnvironmentName
                };
            });
        }
    });

    var logDirectoryPath = Path.Combine(builder.Environment.ContentRootPath, "Logs");

    // Add service defaults & Lies client integrations.
    builder.AddServiceDefaults();

    // Add services to the container.
    builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
    builder.Services.AddProblemDetails();

    // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
    builder.Services.AddOpenApi();

    // 添加数据库服务
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(DatabaseConfig.GetConnectionString(builder.Configuration)));

    // 添加数据库迁移服务
    builder.Services.AddMigrationService<AppDbContext>();

    var redisConnectionString = RedisConfig.GetConnectionString(builder.Configuration);

    // 添加Redis缓存
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = redisConnectionString;
        options.InstanceName = "StockSystem";
    });

    // 添加HttpClient
    builder.Services.AddHttpClient("StockSearch", client =>
    {
        client.Timeout = TimeSpan.FromSeconds(10);
        client.DefaultRequestHeaders.Add("User-Agent", "StockTradingSystem/1.0");
    });
    builder.Services.AddHttpClient("RapidOcrModels", client =>
    {
        client.Timeout = TimeSpan.FromMinutes(5);
    });
    builder.Services.AddHttpClient("MarketIndex", client =>
    {
        client.Timeout = TimeSpan.FromSeconds(10);
        client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 Lies/1.0");
    });

    builder.Services.Configure<RapidOcrOptions>(builder.Configuration.GetSection("RapidOcr"));

    // 注册自定义服务
    builder.Services.AddScoped<IRedisService, RedisService>();
    builder.Services.AddScoped<IStockSearchService, StockSearchService>();
    builder.Services.AddScoped<ICaptchaService, CaptchaService>();
    builder.Services.AddScoped<IAuthService, AuthService>();
    builder.Services.AddScoped<IAdminService, AdminService>();
    builder.Services.AddScoped<IAccountService, AccountService>();
    builder.Services.AddScoped<IBankFlowService, BankFlowService>();
    builder.Services.AddScoped<IStockTradeService, StockTradeService>();
    builder.Services.AddScoped<ITradeNoteService, TradeNoteService>();
    builder.Services.AddScoped<IPortfolioScreenshotImportService, PortfolioScreenshotImportService>();
    builder.Services.AddScoped<ISystemSettingService, SystemSettingService>();
    builder.Services.AddScoped<ISensitiveWordService, SensitiveWordService>();
    builder.Services.AddScoped<IDataHealthService, DataHealthService>();
    builder.Services.AddScoped<IMarketIndexService, MarketIndexService>();
    builder.Services.AddScoped<IMessageService, MessageService>();
    builder.Services.AddSingleton<IMessagePresenceTracker, MessagePresenceTracker>();
    builder.Services.AddScoped<RequireAuthenticatedApiFilter>();
    builder.Services.AddSignalR();

    // 添加控制器支持
    builder.Services.AddControllers(options =>
    {
        options.Filters.AddService<RequireAuthenticatedApiFilter>();
    });

    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        options.OnRejected = async (context, cancellationToken) =>
        {
            context.HttpContext.Response.ContentType = "application/json; charset=utf-8";
            await context.HttpContext.Response.WriteAsJsonAsync(new
            {
                success = false,
                message = "请求过于频繁，请稍后再试"
            }, cancellationToken);
        };

        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        {
            if (!httpContext.Request.Path.StartsWithSegments("/api"))
            {
                return RateLimitPartition.GetNoLimiter("non-api");
            }

            return CreateApiRateLimitPartition(httpContext);
        });
    });

    // 添加健康检查
    builder.Services.AddHealthChecks()
        .AddRedisHealthCheck(redisConnectionString)
        .AddDbContextCheck<AppDbContext>();

    var app = builder.Build();

    app.Lifetime.ApplicationStarted.Register(() =>
        Log.Information(
            "Lies.Server 已启动，环境={EnvironmentName}，内容根目录={ContentRootPath}，日志目录={LogDirectory}",
            app.Environment.EnvironmentName,
            app.Environment.ContentRootPath,
            logDirectoryPath));

    app.Lifetime.ApplicationStopping.Register(() =>
        Log.Information("Lies.Server 正在停止"));

    app.Lifetime.ApplicationStopped.Register(() =>
        Log.Information("Lies.Server 已停止"));

    // Configure the HTTP request pipeline.
    app.UseExceptionHandler();
    app.UseSerilogRequestLogging(options =>
    {
        options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
        options.GetLevel = (httpContext, elapsed, exception) =>
        {
            if (exception is not null || httpContext.Response.StatusCode >= StatusCodes.Status500InternalServerError)
            {
                return LogEventLevel.Error;
            }

            if (httpContext.Response.StatusCode >= StatusCodes.Status400BadRequest)
            {
                return LogEventLevel.Warning;
            }

            return LogEventLevel.Information;
        };
        options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
        {
            diagnosticContext.Set("TraceId", httpContext.TraceIdentifier);
            diagnosticContext.Set("RemoteIpAddress", httpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty);
            diagnosticContext.Set("UserId", httpContext.Items["UserId"]?.ToString() ?? string.Empty);
            diagnosticContext.Set("Username", httpContext.Items["Username"]?.ToString() ?? string.Empty);
        };
    });

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
    }

    app.UseRouting();

    // JWT 认证中间件
    app.UseJwtMiddleware();

    app.Use(async (context, next) =>
    {
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.Headers["Cache-Control"] = "no-store, no-cache, max-age=0";
            context.Response.Headers["Pragma"] = "no-cache";
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            context.Response.Headers["Referrer-Policy"] = "no-referrer";
            context.Response.Headers["X-Frame-Options"] = "DENY";
        }

        await next();
    });

    app.UseRateLimiter();

    // 映射控制器路由
    app.MapControllers();
    app.MapHub<MessageHub>("/messagehub");

    app.MapDefaultEndpoints();

    var staticFileOptions = new StaticFileOptions
    {
        OnPrepareResponse = ApplyStaticAssetCacheHeaders
    };

    app.UseFileServer(new FileServerOptions
    {
        StaticFileOptions =
        {
            OnPrepareResponse = ApplyStaticAssetCacheHeaders
        }
    });
    app.MapFallbackToFile("index.html", staticFileOptions);

    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Lies.Server 启动失败或运行中发生致命异常");
}
finally
{
    Log.CloseAndFlush();
}
