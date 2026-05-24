using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fachschaften_ERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddedPriceAndStockFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SellingPrice",
                schema: "erp",
                table: "Products",
                newName: "InternalSellingPrice");

            migrationBuilder.AddColumn<decimal>(
                name: "ExternalSellingPrice",
                schema: "erp",
                table: "Products",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "UnitPurchasePrice",
                schema: "erp",
                table: "InventoryTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "UnitSellingPrice",
                schema: "erp",
                table: "InventoryTransactions",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExternalSellingPrice",
                schema: "erp",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "UnitPurchasePrice",
                schema: "erp",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "UnitSellingPrice",
                schema: "erp",
                table: "InventoryTransactions");

            migrationBuilder.RenameColumn(
                name: "InternalSellingPrice",
                schema: "erp",
                table: "Products",
                newName: "SellingPrice");
        }
    }
}
