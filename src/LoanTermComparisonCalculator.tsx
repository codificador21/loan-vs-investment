import React, { useState, useEffect, useCallback } from 'react';

// Helper Functions
const calculateEMI = (principal: number, rate: number, tenureMonths: number): number => {
    if (tenureMonths <= 0) return principal > 0 ? Infinity : 0;
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

const calculateCompoundInterest = (
    principal: number,
    annualRate: number,
    years: number,
    timesCompoundedPerYear: number = 1
): number => {
    if (years <= 0 || annualRate <= 0 || principal <= 0) return principal;
    
    const ratePerPeriod = annualRate / (100 * timesCompoundedPerYear);
    const totalPeriods = years * timesCompoundedPerYear;
    
    const amount = principal * Math.pow(1 + ratePerPeriod, totalPeriods);
    return amount;
};

const formatCurrency = (amount: number): string => {
    if (amount === Infinity) return "N/A (check inputs)";
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};

const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
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
    futureValueShortTerm: number;
    futureValueLongTerm?: number;
    netBenefit: number;
    remainingPayment: number;
    totalInvestmentAmount: number;
    investmentGains: number;
    effectiveInterestSaved: number;
    roiPercentage: number;
}

interface ComparisonData {
    loan1: LoanDetails;
    loan2: LoanDetails;
    emiDifference: number;
    extraInterestCost: number;
    investmentResults: InvestmentResult[];
    shorterTenure: number;
    longerTenure: number;
    remainingPayment: number;
}

