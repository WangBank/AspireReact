using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AspireReact.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddPositionQuantityAndDailyPnL : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "DailyPnL",
                table: "StockTrades",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "PositionQuantity",
                table: "StockTrades",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DailyPnL",
                table: "StockTrades");

            migrationBuilder.DropColumn(
                name: "PositionQuantity",
                table: "StockTrades");
        }
    }
}
