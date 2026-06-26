using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PayrollWeb.Models;

namespace PayrollWeb.Controllers
{
    [Authorize]
    public class AttendanceController : Controller
    {
        private readonly PayrollDbContext _db;

        public AttendanceController(PayrollDbContext db)
        {
            _db = db;
        }

        // ─── Index (Daily Attendance) ────────────────────────────────────
        public async Task<IActionResult> Index(string? date)
        {
            var selectedDate = string.IsNullOrEmpty(date)
                ? DateTime.Now.ToString("yyyy-MM-dd")
                : date;

            var employees = await _db.Employees
                .Include(e => e.Department)
                .OrderBy(e => e.EmployeeCode)
                .ToListAsync();

            var attendances = await _db.DailyAttendances
                .Where(a => a.AttendanceDate == selectedDate)
                .ToListAsync();

            var rows = employees.Select(e =>
            {
                var att = attendances.FirstOrDefault(a => a.EmployeeCode == e.EmployeeCode);
                return new AttendanceRow
                {
                    EmployeeCode = e.EmployeeCode,
                    EmployeeName = e.EmployeeName,
                    Department = e.Department?.Name ?? "",
                    Status = att?.Status ?? "Not Marked"
                };
            }).ToList();

            ViewBag.TodayDate = DateTime.Now.ToString("yyyy-MM-dd");
            ViewBag.SelectedDate = selectedDate;

            return View(rows);
        }

        // ─── Mark Attendance (single employee) ───────────────────────────
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> MarkAttendance(string employeeCode, string date, string status)
        {
            if (string.IsNullOrWhiteSpace(employeeCode) ||
                string.IsNullOrWhiteSpace(date) ||
                string.IsNullOrWhiteSpace(status))
            {
                TempData["Error"] = "Invalid attendance data.";
                return RedirectToAction(nameof(Index), new { date });
            }

            var existing = await _db.DailyAttendances
                .FirstOrDefaultAsync(a => a.EmployeeCode == employeeCode && a.AttendanceDate == date);

            var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

            if (existing != null)
            {
                existing.Status = status;
                existing.UpdatedAt = now;
            }
            else
            {
                _db.DailyAttendances.Add(new DailyAttendance
                {
                    EmployeeCode = employeeCode,
                    AttendanceDate = date,
                    Status = status,
                    UpdatedAt = now
                });
            }

            await _db.SaveChangesAsync();
            TempData["Success"] = $"Attendance marked for {employeeCode}.";
            return RedirectToAction(nameof(Index), new { date });
        }

        // ─── Mark All Present ────────────────────────────────────────────
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> MarkAllPresent(string date)
        {
            if (string.IsNullOrWhiteSpace(date))
                date = DateTime.Now.ToString("yyyy-MM-dd");

            var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            var employeeCodes = await _db.Employees.Select(e => e.EmployeeCode).ToListAsync();

            var existingAttendances = await _db.DailyAttendances
                .Where(a => a.AttendanceDate == date)
                .ToListAsync();

            foreach (var code in employeeCodes)
            {
                var existing = existingAttendances.FirstOrDefault(a => a.EmployeeCode == code);
                if (existing != null)
                {
                    existing.Status = "P";
                    existing.UpdatedAt = now;
                }
                else
                {
                    _db.DailyAttendances.Add(new DailyAttendance
                    {
                        EmployeeCode = code,
                        AttendanceDate = date,
                        Status = "P",
                        UpdatedAt = now
                    });
                }
            }

            await _db.SaveChangesAsync();
            TempData["Success"] = "All employees marked Present.";
            return RedirectToAction(nameof(Index), new { date });
        }

