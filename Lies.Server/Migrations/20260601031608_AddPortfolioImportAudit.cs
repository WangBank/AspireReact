using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Lies.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddPortfolioImportAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PortfolioImportAudits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ImportDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RecognizedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SourceFileName = table.Column<string>(type: "text", nullable: false),
                    ContentType = table.Column<string>(type: "text", nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    ParseSuccess = table.Column<bool>(type: "boolean", nullable: false),
                    ParseMessage = table.Column<string>(type: "text", nullable: false),
                    PositionCount = table.Column<int>(type: "integer", nullable: false),
                    WarningCount = table.Column<int>(type: "integer", nullable: false),
                    StoredImagePath = table.Column<string>(type: "text", nullable: true),
                    RecognizedText = table.Column<string>(type: "text", nullable: true),
                    RecognizedPayloadJson = table.Column<string>(type: "text", nullable: true),
                    SaveAttempted = table.Column<bool>(type: "boolean", nullable: false),
                    SaveCompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SaveStatus = table.Column<string>(type: "text", nullable: true),
                    SavedAccount = table.Column<bool>(type: "boolean", nullable: false),
                    SavedBankFlow = table.Column<bool>(type: "boolean", nullable: false),
                    SavedTrades = table.Column<bool>(type: "boolean", nullable: false),
                    RequestedTradeCount = table.Column<int>(type: "integer", nullable: false),
                    SavedTradeCount = table.Column<int>(type: "integer", nullable: false),
                    FinalPayloadJson = table.Column<string>(type: "text", nullable: true),
                    SaveErrorsJson = table.Column<string>(type: "text", nullable: true),
                    SaveMessage = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PortfolioImportAudits", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PortfolioImportAudits_CreatedAt",
                table: "PortfolioImportAudits",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_PortfolioImportAudits_ImportDate",
                table: "PortfolioImportAudits",
                column: "ImportDate");

            migrationBuilder.CreateIndex(
                name: "IX_PortfolioImportAudits_SaveStatus",
                table: "PortfolioImportAudits",
                column: "SaveStatus");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PortfolioImportAudits");
        }
    }
}
