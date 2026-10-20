const commissionTiers = [
  { order: "1st Order", rate: "10%", color: "#08b77b" },
  { order: "2nd Order", rate: "8%", color: "#f59e0b" },
  { order: "3rd Order", rate: "5%", color: "#f97316" },
  { order: "4th Order+", rate: "Not eligible", color: "#9aa1a7" },
];

export default function UGCCommissionPage() {
  return (
    <main className="ml-60 min-h-screen bg-[#f8fafc] px-5 pb-12 pt-[108px] text-[#27313b] md:px-10">
      <div className="mx-auto max-w-5xl">
        <header>
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#17212b]">Commissions</h1>
          <p className="mt-1 text-sm text-[#8b949e]">Commission structure and affiliate hierarchy</p>
        </header>

        <section className="mt-6 rounded-xl border border-[#f1cdd2] bg-[#fff3f4] px-4 py-4 text-sm text-[#71313b]">
          Commission rates are defined by the backend. The documented affiliate API does not provide an endpoint to change them.
        </section>

        <section className="mt-5 overflow-hidden rounded-xl border border-[#dfe5ea] bg-white shadow-[0_2px_6px_rgba(15,23,42,0.04)]">
          <div className="bg-[#951d2c] px-5 py-4 text-white">
            <h2 className="text-sm font-bold">Commission Rate Schedule</h2>
            <p className="mt-1 text-xs text-white/80">Applied to each invited customer&apos;s eligible order sequence</p>
          </div>
          <div>
            {commissionTiers.map((tier) => (
              <div key={tier.order} className="flex min-h-[72px] items-center justify-between border-b border-[#edf0f2] px-5 py-3 last:border-0">
                <p className="text-sm font-bold text-[#35404a]">{tier.order}</p>
                <span className="text-sm font-bold" style={{ color: tier.color }}>{tier.rate}</span>
              </div>
            ))}
          </div>
          <footer className="bg-[#f8fafc] px-5 py-4 text-xs text-[#69747e]">
            These are the fixed tiers documented by the backend: 10%, 8%, and 5% for the first three eligible orders. Later orders earn no commission.
          </footer>
        </section>
      </div>
    </main>
  );
}
