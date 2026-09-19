import React, { useMemo, useState } from 'react';

// Helper Functions
const calculateEMI = (principal: number, rate: number, tenureMonths: number): number => {
    if (tenureMonths <= 0) return principal > 0 ? Infinity : 0;
    const monthlyRate = rate / (12 * 100);
    if (monthlyRate === 0) {
        return principal / tenureMonths;
    }
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
        (Math.pow(1 + monthlyRate, tenureMonths) - 1);
};

// Value of a fixed monthly investment (SIP) after `months`, compounded monthly.
const calculateFutureValue = (monthlyInvestment: number, annualReturn: number, months: number): number => {
    if (months <= 0) return 0;
    const monthlyRate = annualReturn / (12 * 100);
    if (monthlyRate === 0) {
        return monthlyInvestment * months;
    }
    return monthlyInvestment * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
};

// Principal still owed on a loan after `monthsPaid` EMIs.
const calculateOutstandingBalance = (principal: number, rate: number, emi: number, monthsPaid: number): number => {
    const monthlyRate = rate / (12 * 100);
    if (monthlyRate === 0) {
        return Math.max(principal - emi * monthsPaid, 0);
    }
    const growth = Math.pow(1 + monthlyRate, monthsPaid);
    return Math.max(principal * growth - emi * (growth - 1) / monthlyRate, 0);
};

const formatCurrency = (amount: number): string => {
    if (!isFinite(amount)) return "—";
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};

// Short, easy-to-read form: ₹27.5 lakh, ₹1.2 crore.
const formatShort = (amount: number): string => {
    if (!isFinite(amount)) return "—";
    const abs = Math.abs(amount);
    const sign = amount < 0 ? "-" : "";
    const trim = (n: number) => String(parseFloat(n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)));
    if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)} crore`;
    if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)} lakh`;
    return formatCurrency(amount);
};

const years = (n: number) => `${n} ${n === 1 ? "year" : "years"}`;

// Type Definitions
interface LoanDetails {
    tenureYears: number;
    emi: number;
    totalPayment: number;
    totalInterest: number;
}

interface Scenario {
    annualReturn: number;
    totalInvested: number;
    investmentValue: number;
    loanBalance: number;
    netBenefit: number;
}

interface ComparisonData {
    shortLoan: LoanDetails;
    longLoan: LoanDetails;
    emiDifference: number;
    extraInterestCost: number;
    loanBalanceAtShortEnd: number;
    scenarios: Scenario[];
    userScenario: Scenario;
    swapped: boolean;
}

const buildLoan = (principal: number, rate: number, tenureYears: number): LoanDetails => {
    const emi = calculateEMI(principal, rate, tenureYears * 12);
    const totalPayment = emi * tenureYears * 12;
    return { tenureYears, emi, totalPayment, totalInterest: totalPayment - principal };
};

const compare = (
    loanAmountLakhs: string,
    interestRateStr: string,
    tenure1Str: string,
    tenure2Str: string,
    expectedReturnStr: string
): ComparisonData | null | "same-tenure" => {
    const principal = parseFloat(loanAmountLakhs) * 100000;
    const rate = parseFloat(interestRateStr);
    let shortYears = parseInt(tenure1Str, 10);
    let longYears = parseInt(tenure2Str, 10);
    const userReturn = parseFloat(expectedReturnStr);

    if (isNaN(principal) || principal <= 0 ||
        isNaN(rate) || rate < 0 ||
        isNaN(shortYears) || shortYears <= 0 ||
        isNaN(longYears) || longYears <= 0 ||
        isNaN(userReturn) || userReturn < 0) {
        return null;
    }
    if (shortYears === longYears) return "same-tenure";

    const swapped = shortYears > longYears;
    if (swapped) [shortYears, longYears] = [longYears, shortYears];

    const shortLoan = buildLoan(principal, rate, shortYears);
    const longLoan = buildLoan(principal, rate, longYears);
    const emiDifference = shortLoan.emi - longLoan.emi;
    const months = shortYears * 12;
    const loanBalanceAtShortEnd = calculateOutstandingBalance(principal, rate, longLoan.emi, months);

    // Both plans cost the same every month for the first `shortYears` years.
    // At that point Plan A is debt-free with no investments, while Plan B has
    // an investment pot and still owes `loanBalanceAtShortEnd`. The fair
    // comparison is therefore: pot minus remaining loan.
    const scenarioFor = (annualReturn: number): Scenario => {
        const investmentValue = calculateFutureValue(emiDifference, annualReturn, months);
        return {
            annualReturn,
            totalInvested: emiDifference * months,
            investmentValue,
            loanBalance: loanBalanceAtShortEnd,
            netBenefit: investmentValue - loanBalanceAtShortEnd
        };
    };

    const returns = Array.from(new Set([6, 8, 10, 12, 14, userReturn])).sort((a, b) => a - b);

    return {
        shortLoan,
        longLoan,
        emiDifference,
        extraInterestCost: longLoan.totalInterest - shortLoan.totalInterest,
        loanBalanceAtShortEnd,
        scenarios: returns.map(scenarioFor),
        userScenario: scenarioFor(userReturn),
        swapped
    };
};

