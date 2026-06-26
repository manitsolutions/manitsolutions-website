using System.ComponentModel.DataAnnotations;

namespace PayrollWeb.Models;

public class TdsSlab
{
    [Key]
    public int Id { get; set; }

    public decimal FromAmount { get; set; }

    public decimal ToAmount { get; set; }

    public decimal TaxRate { get; set; }

    public decimal CessRate { get; set; } = 0.04m;

    [MaxLength(20)]
    public string FinancialYear { get; set; } = string.Empty;
}
