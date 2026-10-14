using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fachschaften_ERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddedBackup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BackupRuns",
                schema: "erp",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Trigger = table.Column<int>(type: "integer", nullable: false),
                    TriggeredById = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Started = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Finished = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    Message = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BackupRuns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BackupSettings",
                schema: "erp",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    WebDavUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Username = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ProtectedPassword = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    KeepCount = table.Column<int>(type: "integer", nullable: false),
                    IncludeCsv = table.Column<bool>(type: "boolean", nullable: false),
                    ProtectedArchivePassword = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    NotifyEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    ModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    Modified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BackupSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BackupRuns_Started",
                schema: "erp",
                table: "BackupRuns",
                column: "Started");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BackupRuns",
                schema: "erp");

            migrationBuilder.DropTable(
                name: "BackupSettings",
                schema: "erp");
        }
    }
}
