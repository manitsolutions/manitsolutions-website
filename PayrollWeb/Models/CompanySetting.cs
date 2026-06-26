using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PayrollWeb.Models;

public class CompanySetting
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string CompanyName { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Address { get; set; } = string.Empty;

    [MaxLength(50)]
    public string GstNo { get; set; } = string.Empty;

    [MaxLength(100)]
    public string FounderName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string CeoName { get; set; } = string.Empty;

    [MaxLength(20)]
    public string ContactNo { get; set; } = string.Empty;

    [MaxLength(200)]
    public string EmailId { get; set; } = string.Empty;

    [MaxLength(100)]
    public string SignatureTheme { get; set; } = string.Empty;

    [MaxLength(20)]
    public string SignatureType { get; set; } = "text";

    [MaxLength(500)]
    public string SignatureImagePath { get; set; } = string.Empty;

    public decimal PfPercentage { get; set; } = 12.0m;

    public decimal EsicPercentage { get; set; } = 0.75m;

    [MaxLength(500)]
    public string LogoPath { get; set; } = string.Empty;

    public int ThemeIndex { get; set; }

    [MaxLength(20)]
    public string PtType { get; set; } = "Amount";

    public decimal PtPercentValue { get; set; }
}
