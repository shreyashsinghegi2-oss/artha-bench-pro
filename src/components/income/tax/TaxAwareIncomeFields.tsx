import React, { useState } from 'react';
import { Activity, FileCheck2 } from 'lucide-react';
import { IncomeType } from '../../../services/incomeStorage';
import { arthaMarketDataProvider } from '../../../services/taxMarketDataProvider';
import { IncomeTaxDetails, InvestmentSubtype } from '../../../types/taxTypes';

interface Props {
  type: IncomeType;
  details: IncomeTaxDetails;
  onChange: (details: IncomeTaxDetails) => void;
}

const fieldClass = 'mt-1.5 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition focus:border-interactive focus:ring-2 focus:ring-interactive/15';

const investmentSubtypes: Array<{ value: InvestmentSubtype; label: string }> = [
  { value: 'listed-equity', label: 'Indian listed equity' },
  { value: 'equity-mutual-fund', label: 'Equity mutual fund' },
  { value: 'debt-mutual-fund', label: 'Debt mutual fund' },
  { value: 'bonds', label: 'Bonds' },
  { value: 'fixed-deposit', label: 'Fixed deposit / RD' },
  { value: 'savings-interest', label: 'Savings account interest' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'reit-invit', label: 'REIT / InvIT' },
  { value: 'gold-sgb', label: 'Gold / SGB' },
  { value: 'vda', label: 'Cryptocurrency / VDA' },
  { value: 'foreign-stock', label: 'Foreign stocks / RSUs / ESOPs' },
  { value: 'other-capital-asset', label: 'Other capital asset' },
];

