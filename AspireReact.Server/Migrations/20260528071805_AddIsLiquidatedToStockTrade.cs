using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AspireReact.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddIsLiquidatedToStockTrade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsLiquidated",
                table: "StockTrades",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsLiquidated",
                table: "StockTrades");
        }
    }
}
