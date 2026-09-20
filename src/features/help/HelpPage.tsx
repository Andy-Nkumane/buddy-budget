import {
  BookOpen,
  Download,
  History,
  CalendarClock,
  Laptop,
  ListPlus,
  LockKeyhole,
  ListChecks,
  PencilLine,
  Smartphone,
  WalletCards,
  Landmark,
  WifiOff,
} from 'lucide-react';

const topics = [
  {
    icon: Landmark,
    title: 'Plan goals without hiding spending',
    body: 'Create savings, sinking-fund, or debt-payoff goals in Goals. Recommended contributions appear beside templates and monthly budgets as transfers, not expenses. Record contributions to update progress; pausing a goal keeps its history and stops future recommendations.',
  },
  {
    icon: CalendarClock,
    title: 'Forecast upcoming cash flow',
    body: 'Add income and expense schedules in Cash flow. The seven-day list and calendar show what is expected before your next income and the lowest projected balance. Forecasts become paid or received only when you confirm them, and transaction matches always require your confirmation.',
  },
  {
    icon: ListChecks,
    title: 'Use categorisation rules',
    body: 'Create and reorder transparent rules in Settings. Test them first to see each proposed field change and winning rule. Suggestions appear only after three consistently categorised transactions and are never created automatically.',
  },
  {
    icon: ListPlus,
    title: '1. Create a template',
    body: 'Add the income and expenses that recur most months. Defaults can be zero. Template changes affect only months created later.',
  },
  {
    icon: WalletCards,
    title: '2. Create a month',
    body: 'The current month is created once from your default template. Past and future months wait for you to select “Create this month”.',
  },
  {
    icon: PencilLine,
    title: '3. Edit monthly values',
    body: 'Select an amount and type the new value. Buddy Budget saves after a short pause and clearly shows saving, saved, or failed status.',
  },
  {
    icon: ListPlus,
    title: '4. Add one-off items',
    body: 'Use Add income or Add expense inside a month. Optionally add the same item to your default template for future months.',
  },
  {
    icon: WalletCards,
    title: '5. Understand totals',
    body: 'Planned values come from the month snapshot. Actual values come from posted transactions. Pending and void entries do not change actuals.',
  },
  {
    icon: PencilLine,
    title: '6. Record actual activity',
    body: 'Add real income and expenses in Transactions and optionally assign an account, category, and budget item. Use Expense refund or Income reversal instead of entering a negative amount.',
  },
  {
    icon: Download,
    title: 'Import a bank CSV',
    body: 'In Transactions, choose Import CSV, map your statement columns, review every valid, invalid, duplicate, or excluded row, then confirm. Files must be UTF-8, no larger than 2 MiB or 2,000 rows. The raw file stays in browser memory and is never uploaded or retained.',
  },
  {
    icon: History,
    title: '7. Review previous months',
    body: 'Month history shows each independent snapshot. Reports two or more calendar months old are read-only, including their transactions.',
  },
  {
    icon: Download,
    title: '8. Export your data',
    body: 'Choose a preset or custom month range in Settings, then export planned and actual details as CSV, JSON, or a PDF report. One-month exports remain available in Month history.',
  },
  {
    icon: Smartphone,
    title: '9. Install on Android or iOS',
    body: 'On Android Chrome, open the browser menu and choose Install app or Add to Home screen. On iPhone or iPad Safari, tap Share, then Add to Home Screen.',
  },
  {
    icon: Laptop,
    title: 'Install on desktop',
    body: 'In a supported desktop browser, use the install icon in the address bar or the browser app menu. Browser wording varies by version.',
  },
  {
    icon: WifiOff,
    title: '10. What works offline',
    body: 'The installed app can open its shell and public help while offline. Financial edits are not stored offline in V1; wait for a connection and retry.',
  },
  {
    icon: LockKeyhole,
    title: '11. Protect your account',
    body: 'Use a unique password, protect your email account, sign out on shared devices, and never share password-reset links or exported data.',
  },
];

export const HelpPage = () => (
  <section className="page help-page">
    <div className="page-heading">
      <div>
        <p className="eyebrow">A quick guide</p>
        <h1>How Buddy Budget works</h1>
        <p>Build the recurring plan once, create a snapshot, then adjust only what changed.</p>
      </div>
      <span className="page-heading__icon">
        <BookOpen />
      </span>
    </div>
    <div className="help-grid">
      {topics.map(({ icon: Icon, title, body }) => (
        <article className="help-card" key={title}>
          <span>
            <Icon aria-hidden="true" />
          </span>
          <div>
            <h2>{title}</h2>
            <p>{body}</p>
          </div>
        </article>
      ))}
    </div>
  </section>
);
