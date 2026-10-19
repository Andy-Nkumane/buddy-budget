import {
  BarChart3,
  BellRing,
  BookOpen,
  CalendarClock,
  Download,
  History,
  Landmark,
  Laptop,
  Library,
  ListChecks,
  ListPlus,
  LockKeyhole,
  PencilLine,
  ShieldCheck,
  Smartphone,
  Users,
  WalletCards,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';

type HelpTopic = { icon: LucideIcon; title: string; body: string };
type HelpSection = { id: string; title: string; description: string; topics: HelpTopic[] };

const sections: HelpSection[] = [
  {
    id: 'get-started',
    title: 'Get started',
    description: 'Choose a starting point, then build your first useful monthly plan.',
    topics: [
      {
        icon: Library,
        title: 'Reach your first dashboard quickly',
        body: 'During setup, choose a curated starter, an approved demo or calculator plan, a current-month CSV statement, or a simple blank plan. Review everything before saving; interrupted setup resumes safely and repeated submission does not duplicate your first month.',
      },
      {
        icon: BarChart3,
        title: 'Calculate a plan before signing up',
        body: 'The public calculator totals income, expenses, remaining money, and savings rate entirely in your browser. Nothing is sent to Buddy Budget unless you choose to create an account and transfer the approved plan once.',
      },
      {
        icon: Laptop,
        title: 'Try the fictional demo safely',
        body: 'The public demo uses fictional data in browser memory and never reads or writes an account. “Start with this setup” keeps only the plan you approve for up to 24 hours; sample transactions are never transferred.',
      },
    ],
  },
  {
    id: 'monthly-workflow',
    title: 'Build and use a monthly budget',
    description: 'Follow the same simple flow each month: plan, record, review, and adjust.',
    topics: [
      {
        icon: ListPlus,
        title: 'Create a template',
        body: 'Add the income and expenses that recur most months. Defaults can be zero. Template changes affect only months created later.',
      },
      {
        icon: WalletCards,
        title: 'Create a month',
        body: 'The current month is created once from your default template. Past and future months wait for you to select “Create this month”.',
      },
      {
        icon: PencilLine,
        title: 'Edit monthly values',
        body: 'Select an amount and enter the new value. Buddy Budget saves after a short pause and clearly shows saving, saved, or failed status.',
      },
      {
        icon: ListPlus,
        title: 'Add one-off items',
        body: 'Use Add income or Add expense inside a month. You can also add the item to your default template for future months.',
      },
      {
        icon: WalletCards,
        title: 'Understand totals',
        body: 'Planned values come from the month snapshot. Actual values come from posted transactions. Pending and void entries do not change actuals.',
      },
      {
        icon: PencilLine,
        title: 'Record actual activity',
        body: 'Add income and expenses in Transactions and optionally assign an account, category, and budget item. Use Expense refund or Income reversal instead of entering a negative amount.',
      },
      {
        icon: Download,
        title: 'Import a bank CSV',
        body: 'Map your statement columns, review every valid, invalid, duplicate, or excluded row, then confirm. The UTF-8 file must be no larger than 2 MiB or 2,000 rows and stays in browser memory.',
      },
      {
        icon: History,
        title: 'Review previous months',
        body: 'Month history shows each independent snapshot. Reports two or more calendar months old are read-only, including their transactions.',
      },
    ],
  },
  {
    id: 'plan-and-review',
    title: 'Plan ahead and review progress',
    description: 'Use forecasts, goals, insights, and check-ins to decide what to do next.',
    topics: [
      {
        icon: CalendarClock,
        title: 'Forecast upcoming cash flow',
        body: 'Add once or recurring schedules in Cash flow. The list and calendar distinguish expected, paid, received, skipped, and disabled items. Forecasts become actual only when you confirm them.',
      },
      {
        icon: Landmark,
        title: 'Plan goals without hiding spending',
        body: 'Create savings, sinking-fund, or debt-payoff goals. Contributions appear as transfers, not expenses. Pausing a goal keeps its history and stops future recommendations.',
      },
      {
        icon: BarChart3,
        title: 'Turn history into decisions',
        body: 'Insights compares plans with posted actuals and gives an evidence-based next action. Missing evidence is labelled insufficient, currencies stay separate, and locked-month adjustments never rewrite history.',
      },
      {
        icon: LockKeyhole,
        title: 'Close a month without losing history',
        body: 'Review the checklist and save an immutable summary. Reopen before the age lock, or record a current-month adjustment for a legitimate late correction while keeping original totals visible.',
      },
      {
        icon: BellRing,
        title: 'Choose a weekly check-in',
        body: 'In Settings, opt in to one weekly in-app reminder, email, or both. Emails hide financial values unless you enable them. Preview, pause, test, or opt out at any time.',
      },
      {
        icon: ListChecks,
        title: 'Use categorisation rules',
        body: 'Create, reorder, and test transparent rules in Settings. Suggestions appear only after three consistently categorised transactions and are never created automatically.',
      },
      {
        icon: ListChecks,
        title: 'Know when useful work is complete',
        body: 'Buddy Budget acknowledges a small set of first-time actions once, then points to a practical next step. Notices are dismissible, contain no financial amounts, and never use streaks, rankings, or shame.',
      },
    ],
  },
  {
    id: 'share-and-protect',
    title: 'Share, export, and protect your data',
    description: 'Stay in control when collaborating, sharing a snapshot, or moving your data.',
    topics: [
      {
        icon: Users,
        title: 'Share a household safely',
        body: 'Owners can invite a verified email as an editor or read-only viewer. Invitations expire after seven days and work once. Switching households clears cached financial data before loading the selected budget.',
      },
      {
        icon: ShieldCheck,
        title: 'Give an adviser read-only access',
        body: 'Owners choose exact dates, sections, and expiry. Advisers use their own verified account in a clearly marked read-only mode. Export stays disabled unless the owner enables it, and revocation applies immediately.',
      },
      {
        icon: LockKeyhole,
        title: 'Share a limited report',
        body: 'Preview exactly which totals and details are included before creating an expiring link. Links can have an access code or view limit and can be revoked at any time.',
      },
      {
        icon: Library,
        title: 'Share a reusable template',
        body: 'Amounts are hidden unless enabled. Transactions, notes, goals, household members, profiles, and month history are never included. Recipients preview and customise before copying.',
      },
      {
        icon: Download,
        title: 'Export your data',
        body: 'Choose a month range in Settings, then export the selected household as CSV, portable JSON, or a PDF report. Privacy and Contact explain how to request records outside the self-service export.',
      },
      {
        icon: History,
        title: 'Restore a JSON backup',
        body: 'Settings validates a backup before upload. Merge adds missing data without rewriting existing months. Full replacement requires recent authentication and typed confirmation, and creates a recovery snapshot first.',
      },
      {
        icon: LockKeyhole,
        title: 'Protect your account',
        body: 'Use a unique password, protect your email account, sign out on shared devices, and never share password-reset links or exported data.',
      },
    ],
  },
  {
    id: 'install',
    title: 'Install and use the app',
    description: 'Install Buddy Budget on a supported device and understand its offline limits.',
    topics: [
      {
        icon: Smartphone,
        title: 'Install on Android or iOS',
        body: 'On Android Chrome, choose Install app or Add to Home screen from the browser menu. On iPhone or iPad Safari, tap Share, then Add to Home Screen.',
      },
      {
        icon: Laptop,
        title: 'Install on desktop',
        body: 'In a supported desktop browser, use the install icon in the address bar or the browser app menu. Browser wording varies by version.',
      },
      {
        icon: WifiOff,
        title: 'Know what works offline',
        body: 'The installed app can open its shell and public help while offline. Financial edits are not stored offline in V1; wait for a connection and retry.',
      },
    ],
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
        <BookOpen aria-hidden="true" />
      </span>
    </div>

    <nav className="help-nav" aria-label="How it works sections">
      {sections.map((section) => (
        <a href={`#${section.id}`} key={section.id}>
          {section.title}
        </a>
      ))}
    </nav>

    <div className="help-sections">
      {sections.map((section) => (
        <section className="help-section" id={section.id} key={section.id}>
          <header className="help-section__heading">
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </header>
          <div className="help-grid">
            {section.topics.map(({ icon: Icon, title, body }) => (
              <article className="help-card" key={title}>
                <span className="help-card__icon">
                  <Icon aria-hidden="true" />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  </section>
);
