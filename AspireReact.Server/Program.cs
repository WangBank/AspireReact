using AspireReact.Server.Data;
using AspireReact.Server.Middlewares;
using AspireReact.Server.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire client integrations.
builder.AddServiceDefaults();

// Add services to the container.
builder.Services.AddProblemDetails();

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// 添加数据库服务
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(DatabaseConfig.GetConnectionString(builder.Configuration)));

// 添加数据库迁移服务
builder.Services.AddMigrationService<AppDbContext>();

// 添加Redis缓存
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = RedisConfig.GetConnectionString(builder.Configuration);
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

// 添加控制器支持
builder.Services.AddControllers();

// 添加健康检查
builder.Services.AddHealthChecks()
    .AddRedisHealthCheck()
    .AddDbContextCheck<AppDbContext>();

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseExceptionHandler();

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

await app.RunAsync();
