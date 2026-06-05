using Lies.Server.DTOs;

namespace Lies.Server.Services;

public interface IPortfolioScreenshotImportService
{
    Task<PortfolioScreenshotImportResult> ParseAsync(
        int userId,
        PortfolioScreenshotImportRequest request,
        CancellationToken cancellationToken = default);

    Task<PagedResult<PortfolioImportAuditListItemResponse>> GetAuditPageAsync(
        int page,
        int pageSize,
        string? saveStatus,
        CancellationToken cancellationToken = default);

    Task<PortfolioImportAuditDetailResponse?> GetAuditDetailAsync(
        int id,
        CancellationToken cancellationToken = default);

    Task<(byte[] Bytes, string ContentType, string FileName)?> GetAuditImageAsync(
        int id,
        CancellationToken cancellationToken = default);

    Task<bool> FinalizeAuditAsync(
        int currentUserId,
        bool isAdmin,
        int id,
        PortfolioImportAuditFinalizeRequest request,
        CancellationToken cancellationToken = default);
}
