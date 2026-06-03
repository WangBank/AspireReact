using AspireReact.Server.Data;
using AspireReact.Server.Middlewares;
using AspireReact.Server.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Serilog;
using Serilog.Events;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("正在启动 AspireReact.Server");

    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((context, services, configuration) =>
    {
        var logDirectory = Path.Combine(context.HostingEnvironment.ContentRootPath, "Logs");
        Directory.CreateDirectory(logDirectory);

        configuration
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
    });

    var logDirectoryPath = Path.Combine(builder.Environment.ContentRootPath, "Logs");

    // Add service defaults & Aspire client integrations.
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
        client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 AspireReact/1.0");
    });

    builder.Services.Configure<RapidOcrOptions>(builder.Configuration.GetSection("RapidOcr"));

    // 注册自定义服务
    builder.Services.AddScoped<IRedisService, RedisService>();
    builder.Services.AddScoped<IStockSearchService, StockSearchService>();
    builder.Services.AddScoped<ICaptchaService, CaptchaService>();
    builder.Services.AddScoped<IAuthService, AuthService>();
    builder.Services.AddScoped<IAccountService, AccountService>();
    builder.Services.AddScoped<IBankFlowService, BankFlowService>();
    builder.Services.AddScoped<IStockTradeService, StockTradeService>();
    builder.Services.AddScoped<ITradeNoteService, TradeNoteService>();
    builder.Services.AddScoped<IPortfolioScreenshotImportService, PortfolioScreenshotImportService>();
    builder.Services.AddScoped<IDataHealthService, DataHealthService>();
    builder.Services.AddScoped<IMarketIndexService, MarketIndexService>();

    // 添加控制器支持
    builder.Services.AddControllers();

    // 添加健康检查
    builder.Services.AddHealthChecks()
        .AddRedisHealthCheck(redisConnectionString)
        .AddDbContextCheck<AppDbContext>();

    var app = builder.Build();

    app.Lifetime.ApplicationStarted.Register(() =>
        Log.Information(
            "AspireReact.Server 已启动，环境={EnvironmentName}，内容根目录={ContentRootPath}，日志目录={LogDirectory}",
            app.Environment.EnvironmentName,
            app.Environment.ContentRootPath,
            logDirectoryPath));

    app.Lifetime.ApplicationStopping.Register(() =>
        Log.Information("AspireReact.Server 正在停止"));

    app.Lifetime.ApplicationStopped.Register(() =>
        Log.Information("AspireReact.Server 已停止"));

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

    // JWT 认证中间件
    app.UseJwtMiddleware();

    // 映射控制器路由
    app.MapControllers();

    app.MapDefaultEndpoints();

    app.UseFileServer();
    app.MapFallbackToFile("index.html");

    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "AspireReact.Server 启动失败或运行中发生致命异常");
}
finally
{
    Log.CloseAndFlush();
}
