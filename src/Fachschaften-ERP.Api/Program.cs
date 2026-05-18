using System.Text.Json.Nodes;
using Fachschaften_ERP.Api.Models;
using Fachschaften_ERP.Api.Services;
using Fachschaften_ERP.Api.Services.Interfaces;
using Fachschaften_ERP.Models;
using Fachschaften_ERP.Models.Entities.Identity;
using Fachschaften_ERP.Models.Provider;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

builder
    .Configuration
    .AddJsonFile($"appsettings.json", true, true)
    .AddJsonFile($"appsettings.Development.json", true, true)
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
            .ToList();

        return Task.CompletedTask;
    });
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerUI();
builder.Services.AddControllers();

builder.Services.AddDbContext<CoreContext>(options =>
{
    options.UseNpgsql(connectionString, b => b.MigrationsAssembly("Fachschaften-ERP.Api"));
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
    // Password settings.
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequiredLength = 3;
    options.Password.RequiredUniqueChars = 0;

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
});

builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new PermissionJsonConverter()));
builder.Services.Configure<JsonOptions>(options =>
    options.JsonSerializerOptions.Converters.Add(new PermissionJsonConverter()));

builder.Services.AddSingleton<IAuthorizationHandler, PermissionHandler>();
builder.Services.AddScoped<IEmailSender, DevEmailSender>();


builder.Services.AddHttpContextAccessor();

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

using var scope = app.Services.CreateScope();
var dbContext = scope.ServiceProvider.GetRequiredService<CoreContext>();
dbContext.Database.Migrate();

await DatabaseSeeder.SeedAsync(scope.ServiceProvider);

app.MapOpenApi();
app.MapSwaggerUI();
app.MapControllers();

app.Run();