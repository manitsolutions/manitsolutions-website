using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PayrollWeb.Models;

public class GratuitySetting
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(20)]
    public string FinancialYear { get; set; } = string.Empty;

    public decimal RatePerYear { get; set; } = 15m;

    public decimal MaxExemptAmount { get; set; } = 2000000m;

    public int MaxServiceMonths { get; set; }

    [Column(TypeName = "INTEGER")]
    public bool IsActive { get; set; } = true;

    [Required]
    [MaxLength(30)]
    public string UpdatedAt { get; set; } = string.Empty;
}
