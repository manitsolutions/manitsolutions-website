using System.ComponentModel.DataAnnotations;

namespace PayrollWeb.Models;

public class PtSlab
{
    [Key]
    public int Id { get; set; }

    public decimal FromAmount { get; set; }

    public decimal ToAmount { get; set; }

    public decimal PtAmount { get; set; }
}
