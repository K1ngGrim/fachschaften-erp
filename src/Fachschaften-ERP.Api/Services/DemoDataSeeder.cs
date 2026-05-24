using System.Text.Json;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities;
using Fachschaften_ERP.Models.Entities.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Api.Services;

public static class DemoDataSeeder
{
    public static async Task SeedAsync(IServiceProvider services, IWebHostEnvironment env)
    {
        if (!env.IsDevelopment()) return; // nur in Development

        var db = services.GetRequiredService<CoreContext>();
        var userManager = services.GetRequiredService<UserManager<IdentityUserEntity>>();

        if (await db.ItemTypes.AnyAsync()) return; // bereits geseedet

        var admin = await userManager.FindByNameAsync("admin");
        var adminId = admin!.Id;
        var now = DateTimeOffset.UtcNow;

        // Item Types
        var beverage = new ItemTypeEntity
        {
            Id = Guid.NewGuid(), Name = "Beverage", Icon = "local_bar",
            CreatorId = adminId, Created = now, IsActive = true,
        };
        var clothing = new ItemTypeEntity
        {
            Id = Guid.NewGuid(), Name = "Clothing", Icon = "checkroom",
            CreatorId = adminId, Created = now, IsActive = true,
        };
        var equipment = new ItemTypeEntity
        {
            Id = Guid.NewGuid(), Name = "Equipment", Icon = "build",
            CreatorId = adminId, Created = now, IsActive = true,
        };
        db.ItemTypes.AddRange(beverage, clothing, equipment);

        // Suppliers
        var getraenke = new SupplierEntity
        {
            Id = Guid.NewGuid(), Name = "Getränke Müller",
            CreatorId = adminId, Created = now, IsActive = true,
        };
        var sportsdruck = new SupplierEntity
        {
            Id = Guid.NewGuid(), Name = "SportsDruck GmbH",
            CreatorId = adminId, Created = now, IsActive = true,
        };
        var elektronik = new SupplierEntity
        {
            Id = Guid.NewGuid(), Name = "Elektronik Depot",
            CreatorId = adminId, Created = now, IsActive = true,
        };
        db.Suppliers.AddRange(getraenke, sportsdruck, elektronik);

        // Custom Fields
        var alcoholicField = new CustomFieldEntity
        {
            Id = Guid.NewGuid(), Name = "alcoholic", Label = "Alcoholic",
            Type = CustomFieldType.Boolean, Required = false, Order = 0,
            ItemTypes = [beverage],
            CreatorId = adminId, Created = now, IsActive = true,
        };
        var depositField = new CustomFieldEntity
        {
            Id = Guid.NewGuid(), Name = "deposit", Label = "Deposit (€)",
            Type = CustomFieldType.Number, Required = false, Order = 1,
            ItemTypes = [beverage],
            CreatorId = adminId, Created = now, IsActive = true,
        };
        var sizeField = new CustomFieldEntity
        {
            Id = Guid.NewGuid(), Name = "size", Label = "Size",
            Type = CustomFieldType.Select, Required = false, Order = 0,
            SelectOptions = ["XS", "S", "M", "L", "XL", "XXL"],
            ItemTypes = [clothing],
            CreatorId = adminId, Created = now, IsActive = true,
        };
        var colorField = new CustomFieldEntity
        {
            Id = Guid.NewGuid(), Name = "color", Label = "Color",
            Type = CustomFieldType.Text, Required = false, Order = 1,
            ItemTypes = [clothing, equipment],
            CreatorId = adminId, Created = now, IsActive = true,
        };
        db.CustomFields.AddRange(alcoholicField, depositField, sizeField, colorField);

        // Products
        var spezi = new ProductEntity
        {
            Id = Guid.NewGuid(), Name = "Spezi 0,5l",
            PurchasePrice = 0.89m, InternalSellingPrice = 1.00m, ExternalSellingPrice = 1.50m,
            LowStockThreshold = 24, TrackStock = true,
            CustomFieldValues = JsonDocument.Parse("{\"alcoholic\": false, \"deposit\": 0.25}"),
            ItemTypeId = beverage.Id, SupplierId = getraenke.Id,
            CreatorId = adminId, Created = now, IsActive = true,
        };
        var bier = new ProductEntity
        {
            Id = Guid.NewGuid(), Name = "Club Bier Kasten",
            PurchasePrice = 14.00m, InternalSellingPrice = 18.00m, ExternalSellingPrice = 20.00m,
            LowStockThreshold = 3, TrackStock = true,
            CustomFieldValues = JsonDocument.Parse("{\"alcoholic\": true, \"deposit\": 3.10}"),
            ItemTypeId = beverage.Id, SupplierId = getraenke.Id,
            CreatorId = adminId, Created = now, IsActive = true,
        };
        var tshirt = new ProductEntity
        {
            Id = Guid.NewGuid(), Name = "Club T-Shirt",
            PurchasePrice = 8.50m, InternalSellingPrice = 12.00m, ExternalSellingPrice = 15.00m,
            LowStockThreshold = 10, TrackStock = true,
            CustomFieldValues = JsonDocument.Parse("{\"size\": \"M\", \"color\": \"navy\"}"),
            ItemTypeId = clothing.Id, SupplierId = sportsdruck.Id,
            CreatorId = adminId, Created = now, IsActive = true,
        };
        var hdmi = new ProductEntity
        {
            Id = Guid.NewGuid(), Name = "HDMI Kabel 2m",
            PurchasePrice = 7.00m, InternalSellingPrice = 0m, ExternalSellingPrice = 0m,
            LowStockThreshold = 2, TrackStock = true,
            CustomFieldValues = JsonDocument.Parse("{}"),
            ItemTypeId = equipment.Id, SupplierId = elektronik.Id,
            CreatorId = adminId, Created = now, IsActive = true,
        };
        db.Products.AddRange(spezi, bier, tshirt, hdmi);

        await db.SaveChangesAsync();

        // Inventory Transactions
        db.InventoryTransactions.AddRange(
            new InventoryTransactionEntity
            {
                Id = Guid.NewGuid(), ProductId = spezi.Id, Quantity = 48,
                UnitPurchasePrice = spezi.PurchasePrice, UnitSellingPrice = spezi.ExternalSellingPrice,
                Type = InventoryTransactionType.Delivery, Note = "Erstlieferung",
                CreatorId = adminId, Created = now.AddDays(-10), IsActive = true,
            },
            new InventoryTransactionEntity
            {
                Id = Guid.NewGuid(), ProductId = spezi.Id, Quantity = -12,
                UnitPurchasePrice = spezi.PurchasePrice, UnitSellingPrice = spezi.ExternalSellingPrice,
                Type = InventoryTransactionType.Sale, Note = "Semesterparty",
                CreatorId = adminId, Created = now.AddDays(-5), IsActive = true,
            },
            new InventoryTransactionEntity
            {
                Id = Guid.NewGuid(), ProductId = bier.Id, Quantity = 10,
                UnitPurchasePrice = bier.PurchasePrice, UnitSellingPrice = bier.ExternalSellingPrice,
                Type = InventoryTransactionType.Delivery,
                CreatorId = adminId, Created = now.AddDays(-8), IsActive = true,
            },
            new InventoryTransactionEntity
            {
                Id = Guid.NewGuid(), ProductId = bier.Id, Quantity = -3,
                UnitPurchasePrice = bier.PurchasePrice, UnitSellingPrice = bier.ExternalSellingPrice,
                Type = InventoryTransactionType.Sale,
                CreatorId = adminId, Created = now.AddDays(-2), IsActive = true,
            },
            new InventoryTransactionEntity
            {
                Id = Guid.NewGuid(), ProductId = tshirt.Id, Quantity = 20,
                UnitPurchasePrice = tshirt.PurchasePrice, UnitSellingPrice = tshirt.ExternalSellingPrice,
                Type = InventoryTransactionType.Delivery,
                CreatorId = adminId, Created = now.AddDays(-14), IsActive = true,
            },
            new InventoryTransactionEntity
            {
                Id = Guid.NewGuid(), ProductId = hdmi.Id, Quantity = 5,
                UnitPurchasePrice = hdmi.PurchasePrice, UnitSellingPrice = 0,
                Type = InventoryTransactionType.Delivery,
                CreatorId = adminId, Created = now.AddDays(-20), IsActive = true,
            }
        );

        await db.SaveChangesAsync();
    }
}