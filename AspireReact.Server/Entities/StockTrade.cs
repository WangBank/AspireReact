namespace AspireReact.Server.Entities;

public enum TradeBoard { 主板, 创业板, 科创板, 北交所 }

public class StockTrade
{
    public int Id { get; set; }
    public DateTime TradeDate { get; set; }
    public string StockCode { get; set; } = string.Empty;
    public string StockName { get; set; } = string.Empty;
    public TradeBoard Board { get; set; }
    public decimal BuyPrice { get; set; }
    public int BuyQuantity { get; set; }
    public decimal SellPrice { get; set; }
    public int SellQuantity { get; set; }
    public decimal PositionPnL { get; set; }
    public decimal CumulativePnL { get; set; }
    public string? TradeNote { get; set; }
    public string? TonghuashunLink { get; set; }
}