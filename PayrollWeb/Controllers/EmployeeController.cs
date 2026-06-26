using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PayrollWeb.Models;

namespace PayrollWeb.Controllers;

[Authorize]
public class EmployeeController : Controller
{
    private readonly PayrollDbContext _db;

    public EmployeeController(PayrollDbContext db)
    {
        _db = db;
    }

    // ─── Index ──────────────────────────────────────────────────────
    public async Task<IActionResult> Index(string? searchName, int? searchDepartment)
    {
        var query = _db.Employees
            .Include(e => e.Department)
            .Include(e => e.SubDepartment)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchName))
            query = query.Where(e => e.EmployeeName.Contains(searchName)
                                  || e.EmployeeCode.Contains(searchName));

        if (searchDepartment.HasValue && searchDepartment.Value > 0)
            query = query.Where(e => e.DepartmentId == searchDepartment.Value);

        ViewBag.SearchName = searchName;
        ViewBag.SearchDepartment = searchDepartment;
        ViewBag.Departments = await _db.Departments.OrderBy(d => d.Name).ToListAsync();

        var employees = await query.OrderBy(e => e.EmployeeCode).ToListAsync();
        return View(employees);
    }

    // ─── Create (GET) ───────────────────────────────────────────────
    public async Task<IActionResult> Create()
    {
        ViewBag.Departments = await _db.Departments.OrderBy(d => d.Name).ToListAsync();
        ViewBag.SubDepartmentsJson = System.Text.Json.JsonSerializer.Serialize(
            await _db.SubDepartments.Select(sd => new { sd.Id, sd.DepartmentId, sd.Name }).ToListAsync()
        );
        return View();
    }

    // ─── Create (POST) ──────────────────────────────────────────────
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(Employee employee)
    {
        if (!ModelState.IsValid)
        {
            ViewBag.Departments = await _db.Departments.OrderBy(d => d.Name).ToListAsync();
            ViewBag.SubDepartmentsJson = System.Text.Json.JsonSerializer.Serialize(
                await _db.SubDepartments.Select(sd => new { sd.Id, sd.DepartmentId, sd.Name }).ToListAsync()
            );
            return View(employee);
        }

        // Set defaults for required fields not on the form
        var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
        employee.NameAsPerAadhar = employee.EmployeeName;
        employee.MaritalStatus = "Unmarried";
        employee.Religion = "Hindu";
        employee.UanNumber = employee.EmployeeCode;
        employee.PfNumber = employee.EmployeeCode;
        employee.EsicNumber = employee.EmployeeCode;
        employee.CurrentAddress = "";
        employee.PermanentAddress = "";
        employee.SpouseName = null;
        employee.FatherName = "";
        employee.MotherName = "";
        employee.EmergencyContact = employee.MobileNumber;
        employee.NomineeName = "";
        employee.NomineeRelation = "";
        employee.NomineeContact = "";
        employee.Qualification = "";
        employee.University = "";
        employee.PassingYear = "";
        employee.AnnualCtc = "";
        employee.DaWa = "";
        employee.Hra = "";
        employee.PhotoPath = null;
        employee.CreatedAt = now;

        _db.Employees.Add(employee);
        await _db.SaveChangesAsync();

        TempData["Success"] = "Employee created successfully.";
        return RedirectToAction(nameof(Index));
    }

    // ─── Edit (GET) ─────────────────────────────────────────────────
    public async Task<IActionResult> Edit(int id)
    {
        var employee = await _db.Employees.FindAsync(id);
        if (employee == null) return NotFound();

        ViewBag.Departments = await _db.Departments.OrderBy(d => d.Name).ToListAsync();
        ViewBag.SubDepartmentsJson = System.Text.Json.JsonSerializer.Serialize(
            await _db.SubDepartments.Select(sd => new { sd.Id, sd.DepartmentId, sd.Name }).ToListAsync()
        );
        return View(employee);
    }

    // ─── Edit (POST) ────────────────────────────────────────────────
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, Employee employee)
    {
        if (id != employee.Id) return BadRequest();

        if (!ModelState.IsValid)
        {
            ViewBag.Departments = await _db.Departments.OrderBy(d => d.Name).ToListAsync();
            ViewBag.SubDepartmentsJson = System.Text.Json.JsonSerializer.Serialize(
                await _db.SubDepartments.Select(sd => new { sd.Id, sd.DepartmentId, sd.Name }).ToListAsync()
            );
            return View(employee);
        }

        try
        {
            var existing = await _db.Employees.FindAsync(id);
            if (existing == null) return NotFound();

            // Update only the fields from the form
            existing.EmployeeCode = employee.EmployeeCode;
            existing.EmployeeName = employee.EmployeeName;
            existing.FirstName = employee.FirstName;
            existing.LastName = employee.LastName;
            existing.Gender = employee.Gender;
            existing.AadharNumber = employee.AadharNumber;
            existing.PanNumber = employee.PanNumber;
            existing.MobileNumber = employee.MobileNumber;
            existing.EmailId = employee.EmailId;
            existing.DepartmentId = employee.DepartmentId;
            existing.SubDepartmentId = employee.SubDepartmentId;
            existing.Designation = employee.Designation;
            existing.Status = employee.Status;
            existing.BasicSalary = employee.BasicSalary;
            existing.BankName = employee.BankName;
            existing.AccountNumber = employee.AccountNumber;
            existing.IfscCode = employee.IfscCode;
            existing.JoiningDate = employee.JoiningDate;

            await _db.SaveChangesAsync();
            TempData["Success"] = "Employee updated successfully.";
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!await _db.Employees.AnyAsync(e => e.Id == id))
                return NotFound();
            throw;
        }

        return RedirectToAction(nameof(Index));
    }

    // ─── Delete (POST) ──────────────────────────────────────────────
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var employee = await _db.Employees.FindAsync(id);
        if (employee == null) return NotFound();

        _db.Employees.Remove(employee);
        await _db.SaveChangesAsync();

        TempData["Success"] = "Employee deleted successfully.";
        return RedirectToAction(nameof(Index));
    }
}
