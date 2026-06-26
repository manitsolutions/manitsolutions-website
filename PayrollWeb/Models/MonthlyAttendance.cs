using System.ComponentModel.DataAnnotations;

namespace PayrollWeb.Models;

public class MonthlyAttendance
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string EmployeeCode { get; set; } = string.Empty;

    public int Year { get; set; }

    public int Month { get; set; }

    public int TotalDays { get; set; }

    public decimal PresentDays { get; set; }

    [Required]
    [MaxLength(30)]
    public string UpdatedAt { get; set; } = string.Empty;
}
