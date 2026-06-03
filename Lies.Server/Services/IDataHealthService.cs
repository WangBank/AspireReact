using Lies.Server.DTOs;

namespace Lies.Server.Services;

public interface IDataHealthService
{
    Task<DataHealthReportResponse> BuildReportAsync(CancellationToken cancellationToken = default);
}
