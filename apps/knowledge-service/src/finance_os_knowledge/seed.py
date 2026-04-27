from datetime import UTC, datetime

from .models import KnowledgeEntity, KnowledgeIngestRequest, KnowledgeRelation, Provenance

SEED_TIMESTAMP = datetime(2026, 4, 26, tzinfo=UTC)


def _slug(value: str) -> str:
    return (
        value.lower()
        .replace("/", " ")
        .replace("+", " plus ")
        .replace("&", " and ")
        .replace("-", " ")
        .replace("(", " ")
        .replace(")", " ")
        .replace(".", " ")
        .replace(",", " ")
        .replace("'", "")
        .replace('"', "")
        .strip()
        .replace(" ", "_")
    )


def _provenance(source_ref: str, confidence: float = 0.86) -> list[Provenance]:
    return [
        Provenance(
            source="finance-os-curated-seed",
            source_type="curated_reference",
            source_ref=source_ref,
            source_timestamp=SEED_TIMESTAMP,
            confidence=confidence,
            notes="Curated deterministic seed. Validate against primary source before using for regulated decisions.",
        )
    ]


def _entity(
    node_type: str,
    label: str,
    description: str,
    *,
    tags: list[str],
    confidence: float = 0.84,
    formula: str | None = None,
    inputs: list[str] | None = None,
    outputs: list[str] | None = None,
    usage: str,
    caveats: list[str],
    example: str,
    scope: str = "demo",
    metadata: dict | None = None,
) -> KnowledgeEntity:
    concept_id = f"{node_type.lower()}:{_slug(label)}"
    return KnowledgeEntity(
        id=concept_id,
        type=node_type,  # type: ignore[arg-type]
        label=label,
        description=description,
        source="finance-os-curated-seed",
        sourceRef=f"seed:{_slug(label)}",
        provenance=_provenance(f"seed:{_slug(label)}", confidence),
        observedAt=SEED_TIMESTAMP,
        validFrom=SEED_TIMESTAMP,
        sourceTimestamp=SEED_TIMESTAMP,
        confidence=confidence,
        tags=tags,
        scope=scope,  # type: ignore[arg-type]
        dedupeKey=concept_id,
        metadata={
            "definition": description,
            "formula": formula,
            "inputs": inputs or [],
            "outputs": outputs or [],
            "financeOsUsage": usage,
            "caveats": caveats,
            "exampleInterpretation": example,
            **(metadata or {}),
        },
    )


def _relation(
    relation_type: str,
    from_id: str,
    to_id: str,
    *,
    description: str,
    confidence: float = 0.78,
    weight: float = 0.75,
    tags: list[str] | None = None,
) -> KnowledgeRelation:
    relation_id = f"rel:{_slug(relation_type)}:{_slug(from_id)}:{_slug(to_id)}"
    return KnowledgeRelation(
        id=relation_id,
        type=relation_type,  # type: ignore[arg-type]
        fromId=from_id,
        toId=to_id,
        label=relation_type.replace("_", " ").title(),
        description=description,
        source="finance-os-curated-seed",
        sourceRef=relation_id,
        provenance=_provenance(relation_id, confidence),
        observedAt=SEED_TIMESTAMP,
        validFrom=SEED_TIMESTAMP,
        sourceTimestamp=SEED_TIMESTAMP,
        confidence=confidence,
        weight=weight,
        tags=tags or [],
        scope="demo",
        dedupeKey=relation_id,
    )


