using Microsoft.EntityFrameworkCore;
using PayrollWeb.Models;

namespace PayrollWeb;

public class PayrollDbContext : DbContext
{
    public PayrollDbContext(DbContextOptions<PayrollDbContext> options) : base(options)
    {
    }

    public DbSet<Department> Departments => Set<Department>();
    public DbSet<SubDepartment> SubDepartments => Set<SubDepartment>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<DailyAttendance> DailyAttendances => Set<DailyAttendance>();
    public DbSet<MonthlyAttendance> MonthlyAttendances => Set<MonthlyAttendance>();
    public DbSet<CompanySetting> CompanySettings => Set<CompanySetting>();
    public DbSet<PtSlab> PtSlabs => Set<PtSlab>();
    public DbSet<SalaryRecord> SalaryRecords => Set<SalaryRecord>();
    public DbSet<User> Users => Set<User>();
    public DbSet<FingerprintEnrollment> FingerprintEnrollments => Set<FingerprintEnrollment>();
    public DbSet<TdsSlab> TdsSlabs => Set<TdsSlab>();
    public DbSet<EmployeeTds> EmployeeTds => Set<EmployeeTds>();
    public DbSet<LwfSetting> LwfSettings => Set<LwfSetting>();
    public DbSet<BonusSetting> BonusSettings => Set<BonusSetting>();
    public DbSet<EmployeeBonus> EmployeeBonuses => Set<EmployeeBonus>();
    public DbSet<GratuitySetting> GratuitySettings => Set<GratuitySetting>();
    public DbSet<EmployeeGratuity> EmployeeGratuities => Set<EmployeeGratuity>();
    public DbSet<MinWage> MinWages => Set<MinWage>();
    public DbSet<ComplianceChallan> ComplianceChallans => Set<ComplianceChallan>();
    public DbSet<ComplianceReturn> ComplianceReturns => Set<ComplianceReturn>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // ─── Department ────────────────────────────────────────────────
        modelBuilder.Entity<Department>(entity =>
        {
            entity.HasIndex(e => e.Name).IsUnique();
        });