const LoanTermComparisonCalculator: React.FC = () => {
    const [loanAmount, setLoanAmount] = useState<string>("45");
    const [interestRate, setInterestRate] = useState<string>("9");
    const [tenure1, setTenure1] = useState<string>("5");
    const [tenure2, setTenure2] = useState<string>("10");
    const [expectedCagr, setExpectedCagr] = useState<string>("12");

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

        if (tenure1Years > tenure2Years) {
            [tenure1Years, tenure2Years] = [tenure2Years, tenure1Years];
        }

        const tenure1Months = tenure1Years * 12;
        const emi1 = calculateEMI(currentLoanAmount, currentInterestRate, tenure1Months);
        const totalPayment1 = emi1 * tenure1Months;
        const totalInterest1 = totalPayment1 - currentLoanAmount;
        const loan1Details: LoanDetails = { tenureYears: tenure1Years, emi: emi1, totalPayment: totalPayment1, totalInterest: totalInterest1 };

        const tenure2Months = tenure2Years * 12;
        const emi2 = calculateEMI(currentLoanAmount, currentInterestRate, tenure2Months);
        const totalPayment2 = emi2 * tenure2Months;
        const totalInterest2 = totalPayment2 - currentLoanAmount;
        const loan2Details: LoanDetails = { tenureYears: tenure2Years, emi: emi2, totalPayment: totalPayment2, totalInterest: totalInterest2 };

        const emiDifference = emi1 - emi2;
        const extraInterestCost = totalInterest2 - totalInterest1;
        const remainingPayment = emi2 * (tenure2Months - tenure1Months);

        const cagrs = [10, 11, 12];
        if (!cagrs.includes(userCagr)) {
            cagrs.push(userCagr);
            cagrs.sort((a, b) => a - b);
        }

        const uniqueCagrs = Array.from(new Set(cagrs));

        const investmentResults: InvestmentResult[] = uniqueCagrs.map(cagr => {
            const futureValueShortTerm = calculateFutureValue(emiDifference, cagr, tenure1Years);
            const totalInvestmentAmount = emiDifference * tenure1Years * 12;
            const investmentGains = futureValueShortTerm - totalInvestmentAmount;
            const effectiveInterestSaved = investmentGains - extraInterestCost;
            const roiPercentage = totalInvestmentAmount > 0 ? (investmentGains / totalInvestmentAmount) * 100 : 0;
            const netBenefit = futureValueShortTerm - extraInterestCost;

            let futureValueLongTerm: number | undefined = undefined;
            if (tenure1Years < tenure2Years) {
                futureValueLongTerm = calculateCompoundInterest(futureValueShortTerm, cagr, tenure2Years - tenure1Years);
            }

            return {
                cagr,
                futureValueShortTerm,
                futureValueLongTerm,
                netBenefit,
                remainingPayment,
                totalInvestmentAmount,
                investmentGains,
                effectiveInterestSaved,
                roiPercentage
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
            remainingPayment
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
                        <label htmlFor="expectedCagr">Expected Annualized Investment Return (for monthly investments) (%)</label>
                        <input type="number" id="expectedCagr" value={expectedCagr} onChange={(e) => setExpectedCagr(e.target.value)} step="0.1" />
                    </div>
                </div>
                <button className="calculate-btn" onClick={calculateComparison}>
                    Calculate Comparison
                </button>
            </div>

            {results && results.emiDifference >= 0 && (
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
                        <h3>📈 Comprehensive Investment Analysis</h3>
                        
                        <div className="highlight">
                            <strong>📊 Key Financial Metrics:</strong><br />
                            <strong>• Monthly EMI Savings:</strong> {formatCurrency(results.emiDifference)} (by choosing {results.longerTenure}-year loan)<br />
                            <strong>• Total Investment Period:</strong> {results.shorterTenure} years ({results.shorterTenure * 12} months)<br />
                            <strong>• Extra Interest Cost:</strong> {formatCurrency(results.extraInterestCost)} (for longer loan)<br />
                            <strong>• Remaining Payments:</strong> {formatCurrency(results.remainingPayment)} (years {results.shorterTenure + 1}-{results.longerTenure})<br /><br />
                            
                            <strong>🎯 Investment Strategy:</strong> By choosing the {results.longerTenure}-year loan, you free up {formatCurrency(results.emiDifference)} monthly. The analysis below shows whether investing this amount for {results.shorterTenure} years can offset the additional {formatCurrency(results.extraInterestCost)} interest cost.
                        </div>

                        <div className="cagr-analysis">
                            {results.investmentResults.map((result: InvestmentResult, index) => (
                                <div key={index} className="cagr-scenario">
                                    <h4>📈 Expected Return: {result.cagr}% {result.cagr === parseFloat(expectedCagr) && "(Your Expectation)"}</h4>
                                    
                                    <div className="metric">
                                        <span className="metric-label">💰 Total Amount Invested</span>
                                        <span className="metric-value">{formatCurrency(result.totalInvestmentAmount)}</span>
                                    </div>
                                    
                                    <div className="metric">
                                        <span className="metric-label">📊 Investment Value (after {results.shorterTenure} years)</span>
                                        <span className="metric-value">{formatCurrency(result.futureValueShortTerm)}</span>
                                    </div>
                                    
                                    <div className="metric">
                                        <span className="metric-label">📈 Investment Gains</span>
                                        <span className="metric-value" style={{ color: result.investmentGains > 0 ? '#28a745' : '#dc3545' }}>
                                            {formatCurrency(result.investmentGains)} ({formatPercentage(result.roiPercentage)})
                                        </span>
                                    </div>
                                    
                                    <div className="metric">
                                        <span className="metric-label">🏦 Extra Interest Cost (Longer Loan)</span>
                                        <span className="metric-value" style={{ color: '#dc3545' }}>
                                            {formatCurrency(results.extraInterestCost)}
                                        </span>
                                    </div>
                                    
                                    <div className="metric">
                                        <span className="metric-label">⚖️ Net Financial Position</span>
                                        <span className="metric-value" style={{ color: result.netBenefit > 0 ? '#28a745' : '#dc3545' }}>
                                            {formatCurrency(result.netBenefit)}
                                        </span>
                                    </div>
                                    
                                    <div className="metric">
                                        <span className="metric-label">✅ Break-even Analysis</span>
                                        <span className="metric-value" style={{ color: result.futureValueShortTerm > results.extraInterestCost ? '#28a745' : '#dc3545' }}>
                                            {result.futureValueShortTerm > results.extraInterestCost ? 'Investment Strategy Wins ✅' : 'Shorter Loan Better ❌'}
                                        </span>
                                    </div>
                                    
                                    {result.futureValueLongTerm !== undefined && results.shorterTenure !== results.longerTenure && (
                                        <>
                                            <div className="metric">
                                                <span className="metric-label">🚀 Future Value (after {results.longerTenure} years)</span>
                                                <span className="metric-value">{formatCurrency(result.futureValueLongTerm)}</span>
                                            </div>
                                            
                                            <div className="metric">
                                                <span className="metric-label">💳 Remaining Loan Payments</span>
                                                <span className="metric-value">{formatCurrency(result.remainingPayment)}</span>
                                            </div>
                                            
                                            <div className="metric">
                                                <span className="metric-label">🎯 Net Worth Impact (after {results.longerTenure} years)</span>
                                                <span className="metric-value" style={{ color: (result.futureValueLongTerm - result.remainingPayment) > 0 ? '#28a745' : '#dc3545' }}>
                                                    {formatCurrency(result.futureValueLongTerm - result.remainingPayment)}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="recommendation">
                        <h3>💡 Strategic Financial Recommendation</h3>
                        
                        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                            <p><strong>🎯 The Core Question:</strong></p>
                            <p>Should you pay an extra {formatCurrency(results.extraInterestCost)} in interest (by choosing the {results.longerTenure}-year loan) to free up {formatCurrency(results.emiDifference)} monthly for investment over {results.shorterTenure} years?</p>
                        </div>

                        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                            <p><strong>📊 Analysis Summary:</strong></p>
                            {results.investmentResults.map(res => {
                                const isPositive = res.netBenefit > 0;
                                // Recalculate breakEvenCAGR here if needed for display, otherwise rely on the one from previous logic.
                                // For simplicity and consistency with the helper function, we'll just display the result.
                                
                                return (
                                    <p key={res.cagr} style={{ 
                                        padding: '8px 12px', 
                                        margin: '5px 0', 
                                        backgroundColor: isPositive ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                                        borderRadius: '8px',
                                        borderLeft: `4px solid ${isPositive ? '#28a745' : '#dc3545'}`
                                    }}>
                                        <strong>At {res.cagr}% Expected Annualized Return{res.cagr === parseFloat(expectedCagr) && " (Your Expectation)"}:</strong> 
                                        {isPositive ? 
                                            ` You could benefit by ${formatCurrency(res.netBenefit)} by choosing the longer loan and investing the EMI difference.` :
                                            ` You could incur an additional cost of ${formatCurrency(Math.abs(res.netBenefit))} compared to taking the shorter loan.`
                                        }
                                    </p>
                                );
                            })}
                        </div>

                        <div style={{ textAlign: 'left', padding: '15px', background: 'rgba(255,255,255,0.2)', borderRadius: '10px' }}>
                            <p><strong>🎯 Final Recommendation:</strong></p>
                            {results.investmentResults.some(r => r.netBenefit > 0) ? (
                                results.investmentResults.every(r => r.netBenefit > 0) ? (
                                    <p>✅ <strong>Choose the {results.longerTenure}-year loan and invest the EMI difference.</strong> This strategy shows consistent positive returns across all tested scenarios. The investment approach appears to be the optimal financial strategy given your expected returns.</p>
                                ) : (
                                    <p>⚖️ <strong>The decision depends on your expected investment returns.</strong> If you're confident in consistently achieving higher annualized returns ({results.investmentResults.filter(r => r.netBenefit > 0).map(r => r.cagr + '%').join(', ')}), choose the longer loan. Otherwise, the shorter loan provides more financial certainty by minimizing total interest paid.</p>
                                )
                            ) : (
                                <p>❌ <strong>Choose the {results.shorterTenure}-year loan.</strong> Based on the tested scenarios, the shorter loan term appears more cost-effective. The potential investment gains are not sufficient to offset the extra interest costs incurred with the longer loan.</p>
                            )}
                            
                            <p style={{ marginTop: '10px', fontSize: '0.9em', opacity: '0.9' }}>
                                <strong>⚠️ Important:</strong> This analysis assumes consistent monthly investments and does not account for market volatility, investment fees, or tax implications. It's a projection based on your input. Consider your risk tolerance and consult a financial advisor for personalized advice.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
            {results && results.emiDifference < 0 && (
                <div className="results">
                    <p className="highlight" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', background: '#fff3cd' }}>
                        The first loan tenure ({results.loan1.tenureYears} years) results in a lower or equal EMI than the second tenure ({results.loan2.tenureYears} years).
                        This typically means the first tenure is longer or equal to the second. Please ensure Loan Tenure 1 is shorter than Loan Tenure 2 for the investment analysis to be meaningful in the context of saving on EMI by choosing a longer loan.
                        If tenures are equal, there is no EMI difference to invest.
                        <br />Current EMI for {results.loan1.tenureYears}yr loan: {formatCurrency(results.loan1.emi)}. Current EMI for {results.loan2.tenureYears}yr loan: {formatCurrency(results.loan2.emi)}.
                    </p>
                </div>
            )}
        </div>
    );
};

export default LoanTermComparisonCalculator;