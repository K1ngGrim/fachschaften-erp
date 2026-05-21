using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Fachschaften_ERP.Api.Provider;

public class InviteTokenProvider<TUser>(
    IDataProtectionProvider dataProtectionProvider,
    IOptions<InviteTokenProviderOptions> options,
    ILogger<DataProtectorTokenProvider<TUser>> logger)
    : DataProtectorTokenProvider<TUser>(dataProtectionProvider, options, logger)
    where TUser : class;

public class InviteTokenProviderOptions : DataProtectionTokenProviderOptions
{
    public InviteTokenProviderOptions()
    {
        Name = "InviteTokenProvider";
        TokenLifespan = TimeSpan.FromDays(7);
    }
}