export const TaxAwareIncomeFields: React.FC<Props> = ({ type, details, onChange }) => {
  const [quoteStatus, setQuoteStatus] = useState('');
  const patch = (next: Partial<IncomeTaxDetails>) => onChange({ ...details, ...next });
  const textField = (key: keyof IncomeTaxDetails, label: string, placeholder = '') => (
    <label className="text-sm font-semibold text-ink">{label}
      <input className={fieldClass} value={String(details[key] ?? '')} placeholder={placeholder} onChange={(event) => patch({ [key]: event.target.value || undefined })} />
    </label>
  );
  const numberField = (key: keyof IncomeTaxDetails, label: string) => (
    <label className="text-sm font-semibold text-ink">{label}
      <input className={fieldClass} type="number" min="0" step="0.01" inputMode="decimal" value={details[key] === undefined ? '' : String(details[key])} onChange={(event) => patch({ [key]: event.target.value === '' ? undefined : Number(event.target.value) })} />
    </label>
  );

  const loadQuote = async () => {
    if (!details.symbol?.trim()) { setQuoteStatus('Enter a market symbol first.'); return; }
    setQuoteStatus('Loading provider-labelled quote…');
    try {
      const quote = details.investmentSubtype === 'vda'
        ? await arthaMarketDataProvider.getQuote(details.symbol.trim())
        : await arthaMarketDataProvider.getQuote(details.symbol.trim());
      patch({ latestQuote: quote.price, quoteCurrency: quote.currency, quoteProvider: quote.provider, quoteFreshness: quote.freshness, quoteTimestamp: quote.timestamp });
      setQuoteStatus(`${quote.provider} · ${quote.freshness} · ${new Date(quote.timestamp).toLocaleString('en-IN')}`);
    } catch (error) {
      setQuoteStatus(error instanceof Error ? error.message : 'Live market data unavailable. Keep the manual transaction values.');
    }
  };

  return (
    <fieldset className="rounded-2xl border border-brand/20 bg-brand-soft/35 p-4">
      <legend className="px-2 text-sm font-black text-brand-hover">India tax details · optional but improves the estimate</legend>

      {type === 'Salary' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {textField('employerName', 'Employer name')}
          <label className="text-sm font-semibold text-ink">Amount entered is
            <select className={fieldClass} value={details.amountBasis ?? 'gross'} onChange={(event) => patch({ amountBasis: event.target.value as 'gross' | 'net' })}><option value="gross">Gross salary</option><option value="net">Net received</option></select>
          </label>
          {numberField('basicSalary', 'Basic salary')}
          {numberField('hra', 'HRA received')}
          {numberField('hraExemption', 'HRA exemption claimed')}
          {numberField('specialAllowance', 'Special allowance')}
          {numberField('bonus', 'Bonus / incentive')}
          {numberField('employerNps', 'Employer NPS contribution')}
          {numberField('employerPf', 'Employer PF contribution')}
          {numberField('professionalTax', 'Professional tax')}
          {numberField('perquisites', 'Perquisites')}
          {numberField('tdsDeducted', 'Salary TDS deducted')}
        </div>
      ) : null}

      {type === 'Freelance' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {textField('clientName', 'Client name')}
          <label className="text-sm font-semibold text-ink">Client type<select className={fieldClass} value={details.clientType ?? 'indian'} onChange={(event) => patch({ clientType: event.target.value as 'indian' | 'foreign' })}><option value="indian">Indian</option><option value="foreign">Foreign</option></select></label>
          {numberField('grossReceipts', 'Gross receipts / invoices')}
          <label className="text-sm font-semibold text-ink">Invoice date<input className={fieldClass} type="date" value={details.invoiceDate ?? ''} onChange={(event) => patch({ invoiceDate: event.target.value })} /></label>
          <label className="text-sm font-semibold text-ink">Payment date<input className={fieldClass} type="date" value={details.paymentDate ?? ''} onChange={(event) => patch({ paymentDate: event.target.value })} /></label>
          {numberField('tdsDeducted', 'TDS deducted')}
          {textField('tdsSection', 'TDS section (if known)', '194J')}
          {numberField('businessExpenses', 'Eligible business expenses total')}
          <label className="text-sm font-semibold text-ink">GST treatment<select className={fieldClass} value={details.gstTreatment ?? 'not-applicable'} onChange={(event) => patch({ gstTreatment: event.target.value as IncomeTaxDetails['gstTreatment'] })}><option value="not-applicable">Not applicable</option><option value="included">Included in receipts</option><option value="excluded">Excluded from receipts</option></select></label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" checked={Boolean(details.presumptiveEligible)} onChange={(event) => patch({ presumptiveEligible: event.target.checked })} /> Record possible presumptive-tax eligibility</label>
        </div>
      ) : null}

      {type === 'Rental' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {textField('propertyName', 'Property name / location')}
          <label className="text-sm font-semibold text-ink">Property use<select className={fieldClass} value={details.propertyUse ?? 'let-out'} onChange={(event) => patch({ propertyUse: event.target.value as 'self-occupied' | 'let-out' })}><option value="let-out">Let-out</option><option value="self-occupied">Self-occupied</option></select></label>
          {numberField('coOwnedPercent', 'Your ownership %')}
          {numberField('vacancyMonths', 'Vacancy months')}
          {numberField('municipalTaxes', 'Municipal taxes paid')}
          {numberField('homeLoanInterest', 'Home-loan interest')}
          {numberField('tenantTds', 'Tenant TDS')}
        </div>
      ) : null}

      {type === 'Business' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {textField('businessName', 'Business name / type')}
          {numberField('revenue', 'Revenue')}
          {numberField('costOfGoods', 'Cost of goods sold')}
          {numberField('operatingExpenses', 'Operating expenses')}
          {numberField('depreciation', 'Configured depreciation claim')}
          {numberField('gstCollected', 'GST collected (separate)')}
          {numberField('gstPaid', 'GST paid (separate)')}
          {numberField('advanceTaxPaid', 'Advance tax paid')}
          {numberField('tdsDeducted', 'TDS deducted')}
          {numberField('tcsCollected', 'TCS credit')}
          {numberField('businessLoss', 'Business loss to review')}
          <label className="flex items-center gap-2 text-sm font-semibold text-ink"><input type="checkbox" checked={Boolean(details.presumptiveEligible)} onChange={(event) => patch({ presumptiveEligible: event.target.checked })} /> Record possible presumptive-tax eligibility</label>
        </div>
      ) : null}

      {type === 'Investment Returns' ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-semibold text-ink">Investment subtype<select className={fieldClass} value={details.investmentSubtype ?? 'listed-equity'} onChange={(event) => patch({ investmentSubtype: event.target.value as InvestmentSubtype })}>{investmentSubtypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            {textField('symbol', 'Market symbol / fund ID', 'RELIANCE.NS or BTCUSDT')}
            <label className="text-sm font-semibold text-ink">Asset market<select className={fieldClass} value={details.assetMarket ?? 'indian'} onChange={(event) => patch({ assetMarket: event.target.value as 'indian' | 'foreign' })}><option value="indian">Indian</option><option value="foreign">Foreign</option></select></label>
            <label className="text-sm font-semibold text-ink">Buy date<input className={fieldClass} type="date" value={details.buyDate ?? ''} onChange={(event) => patch({ buyDate: event.target.value })} /></label>
            <label className="text-sm font-semibold text-ink">Sell date<input className={fieldClass} type="date" value={details.sellDate ?? ''} onChange={(event) => patch({ sellDate: event.target.value })} /></label>
            {numberField('quantity', 'Quantity')}
            {numberField('purchasePrice', 'Purchase price per unit')}
            {numberField('salePrice', 'Sale price per unit')}
            {numberField('transactionCharges', 'Eligible transaction charges')}
            {numberField('stt', 'STT (tracked separately)')}
          </div>
          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm font-bold text-ink">Informational market value</p><p className="text-xs text-secondary">Tax uses actual transaction prices and dates—not today’s quote.</p></div>
              <button type="button" onClick={loadQuote} className="inline-flex items-center gap-2 rounded-xl border border-brand/25 px-3 py-2 text-xs font-bold text-brand-hover"><Activity className="h-4 w-4" /> Load latest quote</button>
            </div>
            {details.latestQuote ? <p className="mt-2 text-sm font-black text-ink">{details.quoteCurrency} {details.latestQuote.toLocaleString('en-IN')} <span className="text-xs font-normal text-secondary">· {details.quoteProvider} · {details.quoteFreshness}</span></p> : null}
            {quoteStatus ? <p className="mt-2 text-xs text-secondary">{quoteStatus}</p> : null}
          </div>
        </div>
      ) : null}

      {type === 'Other' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {textField('otherIncomeSubtype', 'Other-income subtype', 'Family pension, gift, winnings…')}
          <label className="text-sm font-semibold text-ink">Taxability<select className={fieldClass} value={details.taxability ?? 'slab'} onChange={(event) => patch({ taxability: event.target.value as IncomeTaxDetails['taxability'] })}><option value="slab">Taxable at slab rate</option><option value="exempt">Exempt</option><option value="special">Special-rate income</option><option value="partly-taxable">Partly taxable</option><option value="review">Needs professional review</option></select></label>
          {details.taxability === 'special' ? numberField('specialRatePercent', 'Special rate % (confirm before filing)') : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-brand/15 pt-4">
        <FileCheck2 className="h-4 w-4 text-brand" />
        <label className="text-sm font-semibold text-ink">Supporting document status
          <select className={`${fieldClass} min-w-44`} value={details.documentStatus ?? 'not-added'} onChange={(event) => patch({ documentStatus: event.target.value as IncomeTaxDetails['documentStatus'] })}>
            <option value="not-added">Not added</option><option value="added">Added</option><option value="verified">Verified</option><option value="needs-review">Needs review</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
};
