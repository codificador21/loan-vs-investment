import React, { useState, useEffect, useCallback } from 'react';

// Helper Functions (no changes from your provided code)
const calculateEMI = (principal: number, rate: number, tenureMonths: number): number => {
    if (tenureMonths <= 0) return principal > 0 ? Infinity : 0; // Handle invalid tenure
    const monthlyRate = rate / (12 * 100);
    if (monthlyRate === 0) {
        return principal / tenureMonths;
    }
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
                (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    return emi;
};

const calculateFutureValue = (monthlyInvestment: number, cagr: number, years: number): number => {
    if (years <= 0) return 0;
    const monthlyRate = cagr / (12 * 100);
    const months = years * 12;
    if (monthlyRate === 0) {
        return monthlyInvestment * months;
    }
    const fv = monthlyInvestment * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
    return fv;
};

const formatCurrency = (amount: number): string => {
    if (amount === Infinity) return "N/A (check inputs)";
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};

// Type Definitions
interface LoanDetails {
    tenureYears: number;
    emi: number;
    totalPayment: number;
    totalInterest: number;
}

interface InvestmentResult {
    cagr: number;
    futureValueShortTerm: number; // Investment over the shorter loan tenure
    futureValueLongTerm?: number; // Investment over the longer loan tenure (if applicable)
    netBenefit: number; // Net benefit of choosing longer loan and investing EMI diff for shorter tenure duration
}

interface ComparisonData {
    loan1: LoanDetails; // Represents the shorter tenure loan
    loan2: LoanDetails; // Represents the longer tenure loan
    emiDifference: number;
    extraInterestCost: number; // Extra interest for loan2 vs loan1
    investmentResults: InvestmentResult[];
    shorterTenure: number;
    longerTenure: number;
}

const LoanTermComparisonCalculator: React.FC = () => {
    const [loanAmount, setLoanAmount] = useState<string>("45"); // Lakhs
    const [interestRate, setInterestRate] = useState<string>("9"); // % per annum
    const [tenure1, setTenure1] = useState<string>("5"); // Years for first loan option
    const [tenure2, setTenure2] = useState<string>("10"); // Years for second loan option
    const [expectedCagr, setExpectedCagr] = useState<string>("12"); // User's expected CAGR

    const [results, setResults] = useState<ComparisonData | null>(null);

    const calculateComparison = useCallback(() => {
        const currentLoanAmount = parseFloat(loanAmount) * 100000;
        const currentInterestRate = parseFloat(interestRate);
        let tenure1Years = parseInt(tenure1, 10);
        let tenure2Years = parseInt(tenure2, 10);
        const userCagr = parseFloat(expectedCagr);

        if (isNaN(currentLoanAmount) || currentLoanAmount <= 0 ||
            isNaN(currentInterestRate) || currentInterestRate < 0 ||
            isNaN(tenure1Years) || tenure1Years <= 0 ||
            isNaN(tenure2Years) || tenure2Years <= 0 ||
            isNaN(userCagr) || userCagr < 0) {
            setResults(null);
            return;
        }

        // Ensure tenure1 is shorter or equal to tenure2 for consistent comparison logic
        if (tenure1Years > tenure2Years) {
            [tenure1Years, tenure2Years] = [tenure2Years, tenure1Years]; // Swap them
        }


        // Loan 1 (Shorter Tenure)
        const tenure1Months = tenure1Years * 12;
        const emi1 = calculateEMI(currentLoanAmount, currentInterestRate, tenure1Months);
        const totalPayment1 = emi1 * tenure1Months;
        const totalInterest1 = totalPayment1 - currentLoanAmount;
        const loan1Details: LoanDetails = { tenureYears: tenure1Years, emi: emi1, totalPayment: totalPayment1, totalInterest: totalInterest1 };

        // Loan 2 (Longer Tenure)
        const tenure2Months = tenure2Years * 12;
        const emi2 = calculateEMI(currentLoanAmount, currentInterestRate, tenure2Months);
        const totalPayment2 = emi2 * tenure2Months;
        const totalInterest2 = totalPayment2 - currentLoanAmount;
        const loan2Details: LoanDetails = { tenureYears: tenure2Years, emi: emi2, totalPayment: totalPayment2, totalInterest: totalInterest2 };

        const emiDifference = emi1 - emi2; // Positive if EMI1 > EMI2 (expected if tenure1 < tenure2)
        const extraInterestCost = totalInterest2 - totalInterest1; // Extra interest paid for longer tenure loan

        const cagrs = [10, 11, 12];
        if (!cagrs.includes(userCagr)) { // Add user's CAGR if not already present, and sort
            cagrs.push(userCagr);
            cagrs.sort((a, b) => a - b);
        }
        
        const uniqueCagrs = Array.from(new Set(cagrs)); // Ensure unique values


        const investmentResults: InvestmentResult[] = uniqueCagrs.map(cagr => {
            // Investment happens for the duration of the shorter loan (tenure1Years)
            // using the EMI difference obtained by opting for the longer loan.
            const futureValueShortTerm = calculateFutureValue(emiDifference, cagr, tenure1Years);
            
            // Net benefit: Investment gain over shorter tenure vs extra interest cost of longer loan
            const netBenefit = futureValueShortTerm - extraInterestCost;

            let futureValueLongTerm: number | undefined = undefined;
            if (tenure1Years < tenure2Years) {
                 // Optionally, calculate FV if EMI difference was invested for the full longer tenure.
                 // This is just for informational purposes, primary comparison uses futureValueShortTerm.
                 futureValueLongTerm = calculateFutureValue(emiDifference, cagr, tenure2Years);
            }


            return {
                cagr,
                futureValueShortTerm,
                futureValueLongTerm,
                netBenefit
            };
        });

        setResults({
            loan1: loan1Details,
            loan2: loan2Details,
            emiDifference,
            extraInterestCost,
            investmentResults,
            shorterTenure: tenure1Years,
            longerTenure: tenure2Years,
        });
    }, [loanAmount, interestRate, tenure1, tenure2, expectedCagr]);

    useEffect(() => {
        calculateComparison();
    }, [calculateComparison]);

    return (
        <div className="container">
            <h1>💰 Loan Term Comparison Calculator</h1>

            <div className="input-section">
                <div className="input-group">
                    <div className="form-group">
                        <label htmlFor="loanAmount">Loan Amount (₹ Lakhs)</label>
                        <input type="number" id="loanAmount" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} step="0.1" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="interestRate">Interest Rate (% p.a.)</label>
                        <input type="number" id="interestRate" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} step="0.1" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="tenure1">Loan Tenure 1 (Years)</label>
                        <input type="number" id="tenure1" value={tenure1} onChange={(e) => setTenure1(e.target.value)} step="1" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="tenure2">Loan Tenure 2 (Years)</label>
                        <input type="number" id="tenure2" value={tenure2} onChange={(e) => setTenure2(e.target.value)} step="1" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="expectedCagr">Expected Investment CAGR (%)</label>
                        <input type="number" id="expectedCagr" value={expectedCagr} onChange={(e) => setExpectedCagr(e.target.value)} step="0.1" />
                    </div>
                </div>
                <button className="calculate-btn" onClick={calculateComparison}>
                    Calculate Comparison
                </button>
            </div>

            {results && results.emiDifference >=0 && ( // Only show results if valid and EMI diff is sensible
                <div id="results" className="results">
                    <div className="loan-option">
                        <h3>🚀 Loan Option 1 ({results.loan1.tenureYears} Years)</h3>
                        <div className="metric"><span className="metric-label">Monthly EMI</span><span className="metric-value">{formatCurrency(results.loan1.emi)}</span></div>
                        <div className="metric"><span className="metric-label">Total Payment</span><span className="metric-value">{formatCurrency(results.loan1.totalPayment)}</span></div>
                        <div className="metric"><span className="metric-label">Total Interest</span><span className="metric-value">{formatCurrency(results.loan1.totalInterest)}</span></div>
                    </div>

                    <div className="loan-option">
                        <h3>🐌 Loan Option 2 ({results.loan2.tenureYears} Years)</h3>
                        <div className="metric"><span className="metric-label">Monthly EMI</span><span className="metric-value">{formatCurrency(results.loan2.emi)}</span></div>
                        <div className="metric"><span className="metric-label">Total Payment</span><span className="metric-value">{formatCurrency(results.loan2.totalPayment)}</span></div>
                        <div className="metric"><span className="metric-label">Total Interest</span><span className="metric-value">{formatCurrency(results.loan2.totalInterest)}</span></div>
                    </div>

                    <div className="investment-analysis">
                        <h3>📈 Investment Analysis of EMI Difference</h3>
                        <div className="highlight">
                            <strong>EMI Difference (Opting for {results.longerTenure}yr loan over {results.shorterTenure}yr loan saves):</strong> {formatCurrency(results.emiDifference)}/month<br />
                            <strong>Extra Interest Cost (for taking {results.longerTenure}yr loan vs {results.shorterTenure}yr loan):</strong> {formatCurrency(results.extraInterestCost)}<br />
                            <strong>Analysis:</strong> If you choose the longer {results.longerTenure}-year loan, your EMI is lower. Can investing this monthly EMI difference for {results.shorterTenure} years (the duration of the shorter loan) generate returns that offset the extra interest paid for the {results.longerTenure}-year loan?
                        </div>

                        <div className="cagr-analysis">
                            {results.investmentResults.map((result, index) => (
                                <div key={index} className="cagr-scenario">
                                    <h4>CAGR: {result.cagr}% {result.cagr === parseFloat(expectedCagr) && "(Your Expectation)"}</h4>
                                    <div className="metric">
                                        <span className="metric-label">Investment Value (after {results.shorterTenure} years)</span>
                                        <span className="metric-value">{formatCurrency(result.futureValueShortTerm)}</span>
                                    </div>
                                    {result.futureValueLongTerm !== undefined && results.shorterTenure !== results.longerTenure && (
                                      <div className="metric">
                                          <span className="metric-label">Difference in interest rates</span>
                                          <span className="metric-value">{formatCurrency(results.extraInterestCost)}</span>
                                      </div>
                                    )}
                                    <div className="metric">
                                        <span className="metric-label">Net Benefit (Inv. Gain after {results.shorterTenure} yrs - Extra Interest Cost of {results.longerTenure}yr loan)</span>
                                        <span className="metric-value" style={{ color: result.netBenefit > 0 ? '#28a745' : '#dc3545' }}>
                                            {formatCurrency(result.netBenefit)}
                                        </span>
                                    </div>
                                    <div className="metric">
                                        <span className="metric-label">Break-even ({results.shorterTenure}yr Investment vs Extra Interest)</span>
                                        <span className="metric-value" style={{ color: result.futureValueShortTerm > results.extraInterestCost ? '#28a745' : '#dc3545' }}>
                                            {result.futureValueShortTerm > results.extraInterestCost ? 'Investment Wins ✅' : 'Extra Interest Costs More ❌'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="recommendation">
                        <h3>💡 Recommendation Analysis</h3>
                        <p>
                            <strong>The Question:</strong> You pay an extra {formatCurrency(results.extraInterestCost)} in interest if you opt for the {results.longerTenure}-year loan instead of the {results.shorterTenure}-year loan.
                            However, the {results.longerTenure}-year loan has a lower EMI, giving you an EMI difference of {formatCurrency(results.emiDifference)} per month.
                            Is it better to take the {results.longerTenure}-year loan and invest this EMI difference for the first {results.shorterTenure} years?
                        </p>
                        <p>
                            <strong>Answer based on investing the EMI difference for {results.shorterTenure} years:</strong>{' '}
                            {results.investmentResults.some(r => r.netBenefit > 0)
                                ? (results.investmentResults.every(r => r.netBenefit > 0)
                                    ? 'Investing the EMI difference appears consistently beneficial across tested CAGRs!'
                                    : 'Investing the EMI difference can be beneficial, especially at higher CAGRs. Consider your expected investment return and risk tolerance.')
                                : 'Across the tested CAGRs, the gains from investing the EMI difference for {results.shorterTenure} years do not typically offset the extra interest paid for the {results.longerTenure}-year loan. The shorter loan might be more cost-effective.'
                            }
                        </p>
                        <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(255,255,255,0.2)', borderRadius: '10px' }}>
                            {results.investmentResults.map(res => (
                                <p key={res.cagr}>
                                    <strong>At {res.cagr}% CAGR{res.cagr === parseFloat(expectedCagr) && " (Your Exp.)"}:</strong> Net financial position after {results.shorterTenure} years is {formatCurrency(res.netBenefit)}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            )}
             {results && results.emiDifference < 0 && (
                <div className="results">
                    <p className="highlight" style={{gridColumn: '1 / -1', textAlign: 'center', padding: '20px', background: '#fff3cd'}}>
                        The first loan tenure ({results.loan1.tenureYears} years) results in a lower or equal EMI than the second tenure ({results.loan2.tenureYears} years).
                        This typically means the first tenure is longer or equal to the second. Please ensure Loan Tenure 1 is shorter than Loan Tenure 2 for the investment analysis to be meaningful in the context of saving on EMI by choosing a longer loan.
                        If tenures are equal, there is no EMI difference to invest.
                        <br/>Current EMI for {results.loan1.tenureYears}yr loan: {formatCurrency(results.loan1.emi)}. Current EMI for {results.loan2.tenureYears}yr loan: {formatCurrency(results.loan2.emi)}.
                    </p>
                </div>
            )}
        </div>
    );
};

export default LoanTermComparisonCalculator;