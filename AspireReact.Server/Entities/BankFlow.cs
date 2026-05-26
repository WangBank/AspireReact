namespace AspireReact.Server.Entities;

public class BankFlow
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public string FlowType { get; set; } = string.Empty; // "转入" / "转出"
    public decimal Amount { get; set; }
    public string? Remark { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}