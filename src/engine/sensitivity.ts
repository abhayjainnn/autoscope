import type { CompanyProfile, Portfolio, SensitivityItem } from '../types';
import { num } from './lineSim';
import { npvOf } from './roi';

interface Mods {
  labourCost: number;
  investment: number;
  labourReduction: number;
  volume: number;
  unitValue: number;
  discountRate: number;
}

/** Portfolio NPV with multiplicative changes applied to the savings components. */
function portfolioNpv(profile: CompanyProfile, p: Portfolio, m: Mods): number {
  const years = num(profile.horizonYears, 5);
  let total = 0;
  for (const r of p.selected) {
    const s = r.annualSavings;
    const labour = s.labour * m.labourCost * m.labourReduction;
    const volumeValue = m.volume * m.unitValue;
    const gross = labour + s.ergonomics + (s.scrap + s.downtime + s.throughput) * volumeValue;
    const inv = r.totalInvestment * m.investment;
    const net = gross - r.annualOpex * m.investment;
    total += npvOf(inv, net, years, m.discountRate);
  }
  return total;
}

export function computeSensitivity(profile: CompanyProfile, portfolio: Portfolio): SensitivityItem[] {
  const baseMods: Mods = { labourCost: 1, investment: 1, labourReduction: 1, volume: 1, unitValue: 1, discountRate: num(profile.discountRate, 0.08) };
  const base = portfolioNpv(profile, portfolio, baseMods);
  const vary = (label: string, key: keyof Mods, lo: number, hi: number): SensitivityItem => ({
    label,
    npvLow: portfolioNpv(profile, portfolio, { ...baseMods, [key]: lo }),
    npvHigh: portfolioNpv(profile, portfolio, { ...baseMods, [key]: hi }),
    base,
  });
  const items = [
    vary('Labour cost ±20%', 'labourCost', 0.8, 1.2),
    vary('Investment ±25%', 'investment', 0.75, 1.25),
    vary('Labour reduction achieved ±25%', 'labourReduction', 0.75, 1.25),
    vary('Production volume ±20%', 'volume', 0.8, 1.2),
    vary('Discount rate 5% vs 12%', 'discountRate', 0.05, 0.12),
    vary('Unit value ±20%', 'unitValue', 0.8, 1.2),
  ];
  return items.sort((a, b) => Math.abs(b.npvHigh - b.npvLow) - Math.abs(a.npvHigh - a.npvLow));
}
