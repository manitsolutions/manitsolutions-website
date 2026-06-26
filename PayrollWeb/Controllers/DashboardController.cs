using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PayrollWeb;

namespace PayrollWeb.Controllers;

[Authorize]
public class DashboardController : Controller
{
    private readonly PayrollDbContext _db;

    public DashboardController(PayrollDbContext db)
    {
        _db = db;
    }

    public async Task<IActionResult> Index()
    {
        var today = DateTime.Now.ToString("yyyy-MM-dd");

        ViewBag.TotalEmployees = await _db.Employees.CountAsync();
        ViewBag.PresentToday = await _db.DailyAttendances
            .CountAsync(a => a.Status == "P" && a.AttendanceDate == today);
        ViewBag.PendingPayslips = await _db.SalaryRecords
            .CountAsync(s => !s.IsPaid && !s.IsUnpaid);
        ViewBag.NetPayroll = (await _db.SalaryRecords
            .Where(s => s.IsPaid)
            .SumAsync(s => (decimal?)s.NetSalary)) ?? 0;

        ViewBag.RecentEmployees = await _db.Employees
            .OrderByDescending(e => e.Id)
            .Take(5)
            .ToListAsync();

        return View();
    }
}
