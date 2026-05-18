using System.ComponentModel;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Fachschaften_ERP.Api.Models;

public static class Permissions
{
    public static string GetDescription(this PermissionType permissionType) =>
        typeof(PermissionType)
            .GetField(permissionType.ToString())
            ?.GetCustomAttribute<DescriptionAttribute>()?.Description
        ?? permissionType.ToString();

    public static IEnumerable<string> All =>
        Enum.GetValues<PermissionType>().Select(p => p.GetDescription());
}

// Permission.cs
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PermissionType
{
    [Description("itemtypes.canread")]  ItemTypesRead,
    [Description("itemtypes.canwrite")] ItemTypesWrite,
    [Description("products.canread")]   ProductsRead,
    [Description("products.canwrite")]  ProductsWrite,
    [Description("suppliers.canread")]  SuppliersRead,
    [Description("suppliers.canwrite")] SuppliersWrite,
    [Description("users.canread")]      UsersRead,
    [Description("users.canwrite")]     UsersWrite,
    [Description("roles.canread")]      RolesRead,
    [Description("roles.canwrite")]     RolesWrite,
    [Description("permissions.canread")]  PermissionsRead,
    [Description("permissions.canwrite")] PermissionsWrite,
}

public class PermissionJsonConverter : JsonConverter<PermissionType>
{
    public override PermissionType Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetString();
        return typeof(PermissionType)
            .GetFields()
            .FirstOrDefault(f => f.GetCustomAttribute<DescriptionAttribute>()?.Description == value)
            ?.GetValue(null) is PermissionType p ? p : throw new JsonException($"Unknown permission: {value}");
    }

    public override void Write(Utf8JsonWriter writer, PermissionType value, JsonSerializerOptions options)
    {
        var description = typeof(PermissionType)
            .GetField(value.ToString())
            ?.GetCustomAttribute<DescriptionAttribute>()?.Description ?? value.ToString();
        writer.WriteStringValue(description);
    }
}