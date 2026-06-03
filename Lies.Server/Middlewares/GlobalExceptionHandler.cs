using System.Diagnostics;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Lies.Server.Middlewares;

public sealed class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger,
    IProblemDetailsService problemDetailsService,
    IWebHostEnvironment environment) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var traceId = Activity.Current?.Id ?? httpContext.TraceIdentifier;
        var userId = httpContext.Items["UserId"]?.ToString();
        var username = httpContext.Items["Username"]?.ToString();
        var requestPath = $"{httpContext.Request.PathBase}{httpContext.Request.Path}{httpContext.Request.QueryString}";

        logger.LogError(
            exception,
            "未处理异常: {Method} {Path}, TraceId={TraceId}, UserId={UserId}, Username={Username}",
            httpContext.Request.Method,
            requestPath,
            traceId,
            userId,
            username);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "服务器处理请求时发生异常",
            Detail = environment.IsDevelopment()
                ? exception.Message
                : "请求处理失败，请稍后重试。",
            Instance = httpContext.Request.Path
        };
        problem.Extensions["traceId"] = traceId;

        var handled = await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception
        });

        if (!handled)
        {
            await httpContext.Response.WriteAsJsonAsync(new
            {
                title = problem.Title,
                status = problem.Status,
                detail = problem.Detail,
                traceId
            }, cancellationToken);
        }

        return true;
    }
}
