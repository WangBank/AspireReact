using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lies.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddUserScopedBusinessIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AccountDailies_users_UserId",
                table: "AccountDailies");

            migrationBuilder.DropForeignKey(
                name: "FK_BankFlows_users_UserId",
                table: "BankFlows");

            migrationBuilder.DropForeignKey(
                name: "FK_StockTrades_users_UserId",
                table: "StockTrades");

            migrationBuilder.DropForeignKey(
                name: "FK_TradeNotes_users_UserId",
                table: "TradeNotes");

            migrationBuilder.DropIndex(
                name: "IX_TradeNotes_Date_StockCode",
                table: "TradeNotes");

            migrationBuilder.DropIndex(
                name: "IX_TradeNotes_UserId",
                table: "TradeNotes");

            migrationBuilder.DropIndex(
                name: "IX_StockTrades_TradeDate_StockCode",
                table: "StockTrades");

            migrationBuilder.DropIndex(
                name: "IX_StockTrades_UserId",
                table: "StockTrades");

            migrationBuilder.DropIndex(
                name: "IX_BankFlows_Date",
                table: "BankFlows");

            migrationBuilder.DropIndex(
                name: "IX_BankFlows_UserId",
                table: "BankFlows");

            migrationBuilder.DropIndex(
                name: "IX_AccountDailies_Date",
                table: "AccountDailies");

            migrationBuilder.DropIndex(
                name: "IX_AccountDailies_UserId",
                table: "AccountDailies");

            migrationBuilder.CreateIndex(
                name: "IX_TradeNotes_UserId_Date_StockCode",
                table: "TradeNotes",
                columns: new[] { "UserId", "Date", "StockCode" });

            migrationBuilder.CreateIndex(
                name: "IX_StockTrades_UserId_TradeDate_StockCode",
                table: "StockTrades",
                columns: new[] { "UserId", "TradeDate", "StockCode" });

            migrationBuilder.CreateIndex(
                name: "IX_BankFlows_UserId_Date",
                table: "BankFlows",
                columns: new[] { "UserId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_AccountDailies_UserId_Date",
                table: "AccountDailies",
                columns: new[] { "UserId", "Date" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AccountDailies_users_UserId",
                table: "AccountDailies",
                column: "UserId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_BankFlows_users_UserId",
                table: "BankFlows",
                column: "UserId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_StockTrades_users_UserId",
                table: "StockTrades",
                column: "UserId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TradeNotes_users_UserId",
                table: "TradeNotes",
                column: "UserId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AccountDailies_users_UserId",
                table: "AccountDailies");

            migrationBuilder.DropForeignKey(
                name: "FK_BankFlows_users_UserId",
                table: "BankFlows");

            migrationBuilder.DropForeignKey(
                name: "FK_StockTrades_users_UserId",
                table: "StockTrades");

            migrationBuilder.DropForeignKey(
                name: "FK_TradeNotes_users_UserId",
                table: "TradeNotes");

            migrationBuilder.DropIndex(
                name: "IX_TradeNotes_UserId_Date_StockCode",
                table: "TradeNotes");

            migrationBuilder.DropIndex(
                name: "IX_StockTrades_UserId_TradeDate_StockCode",
                table: "StockTrades");

            migrationBuilder.DropIndex(
                name: "IX_BankFlows_UserId_Date",
                table: "BankFlows");

            migrationBuilder.DropIndex(
                name: "IX_AccountDailies_UserId_Date",
                table: "AccountDailies");

            migrationBuilder.CreateIndex(
                name: "IX_TradeNotes_Date_StockCode",
                table: "TradeNotes",
                columns: new[] { "Date", "StockCode" });

            migrationBuilder.CreateIndex(
                name: "IX_TradeNotes_UserId",
                table: "TradeNotes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_StockTrades_TradeDate_StockCode",
                table: "StockTrades",
                columns: new[] { "TradeDate", "StockCode" });

            migrationBuilder.CreateIndex(
                name: "IX_StockTrades_UserId",
                table: "StockTrades",
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
                name: "IX_AccountDailies_Date",
                table: "AccountDailies",
                column: "Date",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AccountDailies_UserId",
                table: "AccountDailies",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_AccountDailies_users_UserId",
                table: "AccountDailies",
                column: "UserId",
                principalTable: "users",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_BankFlows_users_UserId",
                table: "BankFlows",
                column: "UserId",
                principalTable: "users",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_StockTrades_users_UserId",
                table: "StockTrades",
                column: "UserId",
                principalTable: "users",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_TradeNotes_users_UserId",
                table: "TradeNotes",
                column: "UserId",
                principalTable: "users",
                principalColumn: "id");
        }
    }
}
