using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lies.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddSellReasonAndEmotionTagsToStockTrade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EmotionTags",
                table: "StockTrades",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SellReason",
                table: "StockTrades",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmotionTags",
                table: "StockTrades");

            migrationBuilder.DropColumn(
                name: "SellReason",
                table: "StockTrades");
        }
    }
}
