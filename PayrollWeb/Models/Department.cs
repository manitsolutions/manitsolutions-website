using System.ComponentModel.DataAnnotations;

namespace PayrollWeb.Models;

public class Department
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public ICollection<SubDepartment> SubDepartments { get; set; } = new List<SubDepartment>();
    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
