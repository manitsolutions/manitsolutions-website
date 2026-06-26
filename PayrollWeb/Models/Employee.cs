using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PayrollWeb.Models;

public class Employee
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
    [MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? MiddleName { get; set; }

    [Required]
    [MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string NameAsPerAadhar { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string Gender { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string MaritalStatus { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Religion { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string AadharNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string PanNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(15)]
    public string MobileNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string EmailId { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string UanNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string PfNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string EsicNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    public string CurrentAddress { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    public string PermanentAddress { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string BankName { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string AccountNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string IfscCode { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? SpouseName { get; set; }

    [Required]
    [MaxLength(100)]
    public string FatherName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string MotherName { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string EmergencyContact { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string NomineeName { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string NomineeRelation { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string NomineeContact { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Qualification { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string University { get; set; } = string.Empty;

    [Required]
    [MaxLength(10)]
    public string PassingYear { get; set; } = string.Empty;

    public int DepartmentId { get; set; }

    public int SubDepartmentId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Designation { get; set; } = string.Empty;

    [MaxLength(50)]
    public string AnnualCtc { get; set; } = string.Empty;

    [Required]
    public decimal BasicSalary { get; set; }

    [Required]
    [MaxLength(50)]
    public string DaWa { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Hra { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string JoiningDate { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? PhotoPath { get; set; }

    [Required]
    [MaxLength(30)]
    public string CreatedAt { get; set; } = string.Empty;

    [ForeignKey(nameof(DepartmentId))]
    public Department Department { get; set; } = null!;

    [ForeignKey(nameof(SubDepartmentId))]
    public SubDepartment SubDepartment { get; set; } = null!;
}
