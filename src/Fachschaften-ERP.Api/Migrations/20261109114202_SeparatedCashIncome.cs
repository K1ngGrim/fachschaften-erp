using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fachschaften_ERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeparatedCashIncome : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CashIncomes",
                schema: "erp",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    Modified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    Source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashIncomes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CashIncomes_Date",
                schema: "erp",
                table: "CashIncomes",
                column: "Date");

            // Bisherige Kasseneinnahmen wandern mit gleicher Id in die eigene Tabelle und
            // verschwinden (weich gelöscht) aus den Buchungen der Finanzen.
            migrationBuilder.Sql("""
                INSERT INTO erp."CashIncomes"
                    ("Id", "CreatorId", "Created", "ModifierId", "Modified", "IsActive",
                     "Date", "Amount", "Source", "Description")
                SELECT "Id", "CreatorId", "Created", "ModifierId", "Modified", TRUE,
                       "Date", "Amount", "Source", "Description"
                FROM erp."Bookings"
                WHERE "Source" IS NOT NULL AND "IsActive";

                UPDATE erp."Bookings"
                SET "IsActive" = FALSE, "Modified" = now()
                WHERE "Source" IS NOT NULL AND "IsActive";
                """);

            migrationBuilder.DropColumn(
                name: "Source",
                schema: "erp",
                table: "Bookings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Source",
                schema: "erp",
                table: "Bookings",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            // Übernommene Einträge wieder aktivieren, neu erfasste als Buchungen anlegen.
            migrationBuilder.Sql("""
                UPDATE erp."Bookings" b
                SET "Source" = c."Source", "IsActive" = c."IsActive"
                FROM erp."CashIncomes" c
                WHERE b."Id" = c."Id";

                INSERT INTO erp."Bookings"
                    ("Id", "CreatorId", "Created", "ModifierId", "Modified", "IsActive",
                     "Date", "Amount", "Description", "TaxArea", "Source")
                SELECT c."Id", c."CreatorId", c."Created", c."ModifierId", c."Modified", c."IsActive",
                       c."Date", c."Amount", c."Description", 'Wirtschaftsbetrieb', c."Source"
                FROM erp."CashIncomes" c
                WHERE NOT EXISTS (SELECT 1 FROM erp."Bookings" b WHERE b."Id" = c."Id");
                """);

            migrationBuilder.DropTable(
                name: "CashIncomes",
                schema: "erp");
        }
    }
}