CORE_CONCEPTS = [
    {
        "type": "Formula",
        "label": "Compound interest",
        "description": "Growth process where returns are reinvested and future returns accrue on principal plus prior returns.",
        "formula": "FV = PV * (1 + r / n) ** (n * t)",
        "inputs": ["present value", "rate", "compounding frequency", "time"],
        "outputs": ["future value"],
        "tags": ["financial-math", "returns", "compounding"],
        "usage": "Explains long-horizon accumulation and cash drag opportunity cost.",
        "caveats": ["Assumes stable rate and reinvestment.", "Taxes, fees and volatility can lower realized compounding."],
        "example": "A higher fee drag reduces the compounding base every period.",
    },
    {
        "type": "FinancialConcept",
        "label": "Time value of money",
        "description": "A unit of money today is usually worth more than the same nominal unit later because it can earn returns and faces inflation risk.",
        "tags": ["financial-math", "discounting", "inflation"],
        "usage": "Frames present/future value, goal funding and opportunity-cost explanations.",
        "caveats": ["The discount rate is an assumption, not an observed truth."],
        "example": "A 10,000 EUR target in three years needs a discount-rate assumption to compare with money today.",
    },
    {
        "type": "Formula",
        "label": "Present value",
        "description": "Current equivalent value of a future cash flow after discounting by a chosen rate.",
        "formula": "PV = FV / (1 + r) ** t",
        "inputs": ["future value", "discount rate", "time"],
        "outputs": ["present value"],
        "tags": ["financial-math", "discounting"],
        "usage": "Normalizes future goals or liabilities into today's terms.",
        "caveats": ["Highly sensitive to the selected discount rate and time horizon."],
        "example": "A far future goal has a lower present value at a higher discount rate.",
    },
    {
        "type": "Formula",
        "label": "Future value",
        "description": "Expected future amount after applying an assumed growth or interest rate.",
        "formula": "FV = PV * (1 + r) ** t",
        "inputs": ["present value", "rate", "time"],
        "outputs": ["future value"],
        "tags": ["financial-math", "projection"],
        "usage": "Projects savings plans and recurring investments.",
        "caveats": ["Not a guarantee; realized paths can be volatile."],
        "example": "A monthly investment plan can be projected with an expected return, then stress-tested.",
    },
    {
        "type": "FinancialConcept",
        "label": "Discount rate",
        "description": "Rate used to convert future cash flows into present value or to reflect opportunity cost and risk.",
        "tags": ["financial-math", "assumption"],
        "usage": "Makes assumptions explicit in goal and valuation reasoning.",
        "caveats": ["Different goals can require different discount rates."],
        "example": "A safe near-term goal should usually use a lower discount rate than risky equity growth.",
    },
    {
        "type": "Formula",
        "label": "CAGR",
        "description": "Compound annual growth rate that smooths total growth across years.",
        "formula": "CAGR = (Ending / Beginning) ** (1 / years) - 1",
        "inputs": ["beginning value", "ending value", "years"],
        "outputs": ["annualized return"],
        "tags": ["financial-math", "returns"],
        "usage": "Compares multi-year performance on a normalized basis.",
        "caveats": ["Hides path volatility and drawdowns."],
        "example": "Two portfolios can have the same CAGR but very different drawdown risk.",
    },
    {
        "type": "FinancialConcept",
        "label": "Real vs nominal returns",
        "description": "Nominal return is before inflation adjustment; real return estimates purchasing-power growth after inflation.",
        "formula": "real return ~= nominal return - inflation",
        "inputs": ["nominal return", "inflation"],
        "outputs": ["real return"],
        "tags": ["financial-math", "inflation", "returns"],
        "usage": "Prevents cash and low-yield assets from looking safer than they are in purchasing-power terms.",
        "caveats": ["Approximation is less exact at high inflation rates."],
        "example": "A 3% nominal yield with 2.5% inflation is only about 0.5% real before tax.",
    },
    {
        "type": "Formula",
        "label": "Inflation-adjusted returns",
        "description": "Return adjusted for inflation using exact real-return math.",
        "formula": "real = ((1 + nominal) / (1 + inflation)) - 1",
        "inputs": ["nominal return", "inflation rate"],
        "outputs": ["real return"],
        "tags": ["financial-math", "inflation"],
        "usage": "Used when explaining cash drag and real wealth growth.",
        "caveats": ["Uses broad inflation proxies; personal inflation can differ."],
        "example": "High energy spending can make personal inflation higher than headline CPI.",
    },
    {
        "type": "FinancialConcept",
        "label": "Opportunity cost",
        "description": "Value of the best foregone alternative when capital or time is allocated to one choice.",
        "tags": ["financial-math", "decision"],
        "usage": "Explains the cost of excess idle cash or expensive commitments.",
        "caveats": ["The alternative return is hypothetical and should be stress-tested."],
        "example": "Cash held for optionality has a cost if it exceeds the emergency fund and near-term needs.",
    },
    {
        "type": "Formula",
        "label": "Drawdown recovery math",
        "description": "Gain required to recover from a loss grows non-linearly as drawdown deepens.",
        "formula": "required gain = loss / (1 - loss)",
        "inputs": ["drawdown percentage"],
        "outputs": ["required recovery percentage"],
        "tags": ["risk", "drawdown", "financial-math"],
        "usage": "Explains why avoiding deep losses can matter more than chasing upside.",
        "caveats": ["Recovery math ignores cashflows added during the drawdown."],
        "example": "A 50% drawdown needs a 100% gain to recover.",
    },
    {
        "type": "PersonalFinanceRule",
        "label": "DCA vs lump sum",
        "description": "Lump sum maximizes time in market on average; DCA spreads entry risk and can improve behavioral discipline.",
        "tags": ["investing", "behavior", "assumption"],
        "usage": "Frames reversible recommendations for deploying excess cash.",
        "caveats": ["Historical average does not guarantee future outcomes.", "DCA can underperform if markets rise steadily."],
        "example": "For a nervous investor, DCA can reduce regret risk even if expected return is lower.",
    },
]

