using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lies.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddPositionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CostPrice",
                table: "StockTrades",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CurrentPrice",
                table: "StockTrades",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CostPrice",
                table: "StockTrades");

            migrationBuilder.DropColumn(
                name: "CurrentPrice",
                table: "StockTrades");
        }
    }
}
