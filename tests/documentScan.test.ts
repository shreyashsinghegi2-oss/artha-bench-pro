import { describe, expect, it } from 'vitest';
import { scanStatementCsv, scanText } from '../src/services/documentScan';

describe('document scan', () => {
  it('reads a monthly payslip and annualises gross pay', () => {
    const r = scanText(['ACME Technologies Pvt Ltd', 'Payslip for June 2026', 'Basic 60,000.00', 'Gross Earnings 1,25,000.00', 'Loan EMI 12,500', 'Net Pay 98,400.00'].join('\n'));
    expect(r.kind).toBe('payslip');
    expect(r.suggestions.find((s) => s.field === 'annualSalary')?.value).toBe(1_500_000);
    expect(r.suggestions.find((s) => s.field === 'monthlyEmi')?.value).toBe(12_500);
    expect(r.suggestions[0].evidence).toMatch(/Gross Earnings/);
  });

  it('reads Form 16 gross salary and caps 80C at the statutory limit', () => {
    const r = scanText(['FORM NO. 16', 'PART B', '1. Gross Salary 18,40,000', 'Deductions under section 80C 2,10,000', 'Section 80D 25,000'].join('\n'));
    expect(r.kind).toBe('form16');
    expect(r.suggestions.find((s) => s.field === 'annualSalary')?.value).toBe(1_840_000);
    expect(r.suggestions.find((s) => s.field === 'section80C')?.value).toBe(150_000);
    expect(r.suggestions.find((s) => s.field === 'section80D')?.value).toBe(25_000);
  });

  it('summarises a bank statement CSV into monthly spending and EMIs', () => {
    const csv = [
      'Date,Narration,Withdrawal Amt,Deposit Amt,Balance',
      '01/05/2026,SALARY ACME TECHNOLOGIES,,"1,10,000",',
      '"03/05/2026","SWIGGY",1500,,',
      '05/05/2026,HDFC LOAN EMI NACH,20000,,',
      '07/05/2026,SIP ZERODHA,10000,,',
      '09/05/2026,RENT UPI,30000,,',
      '01/06/2026,SALARY ACME TECHNOLOGIES,,110000,',
      '05/06/2026,HDFC LOAN EMI NACH,20000,,',
      '10/06/2026,RENT UPI,30000,,',
      '12/06/2026,AMAZON,4500,,',
    ].join('\n');
    const r = scanStatementCsv(csv);
    expect(r.kind).toBe('statement');
    // Spending excludes the EMI and the SIP: (1500 + 30000 + 30000 + 4500) / 2 months.
    expect(r.suggestions.find((s) => s.field === 'monthlyExpenses')?.value).toBe(33_000);
    expect(r.suggestions.find((s) => s.field === 'monthlyEmi')?.value).toBe(20_000);
  });

  it('explains when nothing can be read', () => {
    const r = scanText('hello world');
    expect(r.suggestions).toHaveLength(0);
    expect(r.notes[0]).toMatch(/type the amounts/);
  });
});
