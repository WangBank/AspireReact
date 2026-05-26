namespace AspireReact.Server.Data;

public static class DatabaseConfig
{
    public const string DatabaseName = "lies";
    
    public static string GetConnectionString(IConfiguration configuration)
    {
        var host = configuration["POSTGRES_HOST"] ?? "localhost";
        var port = configuration["POSTGRES_PORT"] ?? "5432";
        var username = configuration["POSTGRES_USER"] ?? "postgres";
        var password = configuration["POSTGRES_PASSWORD"] ?? "password";
        
        return $"Host={host};Port={port};Database={DatabaseName};Username={username};Password={password};";
    }
}