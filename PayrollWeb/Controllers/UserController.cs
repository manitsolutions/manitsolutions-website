using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PayrollWeb.Models;

namespace PayrollWeb.Controllers;

[Authorize(Roles = "Admin")]
public class UserController : Controller
{
    private readonly PayrollDbContext _db;

    public UserController(PayrollDbContext db)
    {
        _db = db;
    }

    // ─── Index ─────────────────────────────────────────────────────────
    public async Task<IActionResult> Index()
    {
        var users = await _db.Users
            .OrderBy(u => u.Name)
            .ToListAsync();
        return View(users);
    }

    // ─── Create (GET) ──────────────────────────────────────────────────
    public IActionResult Create()
    {
        return View();
    }

    // ─── Create (POST) ─────────────────────────────────────────────────
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(User user)
    {
        if (!ModelState.IsValid) return View(user);

        if (await _db.Users.AnyAsync(u => u.UserId == user.UserId))
        {
            ModelState.AddModelError("UserId", "This User ID is already taken.");
            return View(user);
        }

        user.PasswordHash = user.PasswordHash; // plain text (matching desktop app)
        user.CreatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        TempData["Success"] = $"User '{user.UserId}' created successfully.";
        return RedirectToAction(nameof(Index));
    }

    // ─── Edit (GET) ────────────────────────────────────────────────────
    public async Task<IActionResult> Edit(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        return View(user);
    }

    // ─── Edit (POST) ───────────────────────────────────────────────────
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, User user)
    {
        if (id != user.Id) return BadRequest();
        if (!ModelState.IsValid) return View(user);

        // Check unique UserId (exclude self)
        if (await _db.Users.AnyAsync(u => u.UserId == user.UserId && u.Id != id))
        {
            ModelState.AddModelError("UserId", "This User ID is already taken.");
            return View(user);
        }

        try
        {
            var existing = await _db.Users.FindAsync(id);
            if (existing == null) return NotFound();

            existing.UserId = user.UserId;
            existing.Name = user.Name;
            existing.Designation = user.Designation;
            existing.MobileNumber = user.MobileNumber;
            existing.IsAdmin = user.IsAdmin;

            // Only update password if a new value was provided
            if (!string.IsNullOrWhiteSpace(user.PasswordHash))
            {
                existing.PasswordHash = user.PasswordHash; // plain text
            }

            await _db.SaveChangesAsync();
            TempData["Success"] = $"User '{user.UserId}' updated successfully.";
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!await _db.Users.AnyAsync(u => u.Id == id))
                return NotFound();
            throw;
        }

        return RedirectToAction(nameof(Index));
    }

    // ─── Delete (POST) ─────────────────────────────────────────────────
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();

        TempData["Success"] = $"User '{user.UserId}' deleted successfully.";
        return RedirectToAction(nameof(Index));
    }

    // ─── Change Password (POST) ───────────────────────────────────────
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ChangePassword(int id, string newPassword)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (string.IsNullOrWhiteSpace(newPassword))
        {
            TempData["Error"] = "Password cannot be empty.";
            return RedirectToAction(nameof(Index));
        }

        user.PasswordHash = newPassword; // plain text (matching desktop app)
        await _db.SaveChangesAsync();

        TempData["Success"] = $"Password changed for user '{user.UserId}'.";
        return RedirectToAction(nameof(Index));
    }
}