        // ─── SubDepartment ─────────────────────────────────────────────
        modelBuilder.Entity<SubDepartment>(entity =>
        {
            entity.HasIndex(e => new { e.DepartmentId, e.Name }).IsUnique();

            entity.HasOne(e => e.Department)
                  .WithMany(d => d.SubDepartments)
                  .HasForeignKey(e => e.DepartmentId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── Employee ──────────────────────────────────────────────────
        modelBuilder.Entity<Employee>(entity =>
        {
            entity.HasIndex(e => e.EmployeeCode).IsUnique();

            entity.HasOne(e => e.Department)
                  .WithMany(d => d.Employees)
                  .HasForeignKey(e => e.DepartmentId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.SubDepartment)
                  .WithMany(sd => sd.Employees)
                  .HasForeignKey(e => e.SubDepartmentId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ─── DailyAttendance ───────────────────────────────────────────
        modelBuilder.Entity<DailyAttendance>(entity =>
        {
            entity.HasIndex(e => new { e.EmployeeCode, e.AttendanceDate }).IsUnique();
        });

        // ─── MonthlyAttendance ─────────────────────────────────────────
        modelBuilder.Entity<MonthlyAttendance>(entity =>
        {
            entity.HasIndex(e => new { e.EmployeeCode, e.Year, e.Month }).IsUnique();
        });

        // ─── CompanySetting (singleton) ────────────────────────────────
        modelBuilder.Entity<CompanySetting>(entity =>
        {
            entity.ToTable(t => t.HasCheckConstraint("CK_CompanySettings_Singleton", "Id = 1"));

            entity.Property(e => e.CompanyName).HasDefaultValue("");
            entity.Property(e => e.Address).HasDefaultValue("");
            entity.Property(e => e.GstNo).HasDefaultValue("");
            entity.Property(e => e.FounderName).HasDefaultValue("");
            entity.Property(e => e.CeoName).HasDefaultValue("");
            entity.Property(e => e.ContactNo).HasDefaultValue("");
            entity.Property(e => e.EmailId).HasDefaultValue("");
            entity.Property(e => e.SignatureTheme).HasDefaultValue("");
            entity.Property(e => e.SignatureType).HasDefaultValue("text");
            entity.Property(e => e.SignatureImagePath).HasDefaultValue("");
            entity.Property(e => e.PfPercentage).HasDefaultValue(12.0m);
            entity.Property(e => e.EsicPercentage).HasDefaultValue(0.75m);
            entity.Property(e => e.LogoPath).HasDefaultValue("");
            entity.Property(e => e.ThemeIndex).HasDefaultValue(0);
            entity.Property(e => e.PtType).HasDefaultValue("Amount");
            entity.Property(e => e.PtPercentValue).HasDefaultValue(0m);
        });

        // ─── PtSlab ────────────────────────────────────────────────────
        // No unique constraints per schema.

        // ─── SalaryRecord ──────────────────────────────────────────────
        modelBuilder.Entity<SalaryRecord>(entity =>
        {
            entity.Property(e => e.BankName).HasDefaultValue("");
            entity.Property(e => e.AccountNumber).HasDefaultValue("");
            entity.Property(e => e.IfscCode).HasDefaultValue("");

            entity.Property(e => e.IsPaid)
                  .HasColumnType("INTEGER")
                  .HasDefaultValue(0);

            entity.Property(e => e.IsUnpaid)
                  .HasColumnType("INTEGER")
                  .HasDefaultValue(0);
        });

        // ─── User ──────────────────────────────────────────────────────
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.UserId).IsUnique();

            entity.Property(e => e.Name).HasDefaultValue("");
            entity.Property(e => e.Designation).HasDefaultValue("");
            entity.Property(e => e.MobileNumber).HasDefaultValue("");

            entity.Property(e => e.IsAdmin)
                  .HasColumnType("INTEGER")
                  .HasDefaultValue(0);
        });

        // ─── FingerprintEnrollment ─────────────────────────────────────
        modelBuilder.Entity<FingerprintEnrollment>(entity =>
        {
            entity.HasIndex(e => e.EmployeeCode).IsUnique();

            entity.Property(e => e.IdentityHash).HasDefaultValue("");
        });

        // ─── TdsSlab ───────────────────────────────────────────────────
        modelBuilder.Entity<TdsSlab>(entity =>
        {
            entity.HasIndex(e => new { e.FromAmount, e.ToAmount, e.FinancialYear }).IsUnique();

            entity.Property(e => e.CessRate).HasDefaultValue(0.04m);
            entity.Property(e => e.FinancialYear).HasDefaultValue("");
        });

        // ─── EmployeeTds ───────────────────────────────────────────────
        modelBuilder.Entity<EmployeeTds>(entity =>
        {
            entity.HasIndex(e => new { e.EmployeeCode, e.FinancialYear }).IsUnique();

            entity.Property(e => e.TotalIncome).HasDefaultValue(0m);
            entity.Property(e => e.TotalTax).HasDefaultValue(0m);
            entity.Property(e => e.TaxPaid).HasDefaultValue(0m);
            entity.Property(e => e.CessAmount).HasDefaultValue(0m);
        });

        // ─── LwfSetting ────────────────────────────────────────────────
        modelBuilder.Entity<LwfSetting>(entity =>
        {
            entity.HasIndex(e => e.StateName).IsUnique();

            entity.Property(e => e.EmployeeContribution).HasDefaultValue(0m);
            entity.Property(e => e.EmployerContribution).HasDefaultValue(0m);

            entity.Property(e => e.IsActive)
                  .HasColumnType("INTEGER")
                  .HasDefaultValue(1);
        });

        // ─── BonusSetting ──────────────────────────────────────────────
        modelBuilder.Entity<BonusSetting>(entity =>
        {
            entity.Property(e => e.MinBonusPercent).HasDefaultValue(8.33m);
            entity.Property(e => e.MaxBonusPercent).HasDefaultValue(20m);
            entity.Property(e => e.MaxBonusWages).HasDefaultValue(21000m);
            entity.Property(e => e.EligibilityMonths).HasDefaultValue(30);

            entity.Property(e => e.IsActive)
                  .HasColumnType("INTEGER")
                  .HasDefaultValue(1);
        });

        // ─── EmployeeBonus ─────────────────────────────────────────────
        modelBuilder.Entity<EmployeeBonus>(entity =>
        {
            entity.HasIndex(e => new { e.EmployeeCode, e.FinancialYear }).IsUnique();

            entity.Property(e => e.EligibleWages).HasDefaultValue(0m);
            entity.Property(e => e.BonusAmount).HasDefaultValue(0m);
            entity.Property(e => e.PaidAmount).HasDefaultValue(0m);

            entity.Property(e => e.IsPaid)
                  .HasColumnType("INTEGER")
                  .HasDefaultValue(0);
        });

        // ─── GratuitySetting ───────────────────────────────────────────
        modelBuilder.Entity<GratuitySetting>(entity =>
        {
            entity.Property(e => e.RatePerYear).HasDefaultValue(15m);
            entity.Property(e => e.MaxExemptAmount).HasDefaultValue(2000000m);
            entity.Property(e => e.MaxServiceMonths).HasDefaultValue(0);

            entity.Property(e => e.IsActive)
                  .HasColumnType("INTEGER")
                  .HasDefaultValue(1);
        });

        // ─── EmployeeGratuity ──────────────────────────────────────────
        modelBuilder.Entity<EmployeeGratuity>(entity =>
        {
            entity.HasIndex(e => new { e.EmployeeCode, e.FinancialYear }).IsUnique();

            entity.Property(e => e.ServiceYears).HasDefaultValue(0);
            entity.Property(e => e.ServiceMonths).HasDefaultValue(0);
            entity.Property(e => e.LastBasic).HasDefaultValue(0m);
            entity.Property(e => e.GratuityAmount).HasDefaultValue(0m);

            entity.Property(e => e.IsApproved)
                  .HasColumnType("INTEGER")
                  .HasDefaultValue(0);
        });

        // ─── MinWage ───────────────────────────────────────────────────
        modelBuilder.Entity<MinWage>(entity =>
        {
            entity.HasIndex(e => new { e.StateName, e.Category, e.EffectiveFrom }).IsUnique();

            entity.Property(e => e.Category).HasDefaultValue("UNSKILLED");

            entity.Property(e => e.IsActive)
                  .HasColumnType("INTEGER")
                  .HasDefaultValue(1);
        });

        // ─── ComplianceChallan ─────────────────────────────────────────
        modelBuilder.Entity<ComplianceChallan>(entity =>
        {
            entity.Property(e => e.ReferenceNumber).HasDefaultValue("");
            entity.Property(e => e.Amount).HasDefaultValue(0m);
            entity.Property(e => e.BankName).HasDefaultValue("");
            entity.Property(e => e.TransactionId).HasDefaultValue("");
            entity.Property(e => e.Remarks).HasDefaultValue("");
        });

        // ─── ComplianceReturn ──────────────────────────────────────────
        modelBuilder.Entity<ComplianceReturn>(entity =>
        {
            entity.Property(e => e.ReferenceNumber).HasDefaultValue("");
            entity.Property(e => e.Status).HasDefaultValue("PENDING");
            entity.Property(e => e.Remarks).HasDefaultValue("");
        });
    }
}
