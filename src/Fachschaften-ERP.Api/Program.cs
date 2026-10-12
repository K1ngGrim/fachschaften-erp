using System.Reflection;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Provider;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Api.Services.Email;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities.Identity;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

builder
    .Configuration
    .AddJsonFile($"appsettings.json", true, true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", true, true)
    .AddJsonFile($"appsettings.{Environment.MachineName}.json", true, true)
    .AddEnvironmentVariables();


var connectionString = builder.Configuration.GetConnectionString("Database");

builder.Services.AddOpenApi(options =>
{
    options.AddSchemaTransformer((schema, context, ct) =>
    {
        if (context.JsonTypeInfo.Type != typeof(PermissionType))
            return Task.CompletedTask;

        schema.Type = JsonSchemaType.String;
        schema.Format = null;
        schema.Enum = Enum.GetValues<PermissionType>()
            .Select(p => JsonNode.Parse($"\"{p.GetDescription()}\""))
            .ToList()!;

        return Task.CompletedTask;
    });
    
    options.AddSchemaTransformer((schema, context, ct) =>
    {
        if (schema.Properties is null) return Task.CompletedTask;

        var type = context.JsonTypeInfo.Type;
        var nullabilityContext = new NullabilityInfoContext();

        schema.Required ??= new HashSet<string>();

        foreach (var property in type.GetProperties())
        {
            var nullability = nullabilityContext.Create(property);
            var isNullable = nullability.WriteState == NullabilityState.Nullable
                             || nullability.ReadState == NullabilityState.Nullable;

            var jsonName = property.GetCustomAttribute<JsonPropertyNameAttribute>()?.Name
                           ?? char.ToLower(property.Name[0]) + property.Name[1..];

            if (!isNullable && schema.Properties.ContainsKey(jsonName))
                schema.Required.Add(jsonName);
        }

        return Task.CompletedTask;
    });
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerUI();
builder.Services.AddControllers();

builder.Services.AddDbContext<CoreContext>(options =>
{
    // Historientabelle fest in "public": Unqualifiziert hinge sie vom search_path ("$user", public) ab
    // und landete bei einem DB-Benutzer namens "erp" im App-Schema, dann würden Migrationen erneut laufen.
    options.UseNpgsql(connectionString, b => b
        .MigrationsAssembly("Fachschaften-ERP.Api")
        .MigrationsHistoryTable("__EFMigrationsHistory", "public"));
});

builder.Services
    .AddIdentityCore<IdentityUserEntity>()
    .AddRoles<IdentityRoleEntity>()
    .AddEntityFrameworkStores<CoreContext>()
    .AddSignInManager<SignInManager<IdentityUserEntity>>()
    .AddRoleManager<RoleManager<IdentityRoleEntity>>()
    .AddDefaultTokenProviders()
    .AddTokenProvider<InviteTokenProvider<IdentityUserEntity>>("InviteTokenProvider")
    .AddClaimsPrincipalFactory<RoleClaimsUserClaimsPrincipalFactory>();

builder.Services.AddAuthentication(options =>
    {
        options.DefaultScheme = IdentityConstants.ApplicationScheme;
        options.DefaultChallengeScheme = IdentityConstants.ApplicationScheme;
        options.DefaultAuthenticateScheme = IdentityConstants.ApplicationScheme;
        options.DefaultSignInScheme = IdentityConstants.ApplicationScheme;
    })
    .AddCookie(IdentityConstants.ApplicationScheme)
    .AddCookie(IdentityConstants.TwoFactorUserIdScheme)
    .AddCookie(IdentityConstants.TwoFactorRememberMeScheme)
    .AddCookie("Identity.External")
    .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme,
        x => { x.Cookie.Name = "Identity.Application"; });

builder.Services.Configure<IdentityOptions>(options =>
{
    // Passwortregeln. Überschreibbar über "Identity:Password"; das Frontend holt sie über
    // GET /api/auth/password-policy, damit es nur eine Quelle gibt.
    options.Password.RequiredLength = 10;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireDigit = true;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredUniqueChars = 4;
    builder.Configuration.GetSection("Identity:Password").Bind(options.Password);

    // Lockout settings.
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;

    // User settings.
    options.User.AllowedUserNameCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._@+";
    options.User.RequireUniqueEmail = false;
});

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.ExpireTimeSpan = TimeSpan.FromDays(14);
    options.SlidingExpiration = true;

    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = 401;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = 403;
        return Task.CompletedTask;
    };

    // Prüft regelmäßig den Security-Stamp und baut die Claims neu auf. Dadurch greifen
    // geänderte Rollen/Rechte und gelöschte Benutzer ohne erneuten Login.
    options.Events.OnValidatePrincipal = SecurityStampValidator.ValidatePrincipalAsync;
});

builder.Services.Configure<SecurityStampValidatorOptions>(options =>
    options.ValidationInterval = TimeSpan.FromMinutes(1));

builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new PermissionJsonConverter()));
builder.Services.Configure<JsonOptions>(options =>
    options.JsonSerializerOptions.Converters.Add(new PermissionJsonConverter()));

builder.Services.AddSingleton<IAuthorizationHandler, PermissionHandler>();
builder.Services.AddEmailSender(builder.Configuration);
builder.Services.AddAppRateLimiting();

// Links zum Zurücksetzen des Passworts (Standard-Token-Provider) sind 2 Stunden gültig.
builder.Services.Configure<DataProtectionTokenProviderOptions>(options =>
    options.TokenLifespan = TimeSpan.FromHours(2));

// Schlüssel für Login-Cookies und Einladungs-Token. Im Container auf ein Volume legen,
// sonst sind nach jedem Neustart alle Sitzungen und offenen Einladungen ungültig.
var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"];
if (!string.IsNullOrEmpty(dataProtectionKeysPath))
{
    builder.Services.AddDataProtection()
        .SetApplicationName("Fachschaften-ERP")
        .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath));
}


builder.Services.AddHttpContextAccessor();

// Alles ohne explizites [AllowAnonymous] erfordert einen angemeldeten Benutzer.
builder.Services.AddAuthorization(options =>
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build());

var app = builder.Build();

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

using var scope = app.Services.CreateScope();
var dbContext = scope.ServiceProvider.GetRequiredService<CoreContext>();
dbContext.Database.Migrate();

await DatabaseSeeder.SeedAsync(scope.ServiceProvider);
await DemoDataSeeder.SeedAsync(scope.ServiceProvider, app.Environment);

var openApi = app.MapOpenApi();
var swaggerUi = app.MapSwaggerUI();
if (app.Environment.IsDevelopment())
{
    // generate-api.sh lädt die Definition ohne Login.
    openApi.AllowAnonymous();
    swaggerUi.AllowAnonymous();
}
app.MapControllers();

app.Run();