using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fachschaften_ERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddedConfidentialTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsConfidential",
                schema: "erp",
                table: "CustomTables",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "KeyVersion",
                schema: "erp",
                table: "CustomTables",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "EncryptedValues",
                schema: "erp",
                table: "CustomTableRows",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Vaults",
                schema: "erp",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsRecovery = table.Column<bool>(type: "boolean", nullable: false),
                    PublicKey = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    EncryptedPrivateKey = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Salt = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Iterations = table.Column<int>(type: "integer", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Modified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Vaults", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CustomTableKeys",
                schema: "erp",
                columns: table => new
                {
                    TableId = table.Column<Guid>(type: "uuid", nullable: false),
                    VaultId = table.Column<Guid>(type: "uuid", nullable: false),
                    WrappedKey = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    GrantedById = table.Column<Guid>(type: "uuid", nullable: false),
                    Granted = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomTableKeys", x => new { x.TableId, x.VaultId });
                    table.ForeignKey(
                        name: "FK_CustomTableKeys_CustomTables_TableId",
                        column: x => x.TableId,
                        principalSchema: "erp",
                        principalTable: "CustomTables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CustomTableKeys_Vaults_VaultId",
                        column: x => x.VaultId,
                        principalSchema: "erp",
                        principalTable: "Vaults",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CustomTableKeys_VaultId",
                schema: "erp",
                table: "CustomTableKeys",
                column: "VaultId");

            migrationBuilder.CreateIndex(
                name: "IX_Vaults_UserId",
                schema: "erp",
                table: "Vaults",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CustomTableKeys",
                schema: "erp");

            migrationBuilder.DropTable(
                name: "Vaults",
                schema: "erp");

            migrationBuilder.DropColumn(
                name: "IsConfidential",
                schema: "erp",
                table: "CustomTables");

            migrationBuilder.DropColumn(
                name: "KeyVersion",
                schema: "erp",
                table: "CustomTables");

            migrationBuilder.DropColumn(
                name: "EncryptedValues",
                schema: "erp",
                table: "CustomTableRows");
        }
    }
}
