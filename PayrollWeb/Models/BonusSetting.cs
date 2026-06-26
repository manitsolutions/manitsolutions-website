using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PayrollWeb.Models;

public class BonusSetting
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(20)]
    public string FinancialYear { get; set; } = string.Empty;

    public decimal MinBonusPercent { get; set; } = 8.33m;

    public decimal MaxBonusPercent { get; set; } = 20m;

    public decimal MaxBonusWages { get; set; } = 21000m;

    public int EligibilityMonths { get; set; } = 30;

    [Column(TypeName = "INTEGER")]
    public bool IsActive { get; set; } = true;

    [Required]
    [MaxLength(30)]
    public string UpdatedAt { get; set; } = string.Empty;
}
