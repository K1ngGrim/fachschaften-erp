using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fachschaften_ERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddedUserInvites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Created",
                schema: "identity",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CreatorId",
                schema: "identity",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsActive",
                schema: "identity",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Modified",
                schema: "identity",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ModifierId",
                schema: "identity",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Created",
                schema: "identity",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "CreatorId",
                schema: "identity",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "IsActive",
                schema: "identity",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "Modified",
                schema: "identity",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "ModifierId",
                schema: "identity",
                table: "Roles");

            migrationBuilder.CreateTable(
                name: "Invites",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Require2Fa = table.Column<bool>(type: "boolean", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Accepted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Invites", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Invites",
                schema: "identity");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Created",
                schema: "identity",
                table: "Users",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<Guid>(
                name: "CreatorId",
                schema: "identity",
                table: "Users",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                schema: "identity",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Modified",
                schema: "identity",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ModifierId",
                schema: "identity",
                table: "Users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Created",
                schema: "identity",
                table: "Roles",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<Guid>(
                name: "CreatorId",
                schema: "identity",
                table: "Roles",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                schema: "identity",
                table: "Roles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "Modified",
                schema: "identity",
                table: "Roles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ModifierId",
                schema: "identity",
                table: "Roles",
                type: "uuid",
                nullable: true);
        }
    }
}
