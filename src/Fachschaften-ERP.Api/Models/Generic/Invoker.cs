using System.Security.Claims;

namespace Fachschaften_ERP.Api.Models.Generic;

public readonly struct Invoker(Guid userId)
{
    public Guid UserId { get; } = userId;
    public static implicit operator Invoker(ClaimsPrincipal d) => new(Guid.Parse(d.Claims.First(c => c.Type == ClaimTypes.NameIdentifier).Value));
    public static implicit operator Invoker?(ClaimsPrincipal d) => d.Identity?.IsAuthenticated == true ? new(Guid.Parse(d.Claims.First(c => c.Type == ClaimTypes.NameIdentifier).Value)) : (Invoker?) null;
}