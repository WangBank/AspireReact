using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Lies.Server.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StockBasics",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    StockCode = table.Column<string>(type: "text", nullable: false),
                    StockName = table.Column<string>(type: "text", nullable: false),
                    StockAbbr = table.Column<string>(type: "text", nullable: true),
                    Board = table.Column<string>(type: "text", nullable: false),
                    LastUpdated = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CacheExpiry = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockBasics", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    username = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    email = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    last_login_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "AccountDailies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TotalAssets = table.Column<decimal>(type: "numeric", nullable: false),
                    PositionValue = table.Column<decimal>(type: "numeric", nullable: false),
                    AvailableFunds = table.Column<decimal>(type: "numeric", nullable: false),
                    DailyPnL = table.Column<decimal>(type: "numeric", nullable: false),
                    Remark = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountDailies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AccountDailies_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "BankFlows",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FlowType = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: false),
                    Remark = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankFlows", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BankFlows_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "StockTrades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TradeDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StockCode = table.Column<string>(type: "text", nullable: false),
                    StockName = table.Column<string>(type: "text", nullable: false),
                    Board = table.Column<int>(type: "integer", nullable: false),
                    BuyPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    BuyQuantity = table.Column<int>(type: "integer", nullable: false),
                    SellPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    SellQuantity = table.Column<int>(type: "integer", nullable: false),
                    PositionPnL = table.Column<decimal>(type: "numeric", nullable: false),
                    CumulativePnL = table.Column<decimal>(type: "numeric", nullable: false),
                    TradeNote = table.Column<string>(type: "text", nullable: true),
                    TonghuashunLink = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockTrades", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockTrades_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "TradeNotes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StockCode = table.Column<string>(type: "text", nullable: true),
                    Content = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TradeNotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TradeNotes_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccountDailies_Date",
                table: "AccountDailies",
                column: "Date",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AccountDailies_UserId",
                table: "AccountDailies",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_BankFlows_Date",
                table: "BankFlows",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_BankFlows_UserId",
                table: "BankFlows",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_StockBasics_StockCode",
                table: "StockBasics",
                column: "StockCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StockBasics_StockCode_StockName_StockAbbr",
                table: "StockBasics",
                columns: new[] { "StockCode", "StockName", "StockAbbr" });

            migrationBuilder.CreateIndex(
                name: "IX_StockTrades_TradeDate_StockCode",
                table: "StockTrades",
                columns: new[] { "TradeDate", "StockCode" });

            migrationBuilder.CreateIndex(
                name: "IX_StockTrades_UserId",
                table: "StockTrades",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TradeNotes_Date_StockCode",
                table: "TradeNotes",
                columns: new[] { "Date", "StockCode" });

            migrationBuilder.CreateIndex(
                name: "IX_TradeNotes_UserId",
                table: "TradeNotes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_username",
                table: "users",
                column: "username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccountDailies");

            migrationBuilder.DropTable(
                name: "BankFlows");

            migrationBuilder.DropTable(
                name: "StockBasics");

            migrationBuilder.DropTable(
                name: "StockTrades");

            migrationBuilder.DropTable(
                name: "TradeNotes");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
