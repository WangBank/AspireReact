using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AspireReact.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddTradeTagsToStockTrade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TradeTags",
                table: "StockTrades",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TradeTags",
                table: "StockTrades");
        }
    }
}
