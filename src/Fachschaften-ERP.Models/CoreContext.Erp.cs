using System.Text.Json;
using Fachschaften_ERP.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

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
    public DbSet<WikiPageEntity> WikiPages => Set<WikiPageEntity>();
    public DbSet<StockTakeEntity> StockTakes => Set<StockTakeEntity>();
    public DbSet<StockTakePositionEntity> StockTakePositions => Set<StockTakePositionEntity>();
    public DbSet<OrganizationSettingsEntity> OrganizationSettings => Set<OrganizationSettingsEntity>();
    public DbSet<CustomTableEntity> CustomTables => Set<CustomTableEntity>();
    public DbSet<CustomTableRowEntity> CustomTableRows => Set<CustomTableRowEntity>();
    public DbSet<CustomTableKeyEntity> CustomTableKeys => Set<CustomTableKeyEntity>();
    public DbSet<VaultEntity> Vaults => Set<VaultEntity>();
    public DbSet<BackupSettingsEntity> BackupSettings => Set<BackupSettingsEntity>();
    public DbSet<BackupRunEntity> BackupRuns => Set<BackupRunEntity>();
    public DbSet<ModuleStateEntity> ModuleStates => Set<ModuleStateEntity>();
    public DbSet<DocumentTemplateEntity> DocumentTemplates => Set<DocumentTemplateEntity>();
    public DbSet<DocumentTemplateVersionEntity> DocumentTemplateVersions => Set<DocumentTemplateVersionEntity>();
    public DbSet<DocumentAssetEntity> DocumentAssets => Set<DocumentAssetEntity>();
    public DbSet<GeneratedDocumentEntity> GeneratedDocuments => Set<GeneratedDocumentEntity>();
    public DbSet<DocumentPublicFileEntity> DocumentPublicFiles => Set<DocumentPublicFileEntity>();
    public DbSet<DocumentVariableEntity> DocumentVariables => Set<DocumentVariableEntity>();
    
    private static void OnErpCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CustomTableEntity>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Name).IsRequired().HasMaxLength(100);
            entity.Property(t => t.Description).HasMaxLength(500);
            entity.Property(t => t.Columns)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<CustomTableColumn>>(v, (JsonSerializerOptions?)null) ?? new(),
                    new ValueComparer<List<CustomTableColumn>>(
                        (a, b) => JsonSerializer.Serialize(a, (JsonSerializerOptions?)null) ==
                                  JsonSerializer.Serialize(b, (JsonSerializerOptions?)null),
                        v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null).GetHashCode(),
                        v => JsonSerializer.Deserialize<List<CustomTableColumn>>(
                            JsonSerializer.Serialize(v, (JsonSerializerOptions?)null), (JsonSerializerOptions?)null)!));
            entity.HasMany(t => t.Rows)
                .WithOne(r => r.Table)
                .HasForeignKey(r => r.TableId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CustomTableRowEntity>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.HasIndex(r => r.TableId);
            entity.Property(r => r.Values)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => v.RootElement.GetRawText(),
                    v => JsonDocument.Parse(v, default),
                    new ValueComparer<JsonDocument>(
                        (a, b) => a!.RootElement.GetRawText() == b!.RootElement.GetRawText(),
                        v => v.RootElement.GetRawText().GetHashCode(),
                        v => JsonDocument.Parse(v.RootElement.GetRawText(), default)));
        });

        modelBuilder.Entity<ModuleStateEntity>(entity =>
        {
            entity.HasKey(m => m.Key);
            entity.Property(m => m.Key).HasMaxLength(50);
        });

        modelBuilder.Entity<DocumentTemplateEntity>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Name).IsRequired().HasMaxLength(100);
            entity.Property(t => t.Description).HasMaxLength(500);
            entity.HasMany(t => t.Versions)
                .WithOne(v => v.Template)
                .HasForeignKey(v => v.TemplateId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DocumentTemplateVersionEntity>(entity =>
        {
            entity.HasKey(v => v.Id);
            entity.HasIndex(v => new { v.TemplateId, v.Version }).IsUnique();
            entity.Property(v => v.Comment).HasMaxLength(500);
            entity.Property(v => v.Fields)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<CustomTableColumn>>(v, (JsonSerializerOptions?)null) ?? new(),
                    new ValueComparer<List<CustomTableColumn>>(
                        (a, b) => JsonSerializer.Serialize(a, (JsonSerializerOptions?)null) ==
                                  JsonSerializer.Serialize(b, (JsonSerializerOptions?)null),
                        v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null).GetHashCode(),
                        v => JsonSerializer.Deserialize<List<CustomTableColumn>>(
                            JsonSerializer.Serialize(v, (JsonSerializerOptions?)null), (JsonSerializerOptions?)null)!));
            entity.Property(v => v.AssetIds)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<Guid>>(v, (JsonSerializerOptions?)null) ?? new(),
                    new ValueComparer<List<Guid>>(
                        (a, b) => a!.SequenceEqual(b!),
                        v => v.Aggregate(0, (h, id) => HashCode.Combine(h, id)),
                        v => v.ToList()));
        });

        modelBuilder.Entity<DocumentAssetEntity>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.HasIndex(a => a.TemplateId);
            entity.Property(a => a.FileName).IsRequired().HasMaxLength(200);
            entity.Property(a => a.ContentType).IsRequired().HasMaxLength(100);
        });

        modelBuilder.Entity<DocumentPublicFileEntity>(entity =>
        {
            entity.HasKey(f => f.Id);
            entity.HasIndex(f => f.Path).IsUnique();
            entity.Property(f => f.Path).IsRequired().HasMaxLength(300);
            entity.Property(f => f.ContentType).IsRequired().HasMaxLength(100);
        });

        modelBuilder.Entity<DocumentVariableEntity>(entity =>
        {
            entity.HasKey(v => v.Key);
            entity.Property(v => v.Key).HasMaxLength(40);
            entity.Property(v => v.Value).IsRequired().HasMaxLength(5000);
            entity.Property(v => v.Description).HasMaxLength(300);
        });

        modelBuilder.Entity<GeneratedDocumentEntity>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.HasIndex(d => d.TemplateId);
            entity.Property(d => d.Title).IsRequired().HasMaxLength(200);
            entity.Property(d => d.Values)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => v.RootElement.GetRawText(),
                    v => JsonDocument.Parse(v, default),
                    new ValueComparer<JsonDocument>(
                        (a, b) => a!.RootElement.GetRawText() == b!.RootElement.GetRawText(),
                        v => v.RootElement.GetRawText().GetHashCode(),
                        v => JsonDocument.Parse(v.RootElement.GetRawText(), default)));
        });

        modelBuilder.Entity<BackupSettingsEntity>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.Id).ValueGeneratedNever();
            entity.Property(s => s.WebDavUrl).HasMaxLength(1000);
            entity.Property(s => s.Username).HasMaxLength(200);
            entity.Property(s => s.ProtectedPassword).HasMaxLength(2000);
            entity.Property(s => s.ProtectedArchivePassword).HasMaxLength(2000);
            entity.Property(s => s.NotifyEmail).HasMaxLength(320);
        });

        modelBuilder.Entity<BackupRunEntity>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.HasIndex(r => r.Started);
            entity.Property(r => r.FileName).HasMaxLength(200);
            entity.Property(r => r.Message).HasMaxLength(4000);
        });

        modelBuilder.Entity<VaultEntity>(entity =>
        {
            entity.HasKey(v => v.Id);
            entity.HasIndex(v => v.UserId).IsUnique();
            entity.Property(v => v.PublicKey).IsRequired().HasMaxLength(1000);
            entity.Property(v => v.EncryptedPrivateKey).IsRequired().HasMaxLength(4000);
            entity.Property(v => v.Salt).IsRequired().HasMaxLength(100);
        });

        modelBuilder.Entity<CustomTableKeyEntity>(entity =>
        {
            entity.HasKey(k => new { k.TableId, k.VaultId });
            entity.Property(k => k.WrappedKey).IsRequired().HasMaxLength(1000);
            entity.HasOne(k => k.Table)
                .WithMany(t => t.Keys)
                .HasForeignKey(k => k.TableId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(k => k.Vault)
                .WithMany()
                .HasForeignKey(k => k.VaultId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrganizationSettingsEntity>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.Id).ValueGeneratedNever();
            entity.Property(s => s.Name).IsRequired().HasMaxLength(100);
            entity.Property(s => s.Subtitle).HasMaxLength(100);
            entity.Property(s => s.AccentColor).IsRequired().HasMaxLength(7);
            entity.Property(s => s.PrivacyContact).HasMaxLength(2000);
            entity.Property(s => s.ImprintUrl).HasMaxLength(500);
        });

        modelBuilder.Entity<StockTakeEntity>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.Note).HasMaxLength(500);
            entity.HasMany(s => s.Positions)
                .WithOne(p => p.StockTake)
                .HasForeignKey(p => p.StockTakeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StockTakePositionEntity>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasOne(p => p.Product).WithMany().HasForeignKey(p => p.ProductId);
            entity.Property(p => p.UnitPurchasePrice).HasColumnType("numeric(10,2)");
        });

        modelBuilder.Entity<WikiPageEntity>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Title).IsRequired().HasMaxLength(200);
            entity.Property(p => p.Category).HasMaxLength(100);
            entity.Property(p => p.Content).IsRequired();
        });

        modelBuilder.Entity<ProductEntity>(entity =>
        {
            entity.HasKey(p => p.Id);

            entity.Property(p => p.Name)
                .IsRequired()
                .HasMaxLength(255);

            entity.Property(p => p.PurchasePrice)
                .HasColumnType("numeric(10,2)");

            entity.Property(p => p.Unit)
                .HasMaxLength(ProductBase.MaxUnitLength);

            entity.Property(p => p.PriceUnit)
                .HasMaxLength(ProductBase.MaxUnitLength);

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