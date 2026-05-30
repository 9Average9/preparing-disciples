import { BookOpen, Search, GitBranch, Layers, Cross } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RhemaPage() {
  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 bg-accent/10 border border-accent/30 flex items-center justify-center">
            <span className="font-serif text-2xl text-accent leading-none">
              Ρ
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary leading-tight">
              Rhema Greek Text Tools
            </h1>
            <p className="text-sm text-text-muted">
              Disciple Builder &mdash; Advanced Biblical Language Suite
            </p>
          </div>
        </div>

        <div className="bg-bg-surface border border-border-subtle p-6 max-w-2xl">
          <p className="text-base text-text-primary leading-relaxed mb-2">
            Rhema brings the ancient languages to your fingertips. Study the
            Septuagint and Greek New Testament with lexical depth, syntax
            diagrams, and cross-references — integrated directly into your
            sermon preparation workflow.
          </p>
          <p className="text-sm text-text-muted">
            Opening Rhema loads the full Greek text suite. This session stays
            connected to your sermon workshop so you can pull verses and word
            studies directly into your outline.
          </p>
        </div>
      </div>

      {/* What&apos;s included */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
          What&apos;s Included
        </h2>
        <div className="grid grid-cols-2 gap-px bg-border-subtle border border-border-subtle max-w-2xl">
          {RHEMA_FEATURES.map((feature) => (
            <FeatureItem key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      {/* Integration notice */}
      <section className="mb-10">
        <div className="bg-accent/5 border border-accent/20 px-6 py-5 max-w-2xl flex gap-4">
          <div className="shrink-0 mt-0.5">
            <div className="h-6 w-6 bg-accent/20 border border-accent/30 flex items-center justify-center">
              <Layers className="h-3.5 w-3.5 text-accent" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary mb-1">
              Sermon integration active
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              When you launch Rhema, any verse you study can be added directly
              to your current sermon&apos;s outline. Use the &ldquo;Add to Sermon&rdquo;
              button in Rhema to pull a verse reference into your active main
              point.
            </p>
          </div>
        </div>
      </section>

      {/* Launch area */}
      <section className="max-w-2xl">
        <div className="bg-bg-surface border border-border-subtle p-8 flex flex-col items-center text-center">
          <div className="h-16 w-16 bg-accent/10 border border-accent/30 flex items-center justify-center mb-5">
            <span className="font-serif text-4xl text-accent leading-none">
              Ρ
            </span>
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2">
            Launch Rhema
          </h3>
          <p className="text-sm text-text-muted mb-6 max-w-xs">
            Full Greek text environment with lexicon, morphology, and syntax
            tools. Opens in this workspace.
          </p>
          <div className="flex gap-3">
            <ComingSoonButton label="Launch Rhema" primary />
            <ComingSoonButton label="Quick Word Search" />
          </div>
          <p className="text-xs text-text-muted mt-4">
            Coming soon &mdash; Rhema integration is in active development
          </p>
        </div>
      </section>
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-bg-surface px-6 py-5 flex gap-4">
      <div className="shrink-0 mt-0.5 text-accent">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-text-primary mb-1">{title}</p>
        <p className="text-xs text-text-muted leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function ComingSoonButton({
  label,
  primary,
}: {
  label: string;
  primary?: boolean;
}) {
  return (
    <div className="relative group">
      <Button variant={primary ? "primary" : "secondary"} size="lg" disabled>
        {label}
      </Button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap bg-bg-elevated border border-border-subtle px-2 py-1 text-xs text-text-muted z-10">
        Coming soon
      </div>
    </div>
  );
}

const RHEMA_FEATURES = [
  {
    icon: <BookOpen className="h-4 w-4" />,
    title: "Septuagint (LXX)",
    description:
      "Full Greek Old Testament with Rahlfs-Hanhart critical text and interlinear support.",
  },
  {
    icon: <BookOpen className="h-4 w-4" />,
    title: "New Testament (NA28)",
    description:
      "Nestle-Aland 28th edition Greek New Testament with variant apparatus.",
  },
  {
    icon: <Search className="h-4 w-4" />,
    title: "Lexicon & Word Studies",
    description:
      "BDAG, Louw-Nida, and Thayer lexicons with morphological parsing on every word.",
  },
  {
    icon: <GitBranch className="h-4 w-4" />,
    title: "Syntax Diagrams",
    description:
      "Phrase-level syntax trees for every sentence in the Greek New Testament.",
  },
  {
    icon: <Cross className="h-4 w-4" />,
    title: "Cross-references",
    description:
      "Automated thematic and lexical cross-references across the entire biblical corpus.",
  },
  {
    icon: <Layers className="h-4 w-4" />,
    title: "Sermon Integration",
    description:
      "One-click push of any verse or word study into your active sermon outline.",
  },
];
