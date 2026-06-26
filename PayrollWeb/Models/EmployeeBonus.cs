using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PayrollWeb.Models;

public class EmployeeBonus
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string EmployeeCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string FinancialYear { get; set; } = string.Empty;

    public decimal EligibleWages { get; set; }

    public decimal BonusAmount { get; set; }

    public decimal PaidAmount { get; set; }

    [MaxLength(20)]
    public string? PaidDate { get; set; }

    [Column(TypeName = "INTEGER")]
    public bool IsPaid { get; set; }

    [Required]
    [MaxLength(30)]
    public string UpdatedAt { get; set; } = string.Empty;
}