RISK_AND_PORTFOLIO = [
    ("RiskMetric", "Volatility", "Dispersion of returns around their average.", "standard deviation of returns", ["risk", "portfolio"], "Measures rough uncertainty of an asset or portfolio."),
    ("RiskMetric", "Standard deviation", "Statistical measure of dispersion around a mean.", "sqrt(variance)", ["risk", "math"], "Inputs portfolio volatility estimates."),
    ("MathConcept", "Covariance", "Measure of how two variables move together.", "cov(X,Y)", ["risk", "math"], "Combines assets in portfolio risk estimates."),
    ("MathConcept", "Correlation", "Normalized covariance from -1 to +1.", "cov(X,Y)/(sigmaX*sigmaY)", ["risk", "math"], "Explains diversification quality."),
    ("RiskMetric", "Beta", "Sensitivity of an asset to a market benchmark.", "cov(asset, market)/var(market)", ["risk", "market"], "Flags market sensitivity and concentration."),
    ("Formula", "CAPM", "Expected return model based on risk-free rate, beta and market premium.", "E[R] = Rf + beta * (Rm - Rf)", ["risk", "returns"], "Documents expected-return assumptions."),
    ("RiskMetric", "Sharpe ratio", "Excess return per unit of total volatility.", "(Rp - Rf) / sigma", ["risk", "returns"], "Compares risk-adjusted portfolio quality."),
    ("RiskMetric", "Sortino ratio", "Excess return per unit of downside deviation.", "(Rp - Rf) / downside deviation", ["risk", "returns"], "Better when downside risk matters more than upside variation."),
    ("RiskMetric", "Max drawdown", "Largest peak-to-trough loss over a period.", "max((peak - trough)/peak)", ["risk", "drawdown"], "Explains painful loss history."),
    ("RiskMetric", "Value at Risk", "Estimated loss threshold at a confidence level over a horizon.", "quantile(loss distribution)", ["risk", "advanced"], "Useful only as a rough stress lens."),
    ("RiskMetric", "Conditional Value at Risk", "Expected loss beyond the VaR threshold.", "E[loss | loss > VaR]", ["risk", "advanced"], "Captures tail severity better than VaR."),
    ("Formula", "Kelly criterion", "Position sizing rule maximizing log growth under known edge and odds.", "f* = edge / odds", ["risk", "advanced", "danger"], "Marked risky/advanced; never used for trade execution."),
    ("PortfolioMetric", "Diversification", "Reducing dependence on one asset, sector, country or risk driver.", None, ["risk", "portfolio"], "Supports concentration-risk recommendations."),
    ("PersonalFinanceRule", "Rebalancing bands", "Tolerance ranges that trigger portfolio rebalancing when allocations drift.", None, ["portfolio", "discipline"], "Keeps risk profile explicit and reversible."),
    ("PortfolioMetric", "Allocation drift", "Gap between current allocation and target allocation.", "current weight - target weight", ["portfolio", "risk"], "Direct input to advisor rebalancing recommendations."),
    ("RiskMetric", "Liquidity risk", "Risk that an asset or commitment cannot be converted to cash when needed.", None, ["risk", "cash"], "Protects emergency-fund reasoning."),
    ("RiskMetric", "Concentration risk", "Risk from too much exposure to one position, sector, employer or theme.", None, ["risk", "portfolio"], "Flags fragile portfolios."),
    ("RiskMetric", "Sequence-of-returns risk", "Risk that early losses combined with withdrawals harm long-term outcomes.", None, ["risk", "retirement"], "Important for drawdown and decumulation reasoning."),
]

