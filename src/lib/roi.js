/**
 * Payback maths for an installed solar system.
 *
 * This measures what a system actually returned, from figures the owner
 * records. It deliberately does not model or project: the sibling
 * solar-payback calculator already answers the pre-purchase question from
 * assumptions, and mixing the two would obscure which numbers are measured
 * and which are guessed.
 *
 * The only assumption here is the electricity rate, because a kWh generated
 * is only worth something at some price. That is the owner's own tariff and
 * is editable.
 */

/** Meralco residential all-in rate, reviewed 2026-05. Editable by the user. */
export const DEFAULT_RATE_PHP_PER_KWH = 14.33;

/**
 * Exported energy is credited near the generation charge rather than the full
 * retail rate under PH net metering, so self-consumed and exported kWh are
 * worth different amounts.
 */
export const DEFAULT_EXPORT_CREDIT_RATIO = 0.5;

/**
 * @typedef {{ period: string, kwh: number, exportedKwh?: number }} Entry
 *   period is "YYYY-MM". kwh is total generation for that month.
 */

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * @param {object} input
 * @param {number} input.investmentPhp   total paid, including installation
 * @param {Entry[]} input.entries
 * @param {number} [input.ratePhpPerKwh]
 * @param {number} [input.exportCreditRatio]
 */
export function computeRoi({
  investmentPhp,
  entries = [],
  ratePhpPerKwh = DEFAULT_RATE_PHP_PER_KWH,
  exportCreditRatio = DEFAULT_EXPORT_CREDIT_RATIO,
}) {
  const sorted = [...entries]
    .filter((e) => e && e.period && Number.isFinite(Number(e.kwh)))
    .sort((a, b) => a.period.localeCompare(b.period));

  let cumulativeKwh = 0;
  let cumulativeSavings = 0;
  let breakEvenPeriod = null;

  const timeline = sorted.map((e) => {
    const kwh = Number(e.kwh) || 0;
    const exported = Math.min(Number(e.exportedKwh) || 0, kwh);
    const selfUsed = kwh - exported;

    // Self-consumed energy displaces electricity at the full retail rate;
    // exported energy earns the lower credit.
    const value = selfUsed * ratePhpPerKwh + exported * ratePhpPerKwh * exportCreditRatio;

    cumulativeKwh += kwh;
    cumulativeSavings += value;

    if (breakEvenPeriod === null && cumulativeSavings >= investmentPhp) {
      breakEvenPeriod = e.period;
    }

    return {
      period: e.period,
      kwh: round2(kwh),
      exportedKwh: round2(exported),
      savingsPhp: round2(value),
      cumulativeKwh: round2(cumulativeKwh),
      cumulativeSavingsPhp: round2(cumulativeSavings),
      remainingPhp: round2(Math.max(0, investmentPhp - cumulativeSavings)),
    };
  });

  const monthsRecorded = timeline.length;
  const remaining = Math.max(0, investmentPhp - cumulativeSavings);
  const percentRecovered = investmentPhp > 0
    ? Math.min(100, (cumulativeSavings / investmentPhp) * 100)
    : 0;

  // Project the remaining time from what this system has actually averaged,
  // not from a generic assumption. With no history there is nothing to
  // project from, and saying so is better than inventing a figure.
  const averageMonthlySavings = monthsRecorded > 0 ? cumulativeSavings / monthsRecorded : 0;
  const monthsToBreakEven = breakEvenPeriod
    ? 0
    : averageMonthlySavings > 0
      ? Math.ceil(remaining / averageMonthlySavings)
      : null;

  return {
    investmentPhp: round2(investmentPhp),
    ratePhpPerKwh,
    monthsRecorded,
    totalKwh: round2(cumulativeKwh),
    totalSavingsPhp: round2(cumulativeSavings),
    remainingPhp: round2(remaining),
    percentRecovered: round2(percentRecovered),
    averageMonthlyKwh: monthsRecorded ? round2(cumulativeKwh / monthsRecorded) : 0,
    averageMonthlySavingsPhp: round2(averageMonthlySavings),
    breakEvenPeriod,
    monthsToBreakEven,
    // Effective cost per kWh so far: what each unit generated has actually
    // cost, which falls as the system keeps producing.
    costPerKwhPhp: cumulativeKwh > 0 ? round2(investmentPhp / cumulativeKwh) : null,
    timeline,
  };
}
