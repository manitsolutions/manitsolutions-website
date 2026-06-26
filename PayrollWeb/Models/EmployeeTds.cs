using System.ComponentModel.DataAnnotations;

namespace PayrollWeb.Models;

public class EmployeeTds
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string EmployeeCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string FinancialYear { get; set; } = string.Empty;

    public decimal TotalIncome { get; set; }

    public decimal TotalTax { get; set; }

    public decimal TaxPaid { get; set; }

    public decimal CessAmount { get; set; }

    [Required]
    [MaxLength(30)]
    public string UpdatedAt { get; set; } = string.Empty;
}
