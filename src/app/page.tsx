import Link from "next/link";
import { Scale, ShieldCheck, Zap, Globe, ArrowRight, CheckCircle2 } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen grid-bg">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-procurement-blue/10 border border-procurement-blue/30 text-xs font-mono text-ledger-cyan mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-compliance-green animate-pulse-slow" />
          Powered by GenLayer StudioNet
        </div>

        <h1 className="font-accent text-5xl sm:text-6xl lg:text-7xl text-paper-white leading-tight mb-6">
          Do not award to the
          <br />
          <span className="text-risk-red line-through opacity-50">cheapest bid.</span>
          <br />
          <span className="text-award-gold">Award to the best-value bid.</span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg text-slate-grey leading-relaxed mb-10">
          Procurement Consensus uses GenLayer validators to compare supplier proposals by quality,
          price, delivery, compliance, and risk — then produces a transparent award recommendation.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/rounds/create"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-procurement-blue text-paper-white font-display font-semibold text-base hover:bg-blue-600 hover:shadow-[0_0_24px_rgba(29,78,216,0.5)] transition-all"
          >
            Create Procurement Round
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/rounds"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-ledger-cyan/30 text-ledger-cyan font-display font-semibold text-base hover:bg-ledger-cyan/10 hover:border-ledger-cyan transition-all"
          >
            View Bid Board
          </Link>
        </div>
      </section>

      {/* Positioning copy */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="panel p-8 sm:p-12 text-center border-ledger-cyan/20">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ledger-cyan/40 to-transparent" />
          <p className="font-display text-xl sm:text-2xl text-paper-white font-semibold mb-2">
            Procurement is judgement, not arithmetic.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-slate-grey mt-4 text-sm">
            <span>Lowest price can hide delivery risk.</span>
            <span className="hidden sm:block text-procurement-blue">·</span>
            <span>Strong compliance can justify higher cost.</span>
            <span className="hidden sm:block text-procurement-blue">·</span>
            <span>GenLayer lets validators compare the full proposal, not just the number.</span>
          </div>
        </div>
      </section>

      {/* Why GenLayer */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl text-paper-white mb-3">
            Why Traditional Smart Contracts Fail at Procurement
          </h2>
          <p className="text-slate-grey max-w-xl mx-auto">
            Procurement decisions require human-level judgement. Normal contracts can only check numbers.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Cannot evaluate */}
          <div className="panel p-6 border-risk-red/20">
            <h3 className="font-display font-semibold text-base text-risk-red mb-3">
              Normal contracts cannot interpret:
            </h3>
            <ul className="space-y-2">
              {[
                "Quality evidence and track record",
                "Technical compliance against specifications",
                "Delivery feasibility assessment",
                "Warranty strength and coverage",
                "Certification relevance",
                "Bidder risk and financial stability",
                "Conflicting proposal claims",
                "Best-value tradeoffs between criteria",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-grey">
                  <span className="text-risk-red mt-0.5 shrink-0">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* GenLayer can */}
          <div className="panel p-6 border-compliance-green/20">
            <h3 className="font-display font-semibold text-base text-compliance-green mb-3">
              GenLayer validators can evaluate:
            </h3>
            <ul className="space-y-2">
              {[
                "Price reasonableness relative to quality",
                "Specification fit and technical completeness",
                "Delivery credibility and timeline",
                "Compliance evidence strength",
                "Warranty and support terms",
                "Evidence URL relevance",
                "Supplier risk level",
                "Overall best-value tradeoff under stated criteria",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-paper-white">
                  <CheckCircle2 size={14} className="text-compliance-green mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Scale,
              color: "text-ledger-cyan",
              title: "Best-Value Logic",
              desc: "Evaluates quality, compliance, delivery, and risk — not just price.",
            },
            {
              icon: Zap,
              color: "text-award-gold",
              title: "Validator Consensus",
              desc: "Multiple GenLayer validators compare bids independently and reach consensus.",
            },
            {
              icon: ShieldCheck,
              color: "text-compliance-green",
              title: "Equivalence Principle",
              desc: "Validators may differ in wording but agree on canonical procurement meaning.",
            },
            {
              icon: Globe,
              color: "text-procurement-blue",
              title: "Public Trail",
              desc: "Every recommendation, appeal, and finalization is on-chain and auditable.",
            },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="panel panel-hover p-5">
              <Icon size={20} className={`${color} mb-3`} />
              <h4 className="font-display font-semibold text-sm text-paper-white mb-1.5">{title}</h4>
              <p className="text-xs text-slate-grey leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo CTA */}
      <section className="border-t border-procurement-blue/20 py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="font-display font-bold text-2xl text-paper-white mb-3">
            See It In Action
          </h2>
          <p className="text-slate-grey mb-8">
            Run the Ambulance Fleet Procurement demo — 3 competing bids, one consensus award.
          </p>
          <Link
            href="/rounds"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-award-gold text-midnight-navy font-display font-bold text-base hover:bg-yellow-400 hover:shadow-[0_0_24px_rgba(245,184,65,0.4)] transition-all"
          >
            Open Demo Evaluation
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