PERSONAL_FINANCE = [
    ("BudgetMetric", "Emergency fund ratio", "Liquid reserves divided by monthly expenses.", "liquid cash / monthly expenses", ["budget", "cash"], "Primary resilience signal."),
    ("BudgetMetric", "Savings rate", "Share of income kept after expenses.", "(income - expenses) / income", ["budget", "cashflow"], "Tracks ability to fund goals."),
    ("BudgetMetric", "Debt-to-income ratio", "Debt payments relative to income.", "monthly debt payments / gross income", ["budget", "debt"], "Future debt module input."),
    ("BudgetMetric", "Burn rate", "Monthly spending run-rate.", "monthly expenses", ["budget", "cashflow"], "Converts cash into runway months."),
    ("BudgetMetric", "Fixed vs variable expenses", "Split between hard commitments and flexible spending.", None, ["budget"], "Improves expense recommendations."),
    ("RecurringCommitment", "Recurring commitments", "Subscriptions, rent, debt and predictable obligations.", None, ["budget", "commitments"], "Supports budget drift detection."),
    ("BudgetMetric", "Monthly budget variance", "Difference between planned and observed monthly spending.", "actual - planned", ["budget"], "Detects drift."),
    ("BudgetMetric", "Cash drag", "Expected return gap caused by excess unallocated cash.", "excess cash weight * return gap", ["cash", "opportunity-cost"], "Current finance-engine metric."),
    ("BudgetMetric", "Income stability", "Reliability and variance of recurring income.", None, ["income", "risk"], "Future personal snapshot input."),
    ("BudgetMetric", "Expense volatility", "Variation in spending by category or month.", None, ["budget", "risk"], "Flags need for larger buffer."),
    ("Goal", "Goal funding progress", "Progress toward a specific financial target.", "current amount / target amount", ["goals"], "Connects recommendations to goals."),
    ("PortfolioMetric", "Asset allocation concepts", "Mapping assets to cash, growth, defensive and alternative buckets.", None, ["portfolio"], "Core deterministic advisor input."),
    ("PersonalFinanceRule", "Risk tolerance concepts", "Capacity and willingness to accept volatility and drawdown.", None, ["risk", "behavior"], "Anchors target allocation."),
    ("PersonalFinanceRule", "France and Europe tax wrapper concepts", "High-level wrapper awareness such as PEA, assurance-vie and CTO, if represented in app data.", None, ["tax", "europe", "france"], "Knowledge-only context; not personalized tax advice."),
]

MACRO_LINKS = [
    ("MacroSignal", "Rates", "Interest-rate level and path affecting discount rates, bonds, cash and valuation multiples.", ["macro", "rates"]),
    ("MacroSignal", "Inflation", "Change in price level affecting real returns and household purchasing power.", ["macro", "inflation"]),
    ("MacroSignal", "Yield curve", "Relationship between yields across maturities, often watched for growth expectations.", ["macro", "rates"]),
    ("MacroSignal", "Unemployment", "Labor-market signal relevant to income stability and central-bank reaction.", ["macro", "labor"]),
    ("MarketEvent", "Central bank decisions", "Rate decisions, guidance and balance-sheet policy events.", ["macro", "policy"]),
    ("MarketEvent", "Earnings", "Company profit releases and guidance updates.", ["macro", "equity"]),
    ("MacroSignal", "Credit conditions", "Availability and cost of credit for households and companies.", ["macro", "credit"]),
    ("MacroSignal", "Liquidity conditions", "Market funding and risk appetite conditions.", ["macro", "liquidity"]),
    ("MacroSignal", "Geopolitical risk", "Conflict, sanctions and policy risk that can affect prices and supply chains.", ["macro", "risk"]),
    ("MacroSignal", "Energy prices", "Oil, gas and power prices affecting inflation and sector margins.", ["macro", "energy"]),
    ("MarketEvent", "AI model release events", "Frontier model or AI infra releases that can affect sectors, sentiment, token costs and automation routing.", ["macro", "ai", "model-cost"]),
]

