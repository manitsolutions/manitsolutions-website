using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PayrollWeb.Models;

namespace PayrollWeb.Controllers;

[Authorize]
public class SalaryController : Controller
{
    private readonly PayrollDbContext _db;

    public SalaryController(PayrollDbContext db)
    {
        _db = db;
    }

    // ─── Index ───────────────────────────────────────────────────────
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

        ViewBag.TotalSalary = records.Sum(r => r.NetSalary);
        ViewBag.TotalPaid = records.Where(r => r.IsPaid).Sum(r => r.NetSalary);
        ViewBag.TotalUnpaid = records.Where(r => !r.IsPaid && !r.IsUnpaid).Sum(r => r.NetSalary);

        return View(records);
    }

    // ─── Generate Salary ─────────────────────────────────────────────
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> GenerateSalary(int year, int month)
    {
        var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        var daysInMonth = DateTime.DaysInMonth(year, month);
        var monthPrefix = $"{year:D4}-{month:D2}";
        var startDate = $"{monthPrefix}-01";
        var endDate = $"{monthPrefix}-{daysInMonth:D2}";

        var employees = await _db.Employees
            .Include(e => e.Department)
            .Include(e => e.SubDepartment)
            .Where(e => e.Status == "Active")
            .ToListAsync();

        var dailyRecords = await _db.DailyAttendances
            .Where(a => a.AttendanceDate.CompareTo(startDate) >= 0
                     && a.AttendanceDate.CompareTo(endDate) <= 0)
            .ToListAsync();

        // Company settings for PF/ESIC percentages
        var settings = await _db.CompanySettings.FirstOrDefaultAsync();
        var pfRate = (settings?.PfPercentage ?? 12m) / 100m;
        var esicRate = (settings?.EsicPercentage ?? 0.75m) / 100m;

        foreach (var emp in employees)
        {
            var presentDays = dailyRecords.Count(a =>
                a.EmployeeCode == emp.EmployeeCode && a.Status == "P");

            var basic = emp.BasicSalary;

            // DA = 20% of Basic
            var da = basic * 0.20m;

            // Gross = Basic + DA
            var gross = basic + da;

            // PF = min(Basic * 12%, 1800)
            var pf = Math.Min(basic * pfRate, 1800m);

            // ESIC = Gross * 0.75% (only if Gross <= 21000)
            var esic = gross <= 21000m ? gross * esicRate : 0m;

            // PT = 200 (default)
            var pt = 200m;

            // Net = Gross - PF - ESIC - PT
            var net = gross - pf - esic - pt;

            var existing = await _db.SalaryRecords
                .FirstOrDefaultAsync(s =>
                    s.EmployeeCode == emp.EmployeeCode &&
                    s.Year == year &&
                    s.Month == month);

            if (existing != null)
            {
                existing.EmployeeName = emp.EmployeeName;
                existing.Department = emp.Department?.Name ?? "";
                existing.SubDepartment = emp.SubDepartment?.Name ?? "";
                existing.PresentDays = presentDays;
                existing.BasicSalary = basic;
                existing.Da = Math.Round(da, 2);
                existing.GrossSalary = Math.Round(gross, 2);
                existing.Pf = Math.Round(pf, 2);
                existing.Esic = Math.Round(esic, 2);
                existing.Pt = pt;
                existing.NetSalary = Math.Round(net, 2);
                existing.BankName = emp.BankName;
                existing.AccountNumber = emp.AccountNumber;
                existing.IfscCode = emp.IfscCode;
                existing.UpdatedAt = now;
            }
            else
            {
                _db.SalaryRecords.Add(new SalaryRecord
                {
                    EmployeeCode = emp.EmployeeCode,
                    EmployeeName = emp.EmployeeName,
                    Department = emp.Department?.Name ?? "",
                    SubDepartment = emp.SubDepartment?.Name ?? "",
                    Year = year,
                    Month = month,
                    PresentDays = presentDays,
                    BasicSalary = basic,
                    Da = Math.Round(da, 2),
                    GrossSalary = Math.Round(gross, 2),
                    Pf = Math.Round(pf, 2),
                    Esic = Math.Round(esic, 2),
                    Pt = pt,
                    Advance = 0,
                    Penalty = 0,
                    NetSalary = Math.Round(net, 2),
                    BankName = emp.BankName,
                    AccountNumber = emp.AccountNumber,
                    IfscCode = emp.IfscCode,
                    IsPaid = false,
                    IsUnpaid = false,
                    UpdatedAt = now
                });
            }
        }

        await _db.SaveChangesAsync();
        TempData["Success"] = $"Salary generated for {employees.Count} employees for {month}/{year}.";
        return RedirectToAction(nameof(Index), new { year, month });
    }

    // ─── Mark Paid ───────────────────────────────────────────────────
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> MarkPaid(int id, int year, int month)
    {
        var record = await _db.SalaryRecords.FindAsync(id);
        if (record == null) return NotFound();

        record.IsPaid = true;
        record.IsUnpaid = false;
        record.UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        await _db.SaveChangesAsync();

        TempData["Success"] = $"Salary marked as paid for {record.EmployeeName}.";
        return RedirectToAction(nameof(Index), new { year, month });
    }

    // ─── Mark Unpaid ─────────────────────────────────────────────────
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> MarkUnpaid(int id, int year, int month)
    {
        var record = await _db.SalaryRecords.FindAsync(id);
        if (record == null) return NotFound();

        record.IsPaid = false;
        record.IsUnpaid = true;
        record.UpdatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        await _db.SaveChangesAsync();

        TempData["Success"] = $"Salary marked as unpaid for {record.EmployeeName}.";
        return RedirectToAction(nameof(Index), new { year, month });
    }
}
