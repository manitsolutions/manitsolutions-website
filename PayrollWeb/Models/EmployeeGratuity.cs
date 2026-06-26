using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PayrollWeb.Models;

public class EmployeeGratuity
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string EmployeeCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string FinancialYear { get; set; } = string.Empty;

    public int ServiceYears { get; set; }

    public int ServiceMonths { get; set; }

    public decimal LastBasic { get; set; }

    public decimal GratuityAmount { get; set; }

    [Column(TypeName = "INTEGER")]
    public bool IsApproved { get; set; }

    [Required]
    [MaxLength(30)]
    public string UpdatedAt { get; set; } = string.Empty;
}
