using System.Net.Http.Json;
using Lies.Server.Data;
using Lies.Server.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Lies.Server.Services;

public class StockSearchService : IStockSearchService
{
    private readonly AppDbContext _dbContext;
    private readonly IRedisService _redisService;
    private readonly HttpClient _httpClient;
    private readonly ILogger<StockSearchService> _logger;
    
    // 东方财富API配置
    private const string EastMoneyApi = "https://searchadapter.eastmoney.com/api/suggest/get";
    private const string EastMoneyToken = "D43BF722C8E33BDC906FB84D85E326E8";

    public StockSearchService(
        AppDbContext dbContext,
        IRedisService redisService,
        IHttpClientFactory httpClientFactory,
        ILogger<StockSearchService> logger)
    {
        _dbContext = dbContext;
        _redisService = redisService;
        _httpClient = httpClientFactory.CreateClient("StockSearch");
        _logger = logger;
    }

    public async Task<List<StockBasic>> SearchStocksAsync(string keyword)
    {
        if (string.IsNullOrWhiteSpace(keyword))
            return new List<StockBasic>();

        // 1. 检查Redis缓存
        var cached = await _redisService.SearchStocksAsync(keyword);
        if (cached != null && cached.Any())
        {
            _logger.LogDebug("从Redis缓存返回搜索结果: {Keyword}, 数量: {Count}", keyword, cached.Count);
            return cached;
        }

        // 2. 检查数据库缓存
        var dbResults = await SearchInDatabaseAsync(keyword);
        if (dbResults.Any())
        {
            // 缓存到Redis
            await _redisService.CacheStockSearchAsync(keyword, dbResults);
            return dbResults;
        }

        // 3. 调用第三方API
        var apiResults = await SearchFromThirdPartyApiAsync(keyword);
        if (apiResults.Any())
        {
            // 保存到数据库
            await SaveToDatabaseAsync(apiResults);
            // 缓存到Redis
            await _redisService.CacheStockSearchAsync(keyword, apiResults);
            await _redisService.CacheStockBasicsAsync(apiResults);
        }

        return apiResults;
    }

    public async Task<StockBasic?> GetStockByCodeAsync(string stockCode)
    {
        // 1. 检查Redis缓存
        var cached = await _redisService.GetStockBasicAsync(stockCode);
        if (cached != null)
            return cached;

        // 2. 检查数据库
        var dbStock = await _dbContext.StockBasics
            .FirstOrDefaultAsync(s => s.StockCode == stockCode);
        
        if (dbStock != null)
        {
            // 缓存到Redis
            await _redisService.CacheStockBasicAsync(dbStock);
            return dbStock;
        }

        // 3. 调用第三方API搜索
        var stocks = await SearchFromThirdPartyApiAsync(stockCode);
        var stock = stocks.FirstOrDefault(s => s.StockCode == stockCode);
        
        if (stock != null)
        {
            // 保存到数据库
            await SaveToDatabaseAsync(new List<StockBasic> { stock });
            // 缓存到Redis
            await _redisService.CacheStockBasicAsync(stock);
        }

        return stock;
    }

    public async Task RefreshStockCacheAsync()
    {
        // 从数据库加载所有心魔
        var allStocks = await _dbContext.StockBasics.ToListAsync();
        
        // 更新Redis缓存
        await _redisService.CacheStockBasicsAsync(allStocks);
        
        _logger.LogInformation("已刷新心魔缓存，数量: {Count}", allStocks.Count);
    }

    public async Task<int> GetCachedStockCountAsync()
    {
        var count = (int)await _redisService.GetStockCacheCountAsync();
        return count;
    }

    private async Task<List<StockBasic>> SearchInDatabaseAsync(string keyword)
    {
        var query = _dbContext.StockBasics.AsQueryable();
        
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(s => 
                s.StockCode.Contains(keyword) ||
                s.StockName.Contains(keyword) ||
                (s.StockAbbr != null && s.StockAbbr.Contains(keyword))
            );
        }
        
        return await query.Take(20).ToListAsync();
    }

    private async Task<List<StockBasic>> SearchFromThirdPartyApiAsync(string keyword)
    {
        try
        {
            var url = $"{EastMoneyApi}?input={Uri.EscapeDataString(keyword)}&type=14&token={EastMoneyToken}&count=20";
            var response = await _httpClient.GetAsync(url);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("第三方API调用失败: {StatusCode}", response.StatusCode);
                return new List<StockBasic>();
            }

            var result = await response.Content.ReadFromJsonAsync<EastMoneyResponse>();
            if (result?.QuotationCodeTable?.Data == null)
                return new List<StockBasic>();

            var stocks = new List<StockBasic>();
            foreach (var item in result.QuotationCodeTable.Data)
            {
                var board = DetermineBoard(item.Code);
                var stock = new StockBasic
                {
                    StockCode = item.Code,
                    StockName = item.Name,
                    StockAbbr = item.Abbr,
                    Board = board,
                    LastUpdated = DateTime.UtcNow,
                    CacheExpiry = DateTime.UtcNow.Add(RedisConfig.DefaultExpiry)
                };
                stocks.Add(stock);
            }

            _logger.LogDebug("从第三方API获取到 {Count} 只心魔", stocks.Count);
            return stocks;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "第三方API搜索失败: {Keyword}", keyword);
            return new List<StockBasic>();
        }
    }

    private async Task SaveToDatabaseAsync(List<StockBasic> stocks)
    {
        foreach (var stock in stocks)
        {
            var existing = await _dbContext.StockBasics
                .FirstOrDefaultAsync(s => s.StockCode == stock.StockCode);
            
            if (existing == null)
            {
                _dbContext.StockBasics.Add(stock);
            }
            else
            {
                existing.StockName = stock.StockName;
                existing.StockAbbr = stock.StockAbbr;
                existing.Board = stock.Board;
                existing.LastUpdated = DateTime.UtcNow;
                existing.CacheExpiry = stock.CacheExpiry;
            }
        }
        
        await _dbContext.SaveChangesAsync();
        _logger.LogDebug("已保存 {Count} 只心魔到数据库", stocks.Count);
    }

    private string DetermineBoard(string stockCode)
    {
        if (stockCode.StartsWith("000") || stockCode.StartsWith("001") || 
            stockCode.StartsWith("002") || stockCode.StartsWith("003"))
            return "主板";
        else if (stockCode.StartsWith("300"))
            return "创业板";
        else if (stockCode.StartsWith("688"))
            return "科创板";
        else if (stockCode.StartsWith("830") || stockCode.StartsWith("831") || 
                 stockCode.StartsWith("832") || stockCode.StartsWith("833"))
            return "北交所";
        else
            return "主板"; // 默认
    }

    // 东方财富API响应模型
    private class EastMoneyResponse
    {
        public QuotationCodeTable? QuotationCodeTable { get; set; }
    }

    private class QuotationCodeTable
    {
        public List<EastMoneyStock>? Data { get; set; }
    }

    private class EastMoneyStock
    {
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Abbr { get; set; } = string.Empty;
        public string Market { get; set; } = string.Empty;
    }
}