namespace Fachschaften_ERP.Models.Entities;

/// <summary>
/// Schlüsselpaar für vertrauliche Tabellen. Der private Schlüssel liegt nur verschlüsselt vor;
/// entschlüsselt wird er ausschließlich im Browser mit der Tresor-Passphrase bzw. dem
/// Wiederherstellungsschlüssel. Der Server kann vertrauliche Daten deshalb nicht lesen.
/// </summary>
public class VaultEntity
{
    public Guid Id { get; set; }

    /// <summary>Besitzer; leer beim Wiederherstellungs-Tresor der Fachschaft.</summary>
    public Guid? UserId { get; set; }

    public bool IsRecovery { get; set; }

    /// <summary>Öffentlicher RSA-OAEP-Schlüssel (SPKI, Base64).</summary>
    public string PublicKey { get; set; } = string.Empty;

    /// <summary>Privater Schlüssel (PKCS#8), AES-GCM-verschlüsselt: Base64 aus IV und Chiffretext.</summary>
    public string EncryptedPrivateKey { get; set; } = string.Empty;

    /// <summary>Salt für PBKDF2 (Base64).</summary>
    public string Salt { get; set; } = string.Empty;

    public int Iterations { get; set; }

    public DateTimeOffset Created { get; set; }
    public DateTimeOffset? Modified { get; set; }
}

/// <summary>Schlüssel einer vertraulichen Tabelle, verschlüsselt für einen Tresor.</summary>
public class CustomTableKeyEntity
{
    public Guid TableId { get; set; }
    public CustomTableEntity? Table { get; set; }

    public Guid VaultId { get; set; }
    public VaultEntity? Vault { get; set; }

    /// <summary>AES-Schlüssel der Tabelle, mit dem öffentlichen Schlüssel des Tresors verschlüsselt (Base64).</summary>
    public string WrappedKey { get; set; } = string.Empty;

    public Guid GrantedById { get; set; }
    public DateTimeOffset Granted { get; set; }
}
