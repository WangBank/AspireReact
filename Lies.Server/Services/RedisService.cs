using System.Text.Json;
using Lies.Server.Data;
using Lies.Server.Entities;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace Lies.Server.Services;

public class RedisService : IRedisService
{
    private readonly IDistributedCache _cache;
    private readonly ILogger<RedisService> _logger;
    private readonly JsonSerializerOptions _jsonOptions;

    public RedisService(IDistributedCache cache, ILogger<RedisService> logger)
    {
        _cache = cache;
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            WriteIndented = false
        };
    }

    public async Task<List<StockBasic>?> SearchStocksAsync(string keyword)
    {
        var key = string.Format(RedisConfig.CacheKeys.StockSearch, keyword.ToLower());
        var cached = await _cache.GetStringAsync(key);
        
        if (!string.IsNullOrEmpty(cached))
        {
            _logger.LogDebug("从Redis缓存命中心魔搜索: {Keyword}", keyword);
            return JsonSerializer.Deserialize<List<StockBasic>>(cached, _jsonOptions);
        }
        
        return null;
    }

    public async Task CacheStockSearchAsync(string keyword, List<StockBasic> stocks)
    {
        var key = string.Format(RedisConfig.CacheKeys.StockSearch, keyword.ToLower());
        var json = JsonSerializer.Serialize(stocks, _jsonOptions);
        
        await _cache.SetStringAsync(key, json, new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1) // 搜索缓存1小时
        });
        
        _logger.LogDebug("心魔搜索缓存已更新: {Keyword}, 数量: {Count}", keyword, stocks.Count);
    }

    public async Task<StockBasic?> GetStockBasicAsync(string stockCode)
    {
        var key = string.Format(RedisConfig.CacheKeys.StockBasic, stockCode);
        var cached = await _cache.GetStringAsync(key);
        
        if (!string.IsNullOrEmpty(cached))
        {
            return JsonSerializer.Deserialize<StockBasic>(cached, _jsonOptions);
        }
        
        return null;
    }

    public async Task CacheStockBasicAsync(StockBasic stock)
    {
        var key = string.Format(RedisConfig.CacheKeys.StockBasic, stock.StockCode);
        var json = JsonSerializer.Serialize(stock, _jsonOptions);
        
        await _cache.SetStringAsync(key, json, new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = RedisConfig.DefaultExpiry
        });
    }

    public async Task CacheStockBasicsAsync(List<StockBasic> stocks)
    {
        var tasks = stocks.Select(stock => CacheStockBasicAsync(stock));
        await Task.WhenAll(tasks);
        
        // 同时更新全量缓存
        var allKey = RedisConfig.CacheKeys.StockAll;
        var json = JsonSerializer.Serialize(stocks, _jsonOptions);
        await _cache.SetStringAsync(allKey, json, new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = RedisConfig.DefaultExpiry
        });
        
        _logger.LogInformation("已缓存 {Count} 只心魔基础信息", stocks.Count);
    }

    public async Task<bool> ClearStockCacheAsync()
    {
        // 在实际生产环境中，这里应该使用Redis的SCAN命令删除相关键
        // 简化实现：只清除全量缓存
        await _cache.RemoveAsync(RedisConfig.CacheKeys.StockAll);
        _logger.LogInformation("心魔缓存已清除");
        return true;
    }

    public async Task<long> GetStockCacheCountAsync()
    {
        // 简化实现：返回全量缓存的大小
        var allKey = RedisConfig.CacheKeys.StockAll;
        var cached = await _cache.GetStringAsync(allKey);
        if (string.IsNullOrEmpty(cached)) return 0;
        
        var stocks = JsonSerializer.Deserialize<List<StockBasic>>(cached, _jsonOptions);
        return stocks?.Count ?? 0;
    }

    // 通用缓存方法
    public async Task<T?> GetAsync<T>(string key)
    {
        var cached = await _cache.GetStringAsync(key);
        if (string.IsNullOrEmpty(cached)) return default;
        
        return JsonSerializer.Deserialize<T>(cached, _jsonOptions);
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null)
    {
        var json = JsonSerializer.Serialize(value, _jsonOptions);
        var options = new DistributedCacheEntryOptions();
        
        if (expiry.HasValue)
        {
            options.AbsoluteExpirationRelativeToNow = expiry;
        }
        else
        {
            options.AbsoluteExpirationRelativeToNow = RedisConfig.DefaultExpiry;
        }
        
        await _cache.SetStringAsync(key, json, options);
    }

    public async Task<bool> RemoveAsync(string key)
    {
        await _cache.RemoveAsync(key);
        return true;
    }

    public async Task<bool> KeyExistsAsync(string key)
    {
        var value = await _cache.GetStringAsync(key);
        return !string.IsNullOrEmpty(value);
    }
}