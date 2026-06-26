using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PayrollWeb.Models;

public class SalaryRecord
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string EmployeeCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string EmployeeName { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Department { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string SubDepartment { get; set; } = string.Empty;

    public int Year { get; set; }

    public int Month { get; set; }

    public decimal PresentDays { get; set; }

    public decimal BasicSalary { get; set; }

    public decimal Da { get; set; }

    public decimal GrossSalary { get; set; }

    public decimal Pf { get; set; }

    public decimal Esic { get; set; }

    public decimal Pt { get; set; }

    public decimal Advance { get; set; }

    public decimal Penalty { get; set; }

    public decimal NetSalary { get; set; }

    [MaxLength(100)]
    public string BankName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string AccountNumber { get; set; } = string.Empty;

    [MaxLength(20)]
    public string IfscCode { get; set; } = string.Empty;

    [Column(TypeName = "INTEGER")]
    public bool IsPaid { get; set; }

    [Column(TypeName = "INTEGER")]
    public bool IsUnpaid { get; set; }

    [Required]
    [MaxLength(30)]
    public string UpdatedAt { get; set; } = string.Empty;
}
