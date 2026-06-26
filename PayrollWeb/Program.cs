using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.Cookies;
using PayrollWeb;
using PayrollWeb.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

builder.Services.AddDbContext<PayrollDbContext>(options =>
    options.UseSqlite("Data Source=payroll.db"));

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options => {
        options.LoginPath = "/Auth/Login";
        options.LogoutPath = "/Auth/Logout";
        options.AccessDeniedPath = "/Auth/Login";
    });
builder.Services.AddAuthorization();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

// Seed database
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PayrollDbContext>();
    db.Database.EnsureCreated();
    
    // Seed admin user
    if (!db.Users.Any())
    {
        db.Users.Add(new PayrollWeb.Models.User
        {
            UserId = "admin",
            Name = "Administrator",
            Designation = "System Admin",
            PasswordHash = "admin",
            IsAdmin = true,
            CreatedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
        });
        db.SaveChanges();
    }
    
    // Seed company settings
    if (!db.CompanySettings.Any())
    {
        db.CompanySettings.Add(new PayrollWeb.Models.CompanySetting
        {
            Id = 1,
            CompanyName = "MANIT SOLUTIONS",
            Address = "India",
            ContactNo = "+91 XXXXXXXXXX",
            EmailId = "contact@manitsolutions.in",
            PfPercentage = 12.0m,
            EsicPercentage = 0.75m
        });
        db.SaveChanges();
    }
    
    // Seed departments
    if (!db.Departments.Any())
    {
        db.Departments.Add(new PayrollWeb.Models.Department { Name = "Engineering" });
        db.Departments.Add(new PayrollWeb.Models.Department { Name = "HR" });
        db.Departments.Add(new PayrollWeb.Models.Department { Name = "Finance" });
        db.Departments.Add(new PayrollWeb.Models.Department { Name = "Marketing" });
        db.Departments.Add(new PayrollWeb.Models.Department { Name = "Operations" });
        db.SaveChanges();
    }
}

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();


app.Run();
