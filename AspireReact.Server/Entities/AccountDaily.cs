namespace AspireReact.Server.Entities;

public class AccountDaily
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public decimal TotalAssets { get; set; }
    public decimal PositionValue { get; set; }
    public decimal AvailableFunds { get; set; }
    public decimal DailyPnL { get; set; }
    public string? Remark { get; set; }
}