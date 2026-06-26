using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PayrollWeb.Models;

namespace PayrollWeb.Controllers;

[Authorize]
public class DepartmentController : Controller
{
    private readonly PayrollDbContext _db;

    public DepartmentController(PayrollDbContext db)
    {
        _db = db;
    }

    // ─── Index ──────────────────────────────────────────────────────
    public async Task<IActionResult> Index()
    {
        var departments = await _db.Departments
            .Include(d => d.SubDepartments)
            .OrderBy(d => d.Name)
            .ToListAsync();
        return View(departments);
    }

    // ─── Create (GET) ───────────────────────────────────────────────
    public IActionResult Create()
    {
        return View();
    }

    // ─── Create (POST) ──────────────────────────────────────────────
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(Department department)
    {
        if (!ModelState.IsValid) return View(department);

        if (await _db.Departments.AnyAsync(d => d.Name == department.Name))
        {
            ModelState.AddModelError("Name", "A department with this name already exists.");
            return View(department);
        }

        _db.Departments.Add(department);
        await _db.SaveChangesAsync();

        TempData["Success"] = "Department created successfully.";
        return RedirectToAction(nameof(Index));
    }

    // ─── Edit (GET) ─────────────────────────────────────────────────
    public async Task<IActionResult> Edit(int id)
    {
        var department = await _db.Departments.FindAsync(id);
        if (department == null) return NotFound();
        return View(department);
    }

    // ─── Edit (POST) ────────────────────────────────────────────────
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, Department department)
    {
        if (id != department.Id) return BadRequest();
        if (!ModelState.IsValid) return View(department);

        if (await _db.Departments.AnyAsync(d => d.Name == department.Name && d.Id != id))
        {
            ModelState.AddModelError("Name", "A department with this name already exists.");
            return View(department);
        }

        try
        {
            var existing = await _db.Departments.FindAsync(id);
            if (existing == null) return NotFound();

            existing.Name = department.Name;
            await _db.SaveChangesAsync();
            TempData["Success"] = "Department updated successfully.";
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!await _db.Departments.AnyAsync(d => d.Id == id))
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
        var department = await _db.Departments
            .Include(d => d.SubDepartments)
            .Include(d => d.Employees)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (department == null) return NotFound();

        // Cascade check: prevent delete if sub-departments or employees exist
        if (department.SubDepartments.Count > 0)
        {
            TempData["Error"] = "Cannot delete department. Remove all sub-departments first.";
            return RedirectToAction(nameof(Index));
        }

        if (department.Employees.Count > 0)
        {
            TempData["Error"] = "Cannot delete department. Move or remove all employees first.";
            return RedirectToAction(nameof(Index));
        }

        _db.Departments.Remove(department);
        await _db.SaveChangesAsync();

        TempData["Success"] = "Department deleted successfully.";
        return RedirectToAction(nameof(Index));
    }
}
