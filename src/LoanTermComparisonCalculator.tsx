import React, { useMemo, useState } from 'react';
import { LineChart, StackedBars, Legend } from './charts';

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

// Compact axis label: ₹25L, ₹1.2Cr.
const formatAxis = (amount: number): string => {
    if (amount === 0) return "₹0";
    if (amount >= 1e7) return `₹${parseFloat((amount / 1e7).toFixed(2))}Cr`;
    if (amount >= 1e5) return `₹${parseFloat((amount / 1e5).toFixed(1))}L`;
    return `₹${Math.round(amount / 1000)}K`;
};

const years = (n: number) => `${n} ${n === 1 ? "year" : "years"}`;

const monthLabel = (i: number) => {
    const y = Math.floor(i / 12);
    const mo = i % 12;
    if (i === 0) return "Today";
    if (mo === 0) return `Year ${y}`;
    return y === 0 ? `Month ${mo}` : `Year ${y}, month ${mo}`;
};

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
    principal: number;
    rate: number;
    shortLoan: LoanDetails;
    longLoan: LoanDetails;
    emiDifference: number;
    extraInterestCost: number;
    loanBalanceAtShortEnd: number;
    scenarios: Scenario[];
    userScenario: Scenario;
    timeline: { invested: number[]; owed: number[] };
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
        isNaN(shortYears) || shortYears <= 0 || shortYears > 50 ||
        isNaN(longYears) || longYears <= 0 || longYears > 50 ||
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

    const invested: number[] = [];
    const owed: number[] = [];
    for (let i = 0; i <= months; i++) {
        invested.push(calculateFutureValue(emiDifference, userReturn, i));
        owed.push(calculateOutstandingBalance(principal, rate, longLoan.emi, i));
    }

    return {
        principal,
        rate,
        shortLoan,
        longLoan,
        emiDifference,
        extraInterestCost: longLoan.totalInterest - shortLoan.totalInterest,
        loanBalanceAtShortEnd,
        scenarios: returns.map(scenarioFor),
        userScenario: scenarioFor(userReturn),
        timeline: { invested, owed },
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
    step: number;
    min: number;
    max: number;
}

const Field: React.FC<FieldProps> = ({ id, label, hint, value, onChange, unit, step, min, max }) => {
    const num = parseFloat(value);
    const pct = isNaN(num) ? 0 : Math.min(100, Math.max(0, ((num - min) / (max - min)) * 100));
    return (
        <div className="field">
            <div className="field-top">
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
            </div>
            <input
                type="range"
                className="slider"
                min={min}
                max={max}
                step={step}
                value={isNaN(num) ? min : Math.min(Math.max(num, min), max)}
                onChange={(e) => onChange(e.target.value)}
                aria-label={label}
                style={{ '--pct': `${pct}%` } as React.CSSProperties}
            />
            <p className="hint" id={`${id}-hint`}>{hint}</p>
        </div>
    );
};

const VerdictIcon: React.FC<{ status: string }> = ({ status }) => (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {status === "win" && <path d="M3 8.5l3.2 3.2L13 5" />}
        {status === "lose" && <><path d="M8 3.5v5.2" /><path d="M8 12h.01" /></>}
        {status === "tie" && <><path d="M3 6.5h10" /><path d="M3 10.5h10" /></>}
    </svg>
);

const DeltaIcon: React.FC<{ up: boolean }> = ({ up }) => (
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className="delta-icon">
        <path d={up ? "M6 2l4.5 7.2h-9z" : "M6 10L1.5 2.8h9z"} fill="currentColor" />
    </svg>
);

const COLORS = {
    invest: '#2a78d6',
    owed: '#eb6834',
    principal: '#c6ccd6',
};

