using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lies.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageFileAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "file_content_type",
                table: "user_messages",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "file_name",
                table: "user_messages",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "file_size_bytes",
                table: "user_messages",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "file_storage_path",
                table: "user_messages",
                type: "character varying(600)",
                maxLength: 600,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "file_content_type",
                table: "user_messages");

            migrationBuilder.DropColumn(
                name: "file_name",
                table: "user_messages");

            migrationBuilder.DropColumn(
                name: "file_size_bytes",
                table: "user_messages");

            migrationBuilder.DropColumn(
                name: "file_storage_path",
                table: "user_messages");
        }
    }
}
