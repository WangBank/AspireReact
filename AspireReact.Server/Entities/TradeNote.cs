namespace AspireReact.Server.Entities;

public class TradeNote
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public string? StockCode { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}