using System.Text.Json;
using Fachschaften_ERP.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Fachschaften_ERP.Models;

public partial class CoreContext
{
    public DbSet<ItemTypeEntity> ItemTypes => Set<ItemTypeEntity>();
    public DbSet<ProductEntity> Products => Set<ProductEntity>();
    public DbSet<SupplierEntity> Suppliers => Set<SupplierEntity>();
    public DbSet<CustomFieldEntity> CustomFields => Set<CustomFieldEntity>();
    public DbSet<InventoryTransactionEntity> InventoryTransactions => Set<InventoryTransactionEntity>();
    public DbSet<DeliveryEntity> Deliveries => Set<DeliveryEntity>();
    public DbSet<DeliveryPositionEntity> DeliveryPositions => Set<DeliveryPositionEntity>();
    public DbSet<BookingEntity> Bookings => Set<BookingEntity>();
    public DbSet<BookingCategoryEntity> BookingCategories => Set<BookingCategoryEntity>();
    public DbSet<CashBookEntity> CashBooks => Set<CashBookEntity>();
    
    private static void OnErpCreating(ModelBuilder modelBuilder)
    {

        modelBuilder.Entity<ProductEntity>(entity =>
        {
            entity.HasKey(p => p.Id);

            entity.Property(p => p.Name)
                .IsRequired()
                .HasMaxLength(255);

            entity.Property(p => p.PurchasePrice)
                .HasColumnType("numeric(10,2)");

            entity.Property(p => p.InternalSellingPrice)
                .HasColumnType("numeric(10,2)");

            entity.Property(p => p.CustomFieldValues)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => v.RootElement.GetRawText(),
                    v => JsonDocument.Parse(v, new JsonDocumentOptions())
                );

            entity.HasOne(p => p.ItemType)
                .WithMany(t => t.Products)
                .HasForeignKey(p => p.ItemTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(p => p.Supplier);
        });

        modelBuilder.Entity<ItemTypeEntity>(entity =>
        {
            entity.HasKey(t => t.Id);

            entity.Property(t => t.Name)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(t => t.Icon)
                .HasMaxLength(50);
        });


        modelBuilder.Entity<SupplierEntity>(entity =>
        {
            entity.HasKey(s => s.Id);

            entity.Property(s => s.Name)
                .IsRequired()
                .HasMaxLength(255);
        });

        modelBuilder.Entity<CustomFieldEntity>(entity =>
        {
            entity.HasKey(c => c.Id);
            
            entity.Property(c => c.Name)
                .IsRequired()
                .HasMaxLength(255);
            
            entity.Property(c => c.Label)
                .IsRequired()
                .HasMaxLength(255);
            
            entity.Property(c => c.SelectOptions)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions)null!),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions)null!) ?? new List<string>()
                );

            entity.HasMany(c => c.ItemTypes)
                .WithMany(i => i.CustomFields)
                .UsingEntity(j => j.ToTable("ItemTypeCustomFields"));
        });

        modelBuilder.Entity<InventoryTransactionEntity>(entity => 
        {
            entity.HasKey(i => i.Id);
            entity.HasOne(i => i.Product);

            entity.Property(i => i.Note)
                .HasMaxLength(255);

            entity.Property(i => i.ProductId)
                .IsRequired();
        });
        
        modelBuilder.Entity<DeliveryEntity>(entity =>
        {
            entity.HasKey(d => d.Id);

            entity.Property(d => d.DocumentNumber)
                .HasMaxLength(100);

            entity.Property(d => d.ReceiptUrl)
                .HasMaxLength(2048);

            entity.Property(d => d.Note)
                .HasMaxLength(255);

            entity.HasOne(d => d.Supplier)
                .WithMany()
                .HasForeignKey(d => d.SupplierId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(d => d.Positions)
                .WithOne(p => p.Delivery)
                .HasForeignKey(p => p.DeliveryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DeliveryPositionEntity>(entity =>
        {
            entity.HasKey(p => p.Id);

            entity.Property(p => p.UnitPurchasePrice)
                .HasColumnType("numeric(10,2)");

            entity.HasOne(p => p.Product)
                .WithMany()
                .HasForeignKey(p => p.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<BookingCategoryEntity>(entity =>
        {
            entity.HasKey(c => c.Id);

            entity.Property(c => c.Name)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(c => c.TaxArea)
                .HasConversion<string>()
                .HasMaxLength(50);
        });

        modelBuilder.Entity<CashBookEntity>(entity =>
        {
            entity.HasKey(c => c.Id);

            entity.Property(c => c.Name)
                .IsRequired()
                .HasMaxLength(100);

            entity.HasOne(c => c.Parent)
                .WithMany(c => c.Children)
                .HasForeignKey(c => c.ParentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<BookingEntity>(entity =>
        {
            entity.HasKey(b => b.Id);

            entity.Property(b => b.Description)
                .IsRequired()
                .HasMaxLength(255);

            entity.Property(b => b.Amount)
                .HasColumnType("numeric(10,2)");

            entity.Property(b => b.TaxArea)
                .HasConversion<string>()
                .HasMaxLength(50);

            entity.Property(b => b.Source)
                .HasConversion<string>()
                .HasMaxLength(50);

            entity.Property(b => b.ReceiptUrl)
                .HasMaxLength(2048);

            entity.HasOne(b => b.Category)
                .WithMany()
                .HasForeignKey(b => b.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(b => b.CashBook)
                .WithMany(c => c.Bookings)
                .HasForeignKey(b => b.CashBookId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        //modelBuilder.Ignore<ProductBase>();

    }

}