namespace Lies.Server.Data;

public static class DatabaseConfig
{
    public const string DatabaseName = "lies";
    
    public static string GetConnectionString(IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("PostgreSQL");
        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException("PostgreSQL connection string is not configured.");
        }
        return connectionString;

    }
}