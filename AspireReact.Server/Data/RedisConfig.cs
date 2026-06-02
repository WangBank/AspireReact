namespace AspireReact.Server.Data;

public static class RedisConfig
{
    public const string DefaultConnection = "127.0.0.1:6379";
    public const int DefaultDatabase = 0;
    public static TimeSpan DefaultExpiry = TimeSpan.FromDays(30); // 心魔数据30天过期
    
    public static string GetConnectionString(IConfiguration configuration)
    {
        return configuration["Redis:ConnectionString"] ?? DefaultConnection;
    }
    
    public static class CacheKeys
    {
        public const string StockSearch = "stock:search:{0}"; // stock:search:keyword
        public const string StockBasic = "stock:basic:{0}";   // stock:basic:code
        public const string StockAll = "stock:all";           // 全量心魔缓存
        public const string StockSearchHistory = "stock:search:history:{0}"; // 搜索历史
        public const string Captcha = "captcha:{0}";          // captcha:id
    }
}