const faqs: { q: string; a: string }[] = [
    {
        q: "Is it better to take a shorter loan or a longer loan and invest the difference?",
        a: "It depends on one number: whether your investments earn more than your loan's interest rate, after tax and fees. If they do, the longer loan plus investing usually leaves you with more money. If they don't, the shorter loan wins, and it's also the lower-risk choice."
    },
    {
        q: "How does this calculator compare the two options?",
        a: "Both options cost you the same amount every month until the shorter loan ends: in Plan B, whatever you save on EMI goes into investments. When the shorter loan ends, Plan A is debt-free. Plan B has an investment pot but still owes part of its loan. The calculator compares that pot with the loan still owed. If the pot is bigger, Plan B wins by the difference."
    },
    {
        q: "What investment return should I assume?",
        a: "Use a realistic, cautious number, and remember to subtract tax and fund fees. Fixed deposits and debt funds typically earn less than most loan rates. Equity mutual funds have historically earned more over long periods, but with large ups and downs and no guarantee."
    },
    {
        q: "Should I prepay my home loan or invest in a SIP?",
        a: "The same logic applies. Prepaying earns you a guaranteed 'return' equal to your loan rate. Investing can earn more, but it's uncertain. Home loans also carry tax benefits on interest in many cases, which lowers the effective loan rate and tilts the decision toward investing."
    },
    {
        q: "What is an EMI?",
        a: "EMI (Equated Monthly Instalment) is the fixed amount you pay your lender every month. Each EMI covers part of the interest and part of the loan amount. A longer loan spreads the loan over more EMIs, so each one is smaller, but you pay interest for longer."
    }
];

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

    return (
        <>
            <header className="topbar">
                <div className="topbar-inner">
                    <a className="brand" href="/">
                        <img src="/favicon.svg" alt="" width={28} height={28} />
                        <span>Loan vs Investment</span>
                    </a>
                    <a className="topbar-link" href="#faq">How it works</a>
                </div>
            </header>

            <main className="page">
                <section className="hero">
                    <h1>Loan vs Investment Calculator</h1>
                    <p className="lede">
                        Should you repay your loan quickly, or take a longer loan with a lower EMI and invest the difference?
                        Enter your numbers to see which option leaves you with more money.
                    </p>
                </section>

                <div className="layout">
                    <aside className="card inputs" aria-labelledby="inputs-title">
                        <h2 id="inputs-title">Your details</h2>
                        <Field
                            id="loanAmount"
                            label="Loan amount"
                            unit="lakh"
                            step={1}
                            min={1}
                            max={200}
                            value={loanAmount}
                            onChange={setLoanAmount}
                            hint={principal > 0 ? `${formatCurrency(principal)}` : "1 lakh = ₹1,00,000"}
                        />
                        <Field
                            id="interestRate"
                            label="Interest rate"
                            unit="% p.a."
                            step={0.1}
                            min={1}
                            max={20}
                            value={interestRate}
                            onChange={setInterestRate}
                            hint="Yearly rate charged by your lender"
                        />
                        <Field
                            id="tenure1"
                            label="Shorter loan period"
                            unit="years"
                            step={1}
                            min={1}
                            max={30}
                            value={tenure1}
                            onChange={setTenure1}
                            hint="Plan A: higher EMI, paid off sooner"
                        />
                        <Field
                            id="tenure2"
                            label="Longer loan period"
                            unit="years"
                            step={1}
                            min={1}
                            max={30}
                            value={tenure2}
                            onChange={setTenure2}
                            hint="Plan B: lower EMI, more interest overall"
                        />
                        <Field
                            id="expectedReturn"
                            label="Expected investment return"
                            unit="% p.a."
                            step={0.5}
                            min={0}
                            max={20}
                            value={expectedReturn}
                            onChange={setExpectedReturn}
                            hint="After tax and fees. Returns are not guaranteed."
                        />
                    </aside>

                    <div className="results">
                        {results === null && (
                            <div className="notice" role="status">
                                Enter a positive number in every field to see the comparison.
                            </div>
                        )}
                        {results === "same-tenure" && (
                            <div className="notice" role="status">
                                Both loan periods are the same, so there's nothing to compare. Make one of them longer.
                            </div>
                        )}
                        {results && typeof results === "object" && <Results results={results} />}
                    </div>
                </div>

                <section className="card faq" id="faq" aria-labelledby="faq-title">
                    <h2 id="faq-title">Frequently asked questions</h2>
                    {faqs.map(f => (
                        <details key={f.q}>
                            <summary>{f.q}</summary>
                            <p>{f.a}</p>
                        </details>
                    ))}
                </section>
            </main>

            <footer className="footer">
                <p>
                    This calculator gives estimates based on the numbers you enter. It is not financial advice.
                    For a major decision, consult a qualified financial advisor.
                </p>
                <p>
                    <a href="https://github.com/codificador21/loan-vs-investment" rel="noopener">Source on GitHub</a>
                </p>
            </footer>
        </>
    );
};

