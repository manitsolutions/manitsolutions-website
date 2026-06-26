using System.ComponentModel.DataAnnotations;

namespace PayrollWeb.Models;

public class FingerprintEnrollment
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string EmployeeCode { get; set; } = string.Empty;

    [MaxLength(500)]
    public string IdentityHash { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public string EnrolledAt { get; set; } = string.Empty;
}
