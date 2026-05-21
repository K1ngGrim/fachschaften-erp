using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fachschaften_ERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class CustomFieldsConnectorTableName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CustomFieldEntityItemTypeEntity_CustomFields_CustomFieldsId",
                schema: "erp",
                table: "CustomFieldEntityItemTypeEntity");

            migrationBuilder.DropForeignKey(
                name: "FK_CustomFieldEntityItemTypeEntity_ItemTypes_ItemTypesId",
                schema: "erp",
                table: "CustomFieldEntityItemTypeEntity");

            migrationBuilder.DropPrimaryKey(
                name: "PK_CustomFieldEntityItemTypeEntity",
                schema: "erp",
                table: "CustomFieldEntityItemTypeEntity");

            migrationBuilder.RenameTable(
                name: "CustomFieldEntityItemTypeEntity",
                schema: "erp",
                newName: "ItemTypeCustomFields",
                newSchema: "erp");

            migrationBuilder.RenameIndex(
                name: "IX_CustomFieldEntityItemTypeEntity_ItemTypesId",
                schema: "erp",
                table: "ItemTypeCustomFields",
                newName: "IX_ItemTypeCustomFields_ItemTypesId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ItemTypeCustomFields",
                schema: "erp",
                table: "ItemTypeCustomFields",
                columns: new[] { "CustomFieldsId", "ItemTypesId" });

            migrationBuilder.AddForeignKey(
                name: "FK_ItemTypeCustomFields_CustomFields_CustomFieldsId",
                schema: "erp",
                table: "ItemTypeCustomFields",
                column: "CustomFieldsId",
                principalSchema: "erp",
                principalTable: "CustomFields",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ItemTypeCustomFields_ItemTypes_ItemTypesId",
                schema: "erp",
                table: "ItemTypeCustomFields",
                column: "ItemTypesId",
                principalSchema: "erp",
                principalTable: "ItemTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ItemTypeCustomFields_CustomFields_CustomFieldsId",
                schema: "erp",
                table: "ItemTypeCustomFields");

            migrationBuilder.DropForeignKey(
                name: "FK_ItemTypeCustomFields_ItemTypes_ItemTypesId",
                schema: "erp",
                table: "ItemTypeCustomFields");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ItemTypeCustomFields",
                schema: "erp",
                table: "ItemTypeCustomFields");

            migrationBuilder.RenameTable(
                name: "ItemTypeCustomFields",
                schema: "erp",
                newName: "CustomFieldEntityItemTypeEntity",
                newSchema: "erp");

            migrationBuilder.RenameIndex(
                name: "IX_ItemTypeCustomFields_ItemTypesId",
                schema: "erp",
                table: "CustomFieldEntityItemTypeEntity",
                newName: "IX_CustomFieldEntityItemTypeEntity_ItemTypesId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_CustomFieldEntityItemTypeEntity",
                schema: "erp",
                table: "CustomFieldEntityItemTypeEntity",
                columns: new[] { "CustomFieldsId", "ItemTypesId" });

            migrationBuilder.AddForeignKey(
                name: "FK_CustomFieldEntityItemTypeEntity_CustomFields_CustomFieldsId",
                schema: "erp",
                table: "CustomFieldEntityItemTypeEntity",
                column: "CustomFieldsId",
                principalSchema: "erp",
                principalTable: "CustomFields",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CustomFieldEntityItemTypeEntity_ItemTypes_ItemTypesId",
                schema: "erp",
                table: "CustomFieldEntityItemTypeEntity",
                column: "ItemTypesId",
                principalSchema: "erp",
                principalTable: "ItemTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
