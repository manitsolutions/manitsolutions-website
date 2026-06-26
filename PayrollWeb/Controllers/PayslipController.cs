using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PayrollWeb.Models;

namespace PayrollWeb.Controllers;

[Authorize]
public class PayslipController : Controller
{
    private readonly PayrollDbContext _db;

    public PayslipController(PayrollDbContext db)
    {
        _db = db;
    }

    // ─── Index ─────────────────────────────────────────────────────────
    public async Task<IActionResult> Index(int? year, int? month)
    {
        year ??= DateTime.Now.Year;
        month ??= DateTime.Now.Month;

        var records = await _db.SalaryRecords
            .Where(s => s.Year == year && s.Month == month)
            .OrderBy(s => s.EmployeeCode)
            .ToListAsync();

        ViewBag.Year = year;
        ViewBag.Month = month;

        return View(records);
    }

    // ─── View Payslip ──────────────────────────────────────────────────
    public async Task<IActionResult> ViewPayslip(int id)
    {
        var record = await _db.SalaryRecords
            .FirstOrDefaultAsync(s => s.Id == id);

        if (record == null) return NotFound();

        // Load company details for the payslip header
        var company = await _db.CompanySettings.FirstOrDefaultAsync();
        ViewBag.CompanyName = company?.CompanyName ?? "MANIT SOLUTIONS";
        ViewBag.CompanyAddress = company?.Address ?? "";

        return View(record);
    }
}
