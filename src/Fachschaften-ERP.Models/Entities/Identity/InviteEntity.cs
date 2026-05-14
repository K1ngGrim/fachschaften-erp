namespace Fachschaften_ERP.Models.Entities.Identity;

public class InviteEntity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public bool Require2Fa { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public bool Accepted { get; set; }
}