TRADING_TECHNICAL = [
    ("TradingStrategy", "ICT and CRT", "Discretionary technical-analysis concepts around liquidity, ranges and candle behavior; not a proven deterministic edge.", ["technical-analysis", "experimental", "paper-trading-only"]),
    ("Indicator", "Volume Profile", "Distribution of traded volume across price levels.", ["technical-analysis", "volume", "paper-trading-only"]),
    ("TradingStrategy", "ORB Opening Range Breakout", "Breakout framework based on the first session range.", ["technical-analysis", "experimental", "paper-trading-only"]),
    ("Indicator", "EMA20 plus horizontal line combo", "Combination of a 20-period exponential moving average and horizontal levels.", ["technical-analysis", "experimental", "paper-trading-only"]),
    ("Indicator", "Parabolic SAR", "Trend-following indicator plotting stop-and-reverse levels.", ["technical-analysis", "indicator", "paper-trading-only"]),
    ("Indicator", "RCI", "Rank Correlation Index style momentum oscillator.", ["technical-analysis", "indicator", "paper-trading-only"]),
    ("FinancialConcept", "Support and resistance", "Price zones where buyers or sellers previously appeared.", ["technical-analysis", "paper-trading-only"]),
    ("TradingStrategy", "Trend momentum mean reversion", "Broad strategy families based on continuation or reversal assumptions.", ["technical-analysis", "experimental", "paper-trading-only"]),
    ("TradingStrategy", "Slippage", "Difference between expected and executed price.", ["market-microstructure", "paper-trading-only"]),
    ("TradingStrategy", "Fees", "Explicit transaction costs that reduce strategy returns.", ["market-microstructure", "cost"]),
    ("TradingStrategy", "Spread", "Difference between bid and ask price.", ["market-microstructure", "liquidity"]),
    ("TradingStrategy", "Liquidity", "Ability to transact without large price impact.", ["market-microstructure", "risk"]),
    ("TradingStrategy", "Paper trading only", "Simulation mode with no real order execution.", ["guardrail", "paper-trading-only"]),
    ("RiskMetric", "Backtesting bias", "Bias introduced by unrealistic or incomplete historical simulation assumptions.", ["backtesting", "risk"]),
    ("RiskMetric", "Overfitting", "Model or rule tuned too closely to historical noise.", ["backtesting", "risk"]),
    ("RiskMetric", "Survivorship bias", "Bias from excluding assets that disappeared or failed.", ["backtesting", "risk"]),
    ("RiskMetric", "Lookahead bias", "Using information in a backtest that was unavailable at the decision time.", ["backtesting", "risk"]),
    ("RiskMetric", "Data snooping", "Repeated testing until a coincidental pattern appears significant.", ["backtesting", "risk"]),
    ("RiskMetric", "Regime change", "Shift in market behavior that invalidates assumptions learned from prior periods.", ["backtesting", "risk"]),
    ("RiskMetric", "Calmar ratio", "Annualized return divided by maximum drawdown. Higher is better risk-adjusted.", ["risk", "returns", "paper-trading-only"]),
    ("RiskMetric", "Walk-forward validation", "Testing a strategy on sequential out-of-sample windows to reduce overfitting.", ["backtesting", "validation", "paper-trading-only"]),
    ("RiskMetric", "Out-of-sample testing", "Evaluating a strategy on data not used for parameter selection.", ["backtesting", "validation", "paper-trading-only"]),
    ("RiskMetric", "Transaction cost modeling", "Realistic fee, slippage and spread assumptions in backtest simulations.", ["backtesting", "cost", "paper-trading-only"]),
    ("RiskMetric", "Backtest vs live gap", "Performance difference between historical simulation and real execution due to costs, latency and behavior.", ["backtesting", "risk", "paper-trading-only"]),
    ("RiskMetric", "Risk of ruin", "Probability of losing a specified fraction of capital under a given strategy.", ["risk", "advanced", "paper-trading-only"]),
    ("FinancialConcept", "Position sizing", "Determining trade size based on risk budget, volatility and account equity.", ["risk-management", "paper-trading-only"]),
    ("FinancialConcept", "Stop-loss and trailing stop", "Order types that limit downside by exiting positions at predefined loss thresholds.", ["risk-management", "paper-trading-only"]),
    ("FinancialConcept", "Volatility regime detection", "Identifying whether the market is in a low, normal or high volatility state to adapt strategy behavior.", ["technical-analysis", "experimental", "paper-trading-only"]),
    ("FinancialConcept", "Breakout and false breakout", "Price movement beyond a range boundary, which may be genuine or quickly reversed.", ["technical-analysis", "experimental", "paper-trading-only"]),
    ("Indicator", "ATR Average True Range", "Volatility indicator measuring the average range of price movement over a period.", ["technical-analysis", "indicator", "paper-trading-only"]),
    ("Indicator", "Bollinger Bands", "Volatility bands plotted at standard deviations above and below a moving average.", ["technical-analysis", "indicator", "paper-trading-only"]),
    ("Indicator", "RSI Relative Strength Index", "Momentum oscillator measuring speed and magnitude of recent price changes, 0-100 scale.", ["technical-analysis", "indicator", "paper-trading-only"]),
    ("Indicator", "MACD", "Moving Average Convergence Divergence. Trend-following momentum indicator using EMA differences.", ["technical-analysis", "indicator", "paper-trading-only"]),
]