        // ─── Monthly Attendance (GET) ────────────────────────────────────
        public async Task<IActionResult> Monthly(int? year, int? month)
        {
            year ??= DateTime.Now.Year;
            month ??= DateTime.Now.Month;

            var employees = await _db.Employees
                .Include(e => e.Department)
                .OrderBy(e => e.EmployeeCode)
                .ToListAsync();

            var monthlyRecords = await _db.MonthlyAttendances
                .Where(m => m.Year == year && m.Month == month)
                .ToListAsync();

            List<MonthlyAttendanceRow> rows;

            if (monthlyRecords.Count > 0)
            {
                rows = employees.Select(e =>
                {
                    var rec = monthlyRecords.FirstOrDefault(m => m.EmployeeCode == e.EmployeeCode);
                    return new MonthlyAttendanceRow
                    {
                        EmployeeCode = e.EmployeeCode,
                        EmployeeName = e.EmployeeName,
                        Department = e.Department?.Name ?? "",
                        TotalDays = rec?.TotalDays ?? DateTime.DaysInMonth(year.Value, month.Value),
                        PresentDays = (int)(rec?.PresentDays ?? 0),
                        WorkingDays = rec?.TotalDays ?? 0
                    };
                }).ToList();
            }
            else
            {
                // Compute on the fly from daily attendance
                var daysInMonth = DateTime.DaysInMonth(year.Value, month.Value);
                var monthPrefix = $"{year:D4}-{month:D2}";
                var startDate = $"{monthPrefix}-01";
                var endDate = $"{monthPrefix}-{daysInMonth:D2}";

                var dailyRecords = await _db.DailyAttendances
                    .Where(a => a.AttendanceDate.CompareTo(startDate) >= 0
                             && a.AttendanceDate.CompareTo(endDate) <= 0)
                    .ToListAsync();

                rows = employees.Select(e =>
                {
                    var empDaily = dailyRecords.Where(a => a.EmployeeCode == e.EmployeeCode).ToList();
                    return new MonthlyAttendanceRow
                    {
                        EmployeeCode = e.EmployeeCode,
                        EmployeeName = e.EmployeeName,
                        Department = e.Department?.Name ?? "",
                        TotalDays = daysInMonth,
                        PresentDays = empDaily.Count(a => a.Status == "P"),
                        WorkingDays = empDaily.Count
                    };
                }).ToList();
            }

            ViewBag.Year = year;
            ViewBag.Month = month;
            return View(rows);
        }

        // ─── Compute Monthly from Daily Attendance ───────────────────────
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ComputeMonthly(int year, int month)
        {
            var daysInMonth = DateTime.DaysInMonth(year, month);
            var monthPrefix = $"{year:D4}-{month:D2}";
            var startDate = $"{monthPrefix}-01";
            var endDate = $"{monthPrefix}-{daysInMonth:D2}";

            var employees = await _db.Employees.ToListAsync();
            var dailyRecords = await _db.DailyAttendances
                .Where(a => a.AttendanceDate.CompareTo(startDate) >= 0
                         && a.AttendanceDate.CompareTo(endDate) <= 0)
                .ToListAsync();

            var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

            foreach (var emp in employees)
            {
                var empDaily = dailyRecords.Where(a => a.EmployeeCode == emp.EmployeeCode).ToList();
                var presentDays = empDaily.Count(a => a.Status == "P");

                var existing = await _db.MonthlyAttendances
                    .FirstOrDefaultAsync(m => m.EmployeeCode == emp.EmployeeCode
                                           && m.Year == year && m.Month == month);

                if (existing != null)
                {
                    existing.TotalDays = daysInMonth;
                    existing.PresentDays = presentDays;
                    existing.UpdatedAt = now;
                }
                else
                {
                    _db.MonthlyAttendances.Add(new MonthlyAttendance
                    {
                        EmployeeCode = emp.EmployeeCode,
                        Year = year,
                        Month = month,
                        TotalDays = daysInMonth,
                        PresentDays = presentDays,
                        UpdatedAt = now
                    });
                }
            }

            await _db.SaveChangesAsync();
            TempData["Success"] = "Monthly attendance computed successfully.";
            return RedirectToAction(nameof(Monthly), new { year, month });
        }
    }
}

namespace PayrollWeb.Models
{
    public class AttendanceRow
    {
        public string EmployeeCode { get; set; } = "";
        public string EmployeeName { get; set; } = "";
        public string Department { get; set; } = "";
        public string Status { get; set; } = "Not Marked";
    }

    public class MonthlyAttendanceRow
    {
        public string EmployeeCode { get; set; } = "";
        public string EmployeeName { get; set; } = "";
        public string Department { get; set; } = "";
        public int TotalDays { get; set; }
        public int PresentDays { get; set; }
        public int WorkingDays { get; set; }
    }
}
