using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fachschaften_ERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddedDocumentsModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DocumentAssets",
                schema: "erp",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Data = table.Column<byte[]>(type: "bytea", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentAssets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DocumentTemplates",
                schema: "erp",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    StoreDocuments = table.Column<bool>(type: "boolean", nullable: false),
                    CurrentVersion = table.Column<int>(type: "integer", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    Modified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GeneratedDocuments",
                schema: "erp",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateVersion = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Values = table.Column<string>(type: "jsonb", nullable: false),
                    Pdf = table.Column<byte[]>(type: "bytea", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    Modified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GeneratedDocuments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ModuleStates",
                schema: "erp",
                columns: table => new
                {
                    Key = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    ModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    Modified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModuleStates", x => x.Key);
                });

            migrationBuilder.CreateTable(
                name: "DocumentTemplateVersions",
                schema: "erp",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    Source = table.Column<string>(type: "text", nullable: false),
                    Fields = table.Column<string>(type: "jsonb", nullable: false),
                    AssetIds = table.Column<string>(type: "jsonb", nullable: false),
                    Comment = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentTemplateVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DocumentTemplateVersions_DocumentTemplates_TemplateId",
                        column: x => x.TemplateId,
                        principalSchema: "erp",
                        principalTable: "DocumentTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DocumentAssets_TemplateId",
                schema: "erp",
                table: "DocumentAssets",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentTemplateVersions_TemplateId_Version",
                schema: "erp",
                table: "DocumentTemplateVersions",
                columns: new[] { "TemplateId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GeneratedDocuments_TemplateId",
                schema: "erp",
                table: "GeneratedDocuments",
                column: "TemplateId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DocumentAssets",
                schema: "erp");

            migrationBuilder.DropTable(
                name: "DocumentTemplateVersions",
                schema: "erp");

            migrationBuilder.DropTable(
                name: "GeneratedDocuments",
                schema: "erp");

            migrationBuilder.DropTable(
                name: "ModuleStates",
                schema: "erp");

            migrationBuilder.DropTable(
                name: "DocumentTemplates",
                schema: "erp");
        }
    }
}
