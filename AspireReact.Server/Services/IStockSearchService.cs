using AspireReact.Server.Entities;

namespace AspireReact.Server.Services;

public interface IStockSearchService
{
    Task<List<StockBasic>> SearchStocksAsync(string keyword);
    Task<StockBasic?> GetStockByCodeAsync(string stockCode);
    Task RefreshStockCacheAsync();
    Task<int> GetCachedStockCountAsync();
}