using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lies.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageReplyRecallFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_recalled",
                table: "user_messages",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "recalled_at",
                table: "user_messages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "recalled_by_user_id",
                table: "user_messages",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "reply_to_message_id",
                table: "user_messages",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_messages_reply_to_message_id",
                table: "user_messages",
                column: "reply_to_message_id");

            migrationBuilder.AddForeignKey(
                name: "FK_user_messages_user_messages_reply_to_message_id",
                table: "user_messages",
                column: "reply_to_message_id",
                principalTable: "user_messages",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_user_messages_user_messages_reply_to_message_id",
                table: "user_messages");

            migrationBuilder.DropIndex(
                name: "IX_user_messages_reply_to_message_id",
                table: "user_messages");

            migrationBuilder.DropColumn(
                name: "is_recalled",
                table: "user_messages");

            migrationBuilder.DropColumn(
                name: "recalled_at",
                table: "user_messages");

            migrationBuilder.DropColumn(
                name: "recalled_by_user_id",
                table: "user_messages");

            migrationBuilder.DropColumn(
                name: "reply_to_message_id",
                table: "user_messages");
        }
    }
}