interface FieldProps {
    id: string;
    label: string;
    hint: React.ReactNode;
    value: string;
    onChange: (v: string) => void;
    unit: string;
    step: string;
    min?: string;
}

const Field: React.FC<FieldProps> = ({ id, label, hint, value, onChange, unit, step, min = "0" }) => (
    <div className="field">
        <label htmlFor={id}>{label}</label>
        <div className="input-wrap">
            <input
                type="number"
                inputMode="decimal"
                id={id}
                value={value}
                min={min}
                step={step}
                onChange={(e) => onChange(e.target.value)}
                aria-describedby={`${id}-hint`}
            />
            <span className="unit">{unit}</span>
        </div>
        <p className="hint" id={`${id}-hint`}>{hint}</p>
    </div>
);

const LoanTermComparisonCalculator: React.FC = () => {
    const [loanAmount, setLoanAmount] = useState<string>("45");
    const [interestRate, setInterestRate] = useState<string>("9");
    const [tenure1, setTenure1] = useState<string>("5");
    const [tenure2, setTenure2] = useState<string>("10");
    const [expectedReturn, setExpectedReturn] = useState<string>("12");

    const results = useMemo(
        () => compare(loanAmount, interestRate, tenure1, tenure2, expectedReturn),
        [loanAmount, interestRate, tenure1, tenure2, expectedReturn]
    );

    const principal = parseFloat(loanAmount) * 100000;
    const rate = parseFloat(interestRate);

    return (
        <div className="page">
            <header className="hero">
                <p className="eyebrow">Loan vs. Investment Calculator</p>
                <h1>Should you repay your loan fast, or stretch it out and invest the rest?</h1>
                <p className="lede">
                    A longer loan means a smaller EMI, but more interest. If you invest the money
                    you save every month, could that investment grow enough to make up for it?
                    Enter your numbers below to find out.
                </p>
            </header>

            <section className="card inputs" aria-labelledby="inputs-title">
                <div className="card-head">
                    <h2 id="inputs-title">Your loan details</h2>
                    <span className="live-note">Results update as you type</span>
                </div>
                <div className="fields">
                    <Field
                        id="loanAmount"
                        label="How much are you borrowing?"
                        unit="lakh ₹"
                        step="0.5"
                        value={loanAmount}
                        onChange={setLoanAmount}
                        hint={principal > 0 ? `That's ${formatCurrency(principal)}` : "1 lakh = ₹1,00,000"}
                    />
                    <Field
                        id="interestRate"
                        label="Loan interest rate"
                        unit="% a year"
                        step="0.1"
                        value={interestRate}
                        onChange={setInterestRate}
                        hint="The yearly rate your bank charges"
                    />
                    <Field
                        id="tenure1"
                        label="Shorter loan period"
                        unit="years"
                        step="1"
                        min="1"
                        value={tenure1}
                        onChange={setTenure1}
                        hint="Higher EMI, paid off sooner"
                    />
                    <Field
                        id="tenure2"
                        label="Longer loan period"
                        unit="years"
                        step="1"
                        min="1"
                        value={tenure2}
                        onChange={setTenure2}
                        hint="Lower EMI, more interest overall"
                    />
                    <Field
                        id="expectedReturn"
                        label="Return you expect from investing"
                        unit="% a year"
                        step="0.5"
                        value={expectedReturn}
                        onChange={setExpectedReturn}
                        hint="E.g. from a mutual fund SIP. Returns aren't guaranteed, so a cautious guess is safer."
                    />
                </div>
            </section>

            {results === null && (
                <div className="notice" role="status">
                    Please fill in every field with a number above zero to see the comparison.
                </div>
            )}

            {results === "same-tenure" && (
                <div className="notice" role="status">
                    Both loan periods are the same, so there's nothing to compare. Make one of them longer.
                </div>
            )}

            {results && typeof results === "object" && (
                <Results results={results} rate={rate} />
            )}
        </div>
    );
};