AGENTIC_AND_MODEL_MEMORY = [
    ("Model", "Model", "LLM or local model capability/cost profile tracked for AI Advisor and development automation cost intelligence.", ["ai", "model", "cost"]),
    ("AgentSkill", "AgentSkill", "Reusable agent capability or workflow skill with observed efficiency and output quality.", ["agentic", "skill", "cost"]),
    ("AgentRun", "AgentRun", "Single agent or advisor run with inputs, outputs, latency, cost and provenance.", ["agentic", "run", "observability"]),
    ("CostObservation", "CostObservation", "Observed or configured model/service cost fact with source, validity and supersession windows.", ["ai", "cost", "token-budget"]),
    ("TokenUsageObservation", "TokenUsageObservation", "Observed token usage attached to a run, model and feature.", ["ai", "tokens", "budget"]),
    ("Recommendation", "Recommendation", "Advisor recommendation node linked to deterministic metrics, assumptions, evidence and challenges.", ["advisor", "recommendation"]),
    ("Assumption", "Assumption", "Explicit assumption used by deterministic projections or LLM context.", ["advisor", "assumption"]),
    ("Evidence", "Evidence", "Source-backed evidence item that supports, contradicts or weakens a fact.", ["provenance", "evidence"]),
    ("UserFinancialStateSnapshot", "UserFinancialStateSnapshot", "Point-in-time personal finance state snapshot for advisor reasoning.", ["personal", "snapshot"]),
    ("TransactionCluster", "TransactionCluster", "Grouped transactions by merchant, category or recurring pattern.", ["personal", "transactions"]),
]


