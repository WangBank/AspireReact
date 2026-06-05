using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lies.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddUserOwnershipToPortfolioImportAudits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "PortfolioImportAudits",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PortfolioImportAudits_UserId",
                table: "PortfolioImportAudits",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_PortfolioImportAudits_users_UserId",
                table: "PortfolioImportAudits",
                column: "UserId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PortfolioImportAudits_users_UserId",
                table: "PortfolioImportAudits");

            migrationBuilder.DropIndex(
                name: "IX_PortfolioImportAudits_UserId",
                table: "PortfolioImportAudits");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "PortfolioImportAudits");
        }
    }
}
