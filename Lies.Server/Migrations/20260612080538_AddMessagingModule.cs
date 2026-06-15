using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Lies.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddMessagingModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "last_seen_at",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "message_conversations",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    pair_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    last_message_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_message_preview = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    last_message_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_message_conversations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "user_contacts",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    owner_user_id = table.Column<int>(type: "integer", nullable: false),
                    contact_user_id = table.Column<int>(type: "integer", nullable: false),
                    alias = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    is_pinned = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_contacts", x => x.id);
                    table.ForeignKey(
                        name: "FK_user_contacts_users_contact_user_id",
                        column: x => x.contact_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_contacts_users_owner_user_id",
                        column: x => x.owner_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "message_conversation_participants",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    conversation_id = table.Column<int>(type: "integer", nullable: false),
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    last_read_message_id = table.Column<int>(type: "integer", nullable: true),
                    last_read_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_pinned = table.Column<bool>(type: "boolean", nullable: false),
                    is_muted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_message_conversation_participants", x => x.id);
                    table.ForeignKey(
                        name: "FK_message_conversation_participants_message_conversations_con~",
                        column: x => x.conversation_id,
                        principalTable: "message_conversations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_message_conversation_participants_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_messages",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    conversation_id = table.Column<int>(type: "integer", nullable: false),
                    sender_user_id = table.Column<int>(type: "integer", nullable: false),
                    message_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    text_content = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    image_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    image_file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_messages", x => x.id);
                    table.ForeignKey(
                        name: "FK_user_messages_message_conversations_conversation_id",
                        column: x => x.conversation_id,
                        principalTable: "message_conversations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_messages_users_sender_user_id",
                        column: x => x.sender_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_message_conversation_participants_conversation_id_user_id",
                table: "message_conversation_participants",
                columns: new[] { "conversation_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_message_conversation_participants_user_id_is_pinned",
                table: "message_conversation_participants",
                columns: new[] { "user_id", "is_pinned" });

            migrationBuilder.CreateIndex(
                name: "IX_message_conversations_last_message_at",
                table: "message_conversations",
                column: "last_message_at");

            migrationBuilder.CreateIndex(
                name: "IX_message_conversations_pair_key",
                table: "message_conversations",
                column: "pair_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_contacts_contact_user_id",
                table: "user_contacts",
                column: "contact_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_contacts_owner_user_id_contact_user_id",
                table: "user_contacts",
                columns: new[] { "owner_user_id", "contact_user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_contacts_owner_user_id_is_pinned",
                table: "user_contacts",
                columns: new[] { "owner_user_id", "is_pinned" });

            migrationBuilder.CreateIndex(
                name: "IX_user_messages_conversation_id_created_at",
                table: "user_messages",
                columns: new[] { "conversation_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_user_messages_sender_user_id_created_at",
                table: "user_messages",
                columns: new[] { "sender_user_id", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "message_conversation_participants");

            migrationBuilder.DropTable(
                name: "user_contacts");

            migrationBuilder.DropTable(
                name: "user_messages");

            migrationBuilder.DropTable(
                name: "message_conversations");

            migrationBuilder.DropColumn(
                name: "last_seen_at",
                table: "users");
        }
    }
}
