using AspireReact.Server.Entities;

namespace AspireReact.Server.Services;

public interface IRedisService
{
    // 股票搜索缓存
    Task<List<StockBasic>?> SearchStocksAsync(string keyword);
    Task CacheStockSearchAsync(string keyword, List<StockBasic> stocks);
    
    // 股票基础信息缓存
    Task<StockBasic?> GetStockBasicAsync(string stockCode);
    Task CacheStockBasicAsync(StockBasic stock);
    Task CacheStockBasicsAsync(List<StockBasic> stocks);
    
    // 缓存管理
    Task<bool> ClearStockCacheAsync();
    Task<long> GetStockCacheCountAsync();
    
    // 通用缓存方法
    Task<T?> GetAsync<T>(string key);
    Task SetAsync<T>(string key, T value, TimeSpan? expiry = null);
    Task<bool> RemoveAsync(string key);
    Task<bool> KeyExistsAsync(string key);
}