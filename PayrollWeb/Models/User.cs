using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PayrollWeb.Models;

public class User
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string UserId { get; set; } = string.Empty;

    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Designation { get; set; } = string.Empty;

    [MaxLength(20)]
    public string MobileNumber { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [Column(TypeName = "INTEGER")]
    public bool IsAdmin { get; set; }

    [Required]
    [MaxLength(30)]
    public string CreatedAt { get; set; } = string.Empty;
}
