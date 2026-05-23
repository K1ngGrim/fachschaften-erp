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

            entity.Property(p => p.SellingPrice)
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
        
        modelBuilder.Ignore<ProductBase>();

    }

}