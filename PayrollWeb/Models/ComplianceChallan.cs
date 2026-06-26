using System.ComponentModel.DataAnnotations;

namespace PayrollWeb.Models;

public class ComplianceChallan
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string ChallanType { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ReferenceNumber { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    [Required]
    [MaxLength(20)]
    public string PaymentDate { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string PeriodFrom { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string PeriodTo { get; set; } = string.Empty;

    [MaxLength(100)]
    public string BankName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string TransactionId { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Remarks { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public string CreatedAt { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public string UpdatedAt { get; set; } = string.Empty;
}
