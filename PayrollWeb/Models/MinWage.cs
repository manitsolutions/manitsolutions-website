using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PayrollWeb.Models;

public class MinWage
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string StateName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Category { get; set; } = "UNSKILLED";

    public decimal WagesPerDay { get; set; }

    public decimal WagesPerMonth { get; set; }

    [Required]
    [MaxLength(20)]
    public string EffectiveFrom { get; set; } = string.Empty;

    [Column(TypeName = "INTEGER")]
    public bool IsActive { get; set; } = true;
}