def build_seed_ingest(mode: str = "demo") -> KnowledgeIngestRequest:
    entities: list[KnowledgeEntity] = []

    for item in CORE_CONCEPTS:
        entities.append(
            _entity(
                item["type"],
                item["label"],
                item["description"],
                formula=item.get("formula"),
                inputs=item.get("inputs"),
                outputs=item.get("outputs"),
                tags=item["tags"],
                usage=item["usage"],
                caveats=item["caveats"],
                example=item["example"],
                scope=mode,
            )
        )

    for node_type, label, description, formula, tags, usage in RISK_AND_PORTFOLIO:
        entities.append(
            _entity(
                node_type,
                label,
                description,
                formula=formula,
                tags=tags,
                usage=usage,
                caveats=["Model output is only as good as source data and assumptions."],
                example=f"Advisor can cite {label} when explaining risk or portfolio quality.",
                scope=mode,
            )
        )

    for node_type, label, description, formula, tags, usage in PERSONAL_FINANCE:
        entities.append(
            _entity(
                node_type,
                label,
                description,
                formula=formula,
                tags=tags,
                usage=usage,
                caveats=["Personal context and data freshness must be checked before acting."],
                example=f"{label} can shape a recommendation but should surface unknowns.",
                scope=mode,
            )
        )

    for node_type, label, description, tags in MACRO_LINKS:
        entities.append(
            _entity(
                node_type,
                label,
                description,
                tags=tags,
                usage="Connects external events to portfolio, budget or advisor context.",
                caveats=["Macro links are hypotheses unless supported by evidence and observed data."],
                example=f"A {label} change can affect sectors, assets or assumptions through graph paths.",
                scope=mode,
            )
        )

    for node_type, label, description, tags in TRADING_TECHNICAL:
        entities.append(
            _entity(
                node_type,
                label,
                description,
                tags=tags,
                usage="Knowledge-only research context for future Trading Lab and paper-trading analysis.",
                caveats=[
                    "No real trading or order execution.",
                    "Technical-analysis concepts are experimental and not guaranteed strategies.",
                ],
                example=f"{label} may be inspected in a future paper-trading lab, never executed live.",
                scope=mode,
                confidence=0.62 if "technical-analysis" in tags else 0.74,
            )
        )

    for node_type, label, description, tags in AGENTIC_AND_MODEL_MEMORY:
        entities.append(
            _entity(
                node_type,
                label,
                description,
                tags=tags,
                usage="Provides typed graph space for future persisted observations without mixing advisor finance memory with repo automation instructions.",
                caveats=[
                    "Agentic pipeline knowledge remains separate from AI Advisor financial recommendations.",
                    "Costs and usage must be provenance-backed and can be stale.",
                ],
                example=f"{label} nodes can link cost, token usage and recommendation context with time validity.",
                scope=mode,
                confidence=0.78,
            )
        )

    id_by_label = {entity.label: entity.id for entity in entities}
    relations: list[KnowledgeRelation] = []

    def connect(kind: str, left: str, right: str, description: str, weight: float = 0.74) -> None:
        if left in id_by_label and right in id_by_label:
            relations.append(_relation(kind, id_by_label[left], id_by_label[right], description=description, weight=weight))

    connect("USES_FORMULA", "Time value of money", "Present value", "TVM uses present-value discounting.", 0.88)
    connect("USES_FORMULA", "Time value of money", "Future value", "TVM uses future-value accumulation.", 0.88)
    connect("USES_FORMULA", "Compound interest", "Future value", "Compound interest is a future-value process.", 0.9)
    connect("IMPACTS", "Inflation", "Real vs nominal returns", "Inflation converts nominal to real returns.", 0.86)
    connect("IMPACTS", "Cash drag", "Opportunity cost", "Cash drag is an opportunity-cost signal.", 0.85)
    connect("APPLIES_TO", "DCA vs lump sum", "Opportunity cost", "DCA trades expected opportunity cost for behavior and timing-risk control.", 0.78)
    connect("APPLIES_TO", "Drawdown recovery math", "Max drawdown", "Recovery math explains max-drawdown severity.", 0.86)
    connect("USES_FORMULA", "Sharpe ratio", "Volatility", "Sharpe uses volatility as denominator.", 0.82)
    connect("USES_FORMULA", "Sortino ratio", "Standard deviation", "Sortino replaces total dispersion with downside dispersion.", 0.72)
    connect("USES_FORMULA", "CAPM", "Beta", "CAPM requires beta.", 0.86)
    connect("CORRELATES_WITH", "Correlation", "Diversification", "Lower correlation can improve diversification.", 0.84)
    connect("IMPACTS", "Allocation drift", "Rebalancing bands", "Drift outside a band can trigger rebalancing.", 0.86)
    connect("INCREASES_RISK", "Concentration risk", "Max drawdown", "Concentration can increase drawdown severity.", 0.78)
    connect("MITIGATES", "Emergency fund ratio", "Liquidity risk", "A sufficient emergency fund mitigates liquidity risk.", 0.86)
    connect("IMPACTS", "Savings rate", "Goal funding progress", "Savings rate affects goal funding speed.", 0.84)
    connect("IMPACTS", "Recurring commitments", "Monthly budget variance", "Recurring commitments can drive budget variance.", 0.82)
    connect("IMPACTS", "Rates", "Discount rate", "Rates influence discount-rate assumptions.", 0.86)
    connect("CAUSES", "Central bank decisions", "Rates", "Policy decisions can move rates.", 0.82)
    connect("IMPACTS", "Rates", "Yield curve", "Rate expectations reshape the yield curve.", 0.8)
    connect("IMPACTS", "Energy prices", "Inflation", "Energy prices can feed headline inflation.", 0.76)
    connect("IMPACTS", "Credit conditions", "Liquidity conditions", "Tighter credit can weaken liquidity.", 0.76)
    connect("LEADS_TO", "AI model release events", "Model", "Model releases create model metadata and cost observations.", 0.8)
    connect("IMPACTS", "AI model release events", "CostObservation", "Model releases can change token cost expectations.", 0.76)
    connect("CONTRADICTED_BY", "ICT and CRT", "Backtesting bias", "Discretionary technical edges must be challenged by bias checks.", 0.72)
    connect("CONTRADICTED_BY", "ORB Opening Range Breakout", "Data snooping", "Opening-range rules can be data-snooped without robust validation.", 0.72)
    connect("REQUIRES_ASSUMPTION", "Volume Profile", "Liquidity", "Volume profile interpretation depends on liquidity assumptions.", 0.7)
    connect("REQUIRES_ASSUMPTION", "Paper trading only", "Slippage", "Paper trading must model slippage.", 0.82)
    connect("REQUIRES_ASSUMPTION", "Paper trading only", "Fees", "Paper trading must model fees.", 0.82)
    connect("REQUIRES_ASSUMPTION", "Paper trading only", "Spread", "Paper trading must model spreads.", 0.82)
    connect("INVALIDATES", "Lookahead bias", "Backtesting bias", "Lookahead bias invalidates backtest evidence.", 0.84)
    connect("INVALIDATES", "Survivorship bias", "Backtesting bias", "Survivorship bias invalidates backtest evidence.", 0.8)
    connect("INVALIDATES", "Overfitting", "Backtesting bias", "Overfitting weakens backtest evidence.", 0.8)
    connect("INVALIDATES", "Regime change", "Trend momentum mean reversion", "A regime change can invalidate a strategy family.", 0.68)
    connect("USES_FORMULA", "Calmar ratio", "CAGR", "Calmar uses CAGR as numerator.", 0.82)
    connect("USES_FORMULA", "Calmar ratio", "Max drawdown", "Calmar uses max drawdown as denominator.", 0.82)
    connect("MITIGATES", "Walk-forward validation", "Overfitting", "Walk-forward testing reduces overfitting risk.", 0.84)
    connect("MITIGATES", "Out-of-sample testing", "Data snooping", "OOS testing reduces data snooping risk.", 0.82)
    connect("IMPACTS", "Transaction cost modeling", "Backtest vs live gap", "Realistic cost modeling narrows the backtest-live gap.", 0.78)
    connect("REQUIRES_ASSUMPTION", "Position sizing", "Kelly criterion", "Position sizing may reference Kelly but requires strong caveats.", 0.68)
    connect("MITIGATES", "Stop-loss and trailing stop", "Max drawdown", "Stops can limit drawdown depth.", 0.72)
    connect("IMPACTS", "Volatility regime detection", "Trend momentum mean reversion", "Regime detection can inform strategy selection.", 0.7)

    return KnowledgeIngestRequest(
        mode=mode,  # type: ignore[arg-type]
        source="finance-os-curated-seed",
        entities=entities,
        relations=relations,
        observations=[],
        rebuildable=True,
    )
