using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PayrollWeb.Models;

namespace PayrollWeb.Controllers;

[Authorize(Roles = "Admin")]
public class SettingsController : Controller
{
    private readonly PayrollDbContext _db;

    public SettingsController(PayrollDbContext db)
    {
        _db = db;
    }

    // ─── Index (GET) ───────────────────────────────────────────────────
    public async Task<IActionResult> Index()
    {
        var settings = await _db.CompanySettings.FirstOrDefaultAsync();

        // If no settings row exists yet, create a default one
        if (settings == null)
        {
            settings = new CompanySetting
            {
                Id = 1,
                CompanyName = "",
                Address = "",
                GstNo = "",
                FounderName = "",
                CeoName = "",
                ContactNo = "",
                EmailId = "",
                PfPercentage = 12.0m,
                EsicPercentage = 0.75m,
                SignatureTheme = "",
                SignatureType = "text",
                SignatureImagePath = "",
                LogoPath = "",
                ThemeIndex = 0,
                PtType = "Amount",
                PtPercentValue = 0m
            };
            _db.CompanySettings.Add(settings);
            await _db.SaveChangesAsync();
        }

        return View(settings);
    }

    // ─── Save (POST) ───────────────────────────────────────────────────
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Save(CompanySetting model)
    {
        if (!ModelState.IsValid)
        {
            // Return to Index view with the model so the form re-populates
            return View("Index", model);
        }

        var settings = await _db.CompanySettings.FirstOrDefaultAsync();
        if (settings == null)
        {
            model.Id = 1;
            _db.CompanySettings.Add(model);
        }
        else
        {
            settings.CompanyName = model.CompanyName;
            settings.Address = model.Address;
            settings.GstNo = model.GstNo;
            settings.FounderName = model.FounderName;
            settings.CeoName = model.CeoName;
            settings.ContactNo = model.ContactNo;
            settings.EmailId = model.EmailId;
            settings.PfPercentage = model.PfPercentage;
            settings.EsicPercentage = model.EsicPercentage;
        }

        await _db.SaveChangesAsync();
        TempData["Success"] = "Settings saved successfully.";
        return RedirectToAction(nameof(Index));
    }
}