const Results: React.FC<{ results: ComparisonData }> = ({ results }) => {
    const { principal, rate, shortLoan, longLoan, emiDifference, extraInterestCost, loanBalanceAtShortEnd, userScenario, scenarios, timeline, swapped } = results;
    const shortY = shortLoan.tenureYears;
    const longY = longLoan.tenureYears;
    const isTie = Math.abs(userScenario.netBenefit) < 1000;
    const planBWins = !isTie && userScenario.netBenefit > 0;
    const status = isTie ? "tie" : planBWins ? "win" : "lose";
    const months = shortY * 12;
    const yearStep = shortY <= 6 ? 1 : shortY <= 15 ? 2 : 5;
    const xTicks: number[] = [];
    for (let yr = 0; yr <= shortY; yr += yearStep) xTicks.push(yr * 12);
    if (xTicks[xTicks.length - 1] !== months) xTicks.push(months);

    return (
        <>
            {swapped && (
                <div className="notice info" role="status">
                    Your shorter period was longer than your longer period, so the two have been swapped.
                </div>
            )}

            <section className={`card verdict ${status}`} aria-labelledby="verdict-title" aria-live="polite">
                <div className="verdict-badge">
                    <span className="verdict-icon" aria-hidden="true"><VerdictIcon status={status} /></span>
                    {isTie ? "Roughly equal" : planBWins ? "Plan B is better" : "Plan A is better"}
                </div>
                <h2 id="verdict-title">
                    {isTie ? (
                        <>Both plans end up about the same</>
                    ) : planBWins ? (
                        <>Taking the {longY}-year loan and investing puts you <span className="hl">{formatShort(userScenario.netBenefit)}</span> ahead</>
                    ) : (
                        <>Paying off in {years(shortY)} saves you <span className="hl">{formatShort(-userScenario.netBenefit)}</span></>
                    )}
                </h2>
                <p className="verdict-text">
                    At a {userScenario.annualReturn}% return, after {years(shortY)} Plan B's investments are worth <strong>{formatShort(userScenario.investmentValue)}</strong> while
                    its loan still has <strong>{formatShort(loanBalanceAtShortEnd)}</strong> left to repay. Plan A is debt-free by then.
                    {planBWins && ` Selling the investments clears Plan B's loan with ${formatShort(userScenario.netBenefit)} to spare.`}
                    {!planBWins && !isTie && ` Even after selling every investment, Plan B still owes ${formatShort(-userScenario.netBenefit)}.`}
                </p>
                <div className="breakeven">
                    <span className="breakeven-label">Break-even return</span>
                    <span className="breakeven-value">{parseFloat(rate.toFixed(2))}% a year</span>
                    <span className="breakeven-note">Plan B only wins if your investments beat your loan rate after tax and fees.</span>
                </div>
            </section>

            <section className="stats" aria-label="Key numbers">
                <div className="stat accent-blue">
                    <span className="stat-label">EMI saved with Plan B</span>
                    <span className="stat-value">{formatCurrency(emiDifference)}<small>/mo</small></span>
                    <span className="stat-note">to invest for {years(shortY)}</span>
                </div>
                <div className="stat accent-orange">
                    <span className="stat-label">Extra interest in Plan B</span>
                    <span className="stat-value">{formatShort(extraInterestCost)}</span>
                    <span className="stat-note">over the full {years(longY)}</span>
                </div>
                <div className="stat accent-teal">
                    <span className="stat-label">Plan B's investments</span>
                    <span className="stat-value">{formatShort(userScenario.investmentValue)}</span>
                    <span className="stat-note">after {years(shortY)} at {userScenario.annualReturn}%</span>
                </div>
            </section>

            <section className="card" aria-labelledby="compare-title">
                <h2 id="compare-title">The two options side by side</h2>
                <div className="table-wrap">
                    <table className="compare">
                        <thead>
                            <tr>
                                <th scope="col"><span className="sr-only">Measure</span></th>
                                <th scope="col" className="col-a">
                                    <span className="plan-tag a">Plan A</span>
                                    <span className="plan-name">Repay in {years(shortY)}</span>
                                </th>
                                <th scope="col" className="col-b">
                                    <span className="plan-tag b">Plan B</span>
                                    <span className="plan-name">Repay in {years(longY)} + invest</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <th scope="row">Monthly EMI</th>
                                <td className="strong">{formatCurrency(shortLoan.emi)}</td>
                                <td className="strong">{formatCurrency(longLoan.emi)}</td>
                            </tr>
                            <tr>
                                <th scope="row">Invested every month</th>
                                <td>—</td>
                                <td>{formatCurrency(emiDifference)} for {years(shortY)}</td>
                            </tr>
                            <tr>
                                <th scope="row">Total interest paid</th>
                                <td>{formatCurrency(shortLoan.totalInterest)}</td>
                                <td>{formatCurrency(longLoan.totalInterest)}</td>
                            </tr>
                            <tr>
                                <th scope="row">Total repaid to lender</th>
                                <td>{formatCurrency(shortLoan.totalPayment)}</td>
                                <td>{formatCurrency(longLoan.totalPayment)}</td>
                            </tr>
                            <tr className="total">
                                <th scope="row">Position after {years(shortY)}</th>
                                <td>Debt-free</td>
                                <td>
                                    {formatShort(userScenario.investmentValue)} invested, {formatShort(loanBalanceAtShortEnd)} still owed
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="card" aria-labelledby="race-title">
                <h2 id="race-title">Plan B: investments vs. loan still owed</h2>
                <p className="section-sub">
                    How Plan B's investments grow while its loan shrinks, at {userScenario.annualReturn}% a year.
                    {planBWins
                        ? " The investments end up bigger than the loan, so they could pay it off."
                        : " The investments don't catch up with the loan in time."}
                </p>
                <Legend items={[
                    { name: "Investments", color: COLORS.invest, shape: 'line' },
                    { name: "Loan still owed", color: COLORS.owed, shape: 'line' },
                ]} />
                <LineChart
                    series={[
                        { name: "Investments", color: COLORS.invest, values: timeline.invested, area: true },
                        { name: "Loan still owed", color: COLORS.owed, values: timeline.owed },
                    ]}
                    xTicks={xTicks}
                    xLabel={monthLabel}
                    format={formatShort}
                    formatAxis={formatAxis}
                    ariaLabel={`Line chart. Over ${years(shortY)}, Plan B's investments grow to ${formatShort(userScenario.investmentValue)} while its loan falls from ${formatShort(principal)} to ${formatShort(loanBalanceAtShortEnd)}.`}
                />
            </section>

            <section className="card" aria-labelledby="cost-title">
                <h2 id="cost-title">Total repaid to the lender</h2>
                <p className="section-sub">
                    Plan B pays <strong>{formatShort(extraInterestCost)}</strong> more in interest. Its investments have to earn more than that for it to come out ahead.
                </p>
                <Legend items={[
                    { name: "Loan amount", color: COLORS.principal, shape: 'rect' },
                    { name: "Interest", color: COLORS.owed, shape: 'rect' },
                ]} />
                <StackedBars
                    segments={[
                        { name: "Loan amount", color: COLORS.principal },
                        { name: "Interest", color: COLORS.owed },
                    ]}
                    rows={[
                        { label: `Plan A · ${shortY} yrs`, values: [principal, shortLoan.totalInterest] },
                        { label: `Plan B · ${longY} yrs`, values: [principal, longLoan.totalInterest] },
                    ]}
                    format={formatShort}
                    ariaLabel={`Bar chart. Plan A repays ${formatShort(shortLoan.totalPayment)} including ${formatShort(shortLoan.totalInterest)} interest. Plan B repays ${formatShort(longLoan.totalPayment)} including ${formatShort(longLoan.totalInterest)} interest.`}
                />
            </section>

            <section className="card" aria-labelledby="scenarios-title">
                <h2 id="scenarios-title">What if returns are different?</h2>
                <p className="section-sub">
                    Plan B's position after {years(shortY)} at different yearly returns. You would invest {formatShort(userScenario.totalInvested)} in total, and {formatShort(loanBalanceAtShortEnd)} of the loan would still be owed.
                </p>
                <div className="table-wrap">
                    <table className="scenarios">
                        <thead>
                            <tr>
                                <th scope="col">Return</th>
                                <th scope="col">Investments</th>
                                <th scope="col" className="col-owed">Loan owed</th>
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
                                            {mine && <span className="pill">Your estimate</span>}
                                        </td>
                                        <td>{formatShort(s.investmentValue)}</td>
                                        <td className="col-owed">{formatShort(s.loanBalance)}</td>
                                        <td>
                                            {tie ? (
                                                <span className="delta neutral">About equal</span>
                                            ) : s.netBenefit > 0 ? (
                                                <span className="delta up"><DeltaIcon up /> {formatShort(s.netBenefit)} better</span>
                                            ) : (
                                                <span className="delta down"><DeltaIcon up={false} /> {formatShort(-s.netBenefit)} worse</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="card caveats" aria-labelledby="caveats-title">
                <h2 id="caveats-title">Things to consider</h2>
                <ul>
                    <li><strong>Market risk.</strong> Investments rise and fall. Your loan interest is certain; your returns are not.</li>
                    <li><strong>Tax.</strong> Investment gains may be taxed, and some loans (such as home loans) offer tax benefits on interest.</li>
                    <li><strong>Discipline.</strong> Plan B only works if you invest the EMI difference every month without fail.</li>
                    <li><strong>Flexibility.</strong> A lower EMI gives breathing room if your income changes, and many loans allow prepayment later.</li>
                </ul>
            </section>
        </>
    );
};

export default LoanTermComparisonCalculator;
