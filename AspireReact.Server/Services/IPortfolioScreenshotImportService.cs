using AspireReact.Server.DTOs;

namespace AspireReact.Server.Services;

public interface IPortfolioScreenshotImportService
{
    Task<PortfolioScreenshotImportResult> ParseAsync(
        PortfolioScreenshotImportRequest request,
        CancellationToken cancellationToken = default);
}
