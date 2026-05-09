using System.Reflection;

namespace Fachschaften_ERP.Api.Models;

public static class Permissions
{
    // Item Types
    public const string ItemTypesRead  = "itemtypes.canread";
    public const string ItemTypesWrite = "itemtypes.canwrite";

    // Products
    public const string ProductsRead  = "products.canread";
    public const string ProductsWrite = "products.canwrite";

    // Suppliers
    public const string SuppliersRead  = "suppliers.canread";
    public const string SuppliersWrite = "suppliers.canwrite";

    // Users
    public const string UsersRead  = "users.canread";
    public const string UsersWrite = "users.canwrite";

    // Roles
    public const string RolesRead  = "roles.canread";
    public const string RolesWrite = "roles.canwrite";

    // Permissions
    public const string PermissionsRead  = "permissions.canread";
    public const string PermissionsWrite = "permissions.canwrite";

    public static IEnumerable<string> All => typeof(Permissions)
        .GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy)
        .Where(f => f is { IsLiteral: true, IsInitOnly: false })
        .Select(f => (string)f.GetRawConstantValue()!);
}