using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fachschaften_ERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddedCustomFieldEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CustomFields",
                schema: "erp",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Label = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Required = table.Column<bool>(type: "boolean", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    SelectOptions = table.Column<string>(type: "jsonb", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    Modified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomFields", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CustomFieldEntityItemTypeEntity",
                schema: "erp",
                columns: table => new
                {
                    CustomFieldsId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemTypesId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomFieldEntityItemTypeEntity", x => new { x.CustomFieldsId, x.ItemTypesId });
                    table.ForeignKey(
                        name: "FK_CustomFieldEntityItemTypeEntity_CustomFields_CustomFieldsId",
                        column: x => x.CustomFieldsId,
                        principalSchema: "erp",
                        principalTable: "CustomFields",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CustomFieldEntityItemTypeEntity_ItemTypes_ItemTypesId",
                        column: x => x.ItemTypesId,
                        principalSchema: "erp",
                        principalTable: "ItemTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CustomFieldEntityItemTypeEntity_ItemTypesId",
                schema: "erp",
                table: "CustomFieldEntityItemTypeEntity",
                column: "ItemTypesId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CustomFieldEntityItemTypeEntity",
                schema: "erp");

            migrationBuilder.DropTable(
                name: "CustomFields",
                schema: "erp");
        }
    }
}
