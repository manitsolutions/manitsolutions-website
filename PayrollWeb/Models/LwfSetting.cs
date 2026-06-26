using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PayrollWeb.Models;

public class LwfSetting
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string StateName { get; set; } = string.Empty;

    public decimal EmployeeContribution { get; set; }

    public decimal EmployerContribution { get; set; }

    [Column(TypeName = "INTEGER")]
    public bool IsActive { get; set; } = true;
}