const Results: React.FC<{ results: ComparisonData; rate: number }> = ({ results, rate }) => {
    const { shortLoan, longLoan, emiDifference, extraInterestCost, loanBalanceAtShortEnd, userScenario, scenarios, swapped } = results;
    const shortY = shortLoan.tenureYears;
    const longY = longLoan.tenureYears;
    const planBWins = userScenario.netBenefit > 0;
    const isTie = Math.abs(userScenario.netBenefit) < 1000;
    const barMax = Math.max(userScenario.investmentValue, loanBalanceAtShortEnd, 1);

    return (
        <>
            {swapped && (
                <div className="notice subtle" role="status">
                    Your "shorter" period was longer than your "longer" one, so we swapped them for you.
                </div>
            )}

            <section aria-labelledby="plans-title">
                <h2 id="plans-title" className="section-title">Your two options</h2>
                <div className="plans">
                    <article className="card plan plan-a">
                        <span className="tag">Plan A</span>
                        <h3>Pay it off in {years(shortY)}</h3>
                        <p className="plan-sub">Take the shorter loan and don't invest anything extra.</p>
                        <dl>
                            <div className="row big"><dt>Monthly EMI</dt><dd>{formatCurrency(shortLoan.emi)}</dd></div>
                            <div className="row"><dt>Interest you'll pay</dt><dd>{formatCurrency(shortLoan.totalInterest)}</dd></div>
                            <div className="row"><dt>Total you'll repay</dt><dd>{formatCurrency(shortLoan.totalPayment)}</dd></div>
                        </dl>
                    </article>

                    <article className="card plan plan-b">
                        <span className="tag">Plan B</span>
                        <h3>Stretch to {years(longY)} and invest</h3>
                        <p className="plan-sub">
                            Take the longer loan and invest the {formatCurrency(emiDifference)} you save each month for the first {years(shortY)}.
                        </p>
                        <dl>
                            <div className="row big"><dt>Monthly EMI</dt><dd>{formatCurrency(longLoan.emi)}</dd></div>
                            <div className="row"><dt>Interest you'll pay</dt><dd>{formatCurrency(longLoan.totalInterest)}</dd></div>
                            <div className="row"><dt>Total you'll repay</dt><dd>{formatCurrency(longLoan.totalPayment)}</dd></div>
                        </dl>
                    </article>
                </div>

                <div className="facts">
                    <div className="fact">
                        <span className="fact-label">Plan B's lower EMI frees up</span>
                        <span className="fact-value">{formatCurrency(emiDifference)}<small>/month</small></span>
                    </div>
                    <div className="fact">
                        <span className="fact-label">But Plan B costs extra interest of</span>
                        <span className="fact-value negative">{formatShort(extraInterestCost)}</span>
                    </div>
                </div>
            </section>

            <section className={`card verdict ${isTie ? "tie" : planBWins ? "win" : "lose"}`} aria-labelledby="verdict-title">
                <p className="eyebrow">At your expected return of {userScenario.annualReturn}% a year</p>
                <h2 id="verdict-title">
                    {isTie
                        ? "It's roughly a tie: both plans leave you in the same place."
                        : planBWins
                            ? `Plan B puts you about ${formatShort(userScenario.netBenefit)} ahead after ${years(shortY)}.`
                            : `Plan A is better: Plan B would leave you ${formatShort(-userScenario.netBenefit)} worse off.`}
                </h2>

                <p className="verdict-explain">
                    Both plans cost you the same {formatCurrency(shortLoan.emi)} every month for {years(shortY)}.
                    After that, with <strong>Plan A</strong> your loan is fully paid off.
                    With <strong>Plan B</strong> you'd have investments worth <strong>{formatShort(userScenario.investmentValue)}</strong>,
                    but you'd still owe <strong>{formatShort(loanBalanceAtShortEnd)}</strong> on the loan.
                </p>

                <div className="bars" aria-hidden="true">
                    <div className="bar-row">
                        <span className="bar-label">Your investments</span>
                        <div className="bar-track"><div className="bar invest" style={{ width: `${(userScenario.investmentValue / barMax) * 100}%` }} /></div>
                        <span className="bar-value">{formatShort(userScenario.investmentValue)}</span>
                    </div>
                    <div className="bar-row">
                        <span className="bar-label">Loan still owed</span>
                        <div className="bar-track"><div className="bar owed" style={{ width: `${(loanBalanceAtShortEnd / barMax) * 100}%` }} /></div>
                        <span className="bar-value">{formatShort(loanBalanceAtShortEnd)}</span>
                    </div>
                </div>

                <p className="verdict-explain">
                    {isTie
                        ? "Selling your investments would roughly clear the loan exactly, so you'd end up where Plan A leaves you."
                        : planBWins
                            ? `If you sold your investments and cleared the loan, you'd be debt-free, just like Plan A, with about ${formatShort(userScenario.netBenefit)} left over.`
                            : `Even after selling all your investments, you'd still owe about ${formatShort(-userScenario.netBenefit)} more than someone who chose Plan A.`}
                </p>

                <div className="rule-of-thumb">
                    <strong>The simple rule:</strong> Plan B only wins if your investments earn <em>more than {rate}% a year</em> (your loan's
                    interest rate) <em>after</em> taxes and fees.
                </div>
            </section>

            <section className="card" aria-labelledby="scenarios-title">
                <h2 id="scenarios-title">What if returns are different?</h2>
                <p className="section-sub">
                    Where you'd stand after {years(shortY)} with Plan B, depending on how your investments actually do.
                    You'd have put in {formatShort(userScenario.totalInvested)} in total.
                </p>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">Yearly return</th>
                                <th scope="col">Investments worth</th>
                                <th scope="col">Loan still owed</th>
                                <th scope="col">Plan B vs Plan A</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scenarios.map((s) => {
                                const tie = Math.abs(s.netBenefit) < 1000;
                                const mine = s.annualReturn === userScenario.annualReturn;
                                return (
                                    <tr key={s.annualReturn} className={mine ? "mine" : undefined}>
                                        <td>
                                            {s.annualReturn}%
                                            {mine && <span className="pill">your guess</span>}
                                        </td>
                                        <td>{formatShort(s.investmentValue)}</td>
                                        <td>{formatShort(s.loanBalance)}</td>
                                        <td className={tie ? "" : s.netBenefit > 0 ? "positive" : "negative"}>
                                            {tie ? "About the same" : s.netBenefit > 0
                                                ? `${formatShort(s.netBenefit)} better`
                                                : `${formatShort(-s.netBenefit)} worse`}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="card caveats" aria-labelledby="caveats-title">
                <h2 id="caveats-title">Before you decide</h2>
                <ul>
                    <li><strong>Investments can go down.</strong> Markets don't grow smoothly. A bad year near the end can wipe out gains, while your loan interest is certain.</li>
                    <li><strong>Taxes matter.</strong> Investment gains may be taxed, and some loans (like home loans) give you tax deductions on interest. Both change the break-even rate.</li>
                    <li><strong>It needs discipline.</strong> Plan B only works if you actually invest the difference every month and don't spend it.</li>
                    <li><strong>Flexibility has value.</strong> A lower EMI gives you breathing room if your income drops. Many loans also let you prepay later.</li>
                </ul>
                <p className="disclaimer">
                    This is an estimate based on the numbers you entered, not financial advice. For a big decision, talk to a qualified financial advisor.
                </p>
            </section>
        </>
    );
};

export default LoanTermComparisonCalculator;
