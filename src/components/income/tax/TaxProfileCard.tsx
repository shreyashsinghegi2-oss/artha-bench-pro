import React from 'react';
import { AlertTriangle, Landmark, ShieldAlert } from 'lucide-react';
import { getIndiaTaxRules } from '../../../config/taxRules/india';
import { IndianTaxProfile } from '../../../types/taxTypes';

interface Props {
  profile: IndianTaxProfile;
  onChange: (profile: IndianTaxProfile) => void;
}

const fieldClass = 'mt-1.5 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/15';

export const TaxProfileCard: React.FC<Props> = ({ profile, onChange }) => {
  const rules = getIndiaTaxRules(profile.financialYear);
  const patch = (next: Partial<IndianTaxProfile>) => onChange({ ...profile, ...next, updatedAt: new Date().toISOString() });
  return (
    <section className="rounded-3xl border border-interactive/20 bg-surface p-5 shadow-sm sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-info-soft text-info"><Landmark className="h-5 w-5" /></div>
          <div><p className="text-xs font-black uppercase tracking-[0.14em] text-info">Persistent setup</p><h2 className="mt-1 text-xl font-black text-ink">Indian Tax Profile</h2><p className="mt-1 text-sm text-secondary">Controls the rules used across Income and Tax Estimate.</p></div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${rules.verified ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>{rules.ruleVersion} · verified {rules.lastVerifiedAt}</span>
      </header>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold text-ink"><span title="Financial Year: when income is earned">Financial year (FY)</span><select className={fieldClass} value={profile.financialYear} onChange={(event) => patch({ financialYear: event.target.value as IndianTaxProfile['financialYear'] })}><option value="FY2025-26">FY 2025–26 / AY 2026–27</option><option value="FY2026-27">FY 2026–27 / AY 2027–28</option></select></label>
        <label className="text-sm font-semibold text-ink">Taxpayer type<select className={fieldClass} value={profile.taxpayerType} onChange={(event) => patch({ taxpayerType: event.target.value as IndianTaxProfile['taxpayerType'] })}><option value="individual">Individual</option><option value="huf">HUF</option><option value="other">Other — review required</option></select></label>
        <label className="text-sm font-semibold text-ink">Residential status<select className={fieldClass} value={profile.residentialStatus} onChange={(event) => patch({ residentialStatus: event.target.value as IndianTaxProfile['residentialStatus'] })}><option value="resident">Resident individual</option><option value="rnor">RNOR</option><option value="non-resident">Non-resident</option></select></label>
        <label className="text-sm font-semibold text-ink">Age category<select className={fieldClass} value={profile.ageCategory} onChange={(event) => patch({ ageCategory: event.target.value as IndianTaxProfile['ageCategory'] })}><option value="below-60">Below 60</option><option value="60-79">Senior citizen: 60–79</option><option value="80-plus">Super senior: 80+</option></select></label>
        <label className="text-sm font-semibold text-ink">Tax regime<select className={fieldClass} value={profile.taxRegime} onChange={(event) => patch({ taxRegime: event.target.value as IndianTaxProfile['taxRegime'] })}><option value="new">New tax regime</option><option value="old">Old tax regime</option><option value="compare">Compare both</option></select></label>
        <label className="text-sm font-semibold text-ink">Employment profile<select className={fieldClass} value={profile.employmentProfile} onChange={(event) => patch({ employmentProfile: event.target.value as IndianTaxProfile['employmentProfile'] })}><option value="salaried">Salaried</option><option value="professional">Freelancer / Professional</option><option value="business">Business owner</option><option value="multiple">Multiple income sources</option></select></label>
        <label className="text-sm font-semibold text-ink">PAN available<select className={fieldClass} value={profile.panAvailable ? 'yes' : 'no'} onChange={(event) => patch({ panAvailable: event.target.value === 'yes' })}><option value="yes">Yes</option><option value="no">No</option></select></label>
        <label className="text-sm font-semibold text-ink">GST registration<select className={fieldClass} value={profile.gstStatus} onChange={(event) => patch({ gstStatus: event.target.value as IndianTaxProfile['gstStatus'] })}><option value="not-registered">Not registered</option><option value="registered">Registered</option><option value="composition">Composition scheme</option></select></label>
        <label className="text-sm font-semibold text-ink lg:col-span-2">Tax calculation mode<select className={fieldClass} value={profile.calculationMode} onChange={(event) => patch({ calculationMode: event.target.value as IndianTaxProfile['calculationMode'] })}><option value="estimate">Estimate only</option><option value="ca-reviewed">CA-reviewed rules configuration</option></select></label>
      </div>

      {!profile.panAvailable ? <p className="mt-4 flex gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning"><ShieldAlert className="h-4 w-4 shrink-0" /> PAN is marked unavailable. Higher withholding or other tax consequences may apply.</p> : null}
      {profile.taxpayerType === 'other' || profile.residentialStatus !== 'resident' ? <p className="mt-4 flex gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning"><AlertTriangle className="h-4 w-4 shrink-0" /> These tax rules may differ. The estimate will show a review warning.</p> : null}
      <p className="mt-4 rounded-xl border border-warning-fill/30 bg-warning-soft p-3 text-sm font-bold leading-6 text-warning">Estimated tax calculation based on currently configured rules. Verify with official Income Tax Department sources or a qualified CA before filing.</p>
    </section>
  );
};
