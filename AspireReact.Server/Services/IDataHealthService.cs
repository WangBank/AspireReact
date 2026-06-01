using AspireReact.Server.DTOs;

namespace AspireReact.Server.Services;

public interface IDataHealthService
{
    Task<DataHealthReportResponse> BuildReportAsync(CancellationToken cancellationToken = default);
}
