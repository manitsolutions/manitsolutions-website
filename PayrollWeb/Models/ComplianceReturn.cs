using System.ComponentModel.DataAnnotations;

namespace PayrollWeb.Models;

public class ComplianceReturn
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string ReturnType { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string FinancialYear { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string PeriodFrom { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string PeriodTo { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? FiledDate { get; set; }

    [Required]
    [MaxLength(20)]
    public string DueDate { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ReferenceNumber { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Status { get; set; } = "PENDING";

    [MaxLength(500)]
    public string Remarks { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public string CreatedAt { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public string UpdatedAt { get; set; } = string.Empty;
}
