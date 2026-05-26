using AspireReact.Server.Entities;
using Microsoft.EntityFrameworkCore;

namespace AspireReact.Server.Data;

public static class DatabaseInitializer
{
    public static async Task InitializeAsync(AppDbContext context)
    {
        // 确保数据库已创建
        await context.Database.EnsureCreatedAsync();
        
        // 添加一些初始数据（可选）
        if (!await context.StockBasics.AnyAsync())
        {
            var initialStocks = new List<StockBasic>
            {
                new StockBasic { StockCode = "000001", StockName = "平安银行", StockAbbr = "PAYH", Board = "主板" },
                new StockBasic { StockCode = "000002", StockName = "万科A", StockAbbr = "WKA", Board = "主板" },
                new StockBasic { StockCode = "300750", StockName = "宁德时代", StockAbbr = "NDSD", Board = "创业板" },
                new StockBasic { StockCode = "688981", StockName = "中芯国际", StockAbbr = "ZXGJ", Board = "科创板" },
                new StockBasic { StockCode = "830946", StockName = "森萱医药", StockAbbr = "SXYY", Board = "北交所" }
            };
            
            await context.StockBasics.AddRangeAsync(initialStocks);
            await context.SaveChangesAsync();
        }
    }
}