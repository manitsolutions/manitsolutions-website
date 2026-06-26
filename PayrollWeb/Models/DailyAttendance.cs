using System.ComponentModel.DataAnnotations;

namespace PayrollWeb.Models;

public class DailyAttendance
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string EmployeeCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string AttendanceDate { get; set; } = string.Empty;

    [Required]
    [MaxLength(10)]
    public string Status { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public string UpdatedAt { get; set; } = string.Empty;
}
