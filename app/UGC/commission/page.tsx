"use client";

import { useState } from "react";

const initialRates = [10, 8, 5];

export default function UGCCommissionPage() {
  const [rates, setRates] = useState(initialRates);
  const [savedRates, setSavedRates] = useState(initialRates);
  const [editing, setEditing] = useState(false);

  const updateRate = (index: number, value: string) => {
    const nextValue = Math.min(100, Math.max(0, Number(value) || 0));
    setRates((current) => current.map((rate, rateIndex) => rateIndex === index ? nextValue : rate));
  };

  const saveChanges = () => {
    setSavedRates(rates);
    setEditing(false);
  };

  const cancelChanges = () => {
    setRates(savedRates);
    setEditing(false);
  };

  return (
    <main className="ml-60 min-h-screen bg-[#f8fafc] px-5 pb-12 pt-[108px] text-[#27313b] md:px-10">
      <div className="mx-auto max-w-5xl">
        <header>
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#17212b]">Commissions</h1>
          <p className="mt-1 text-sm text-[#8b949e]">Commission structure and affiliate hierarchy</p>
        </header>

        <section className="mt-6 flex gap-3 rounded-xl border border-[#f1cdd2] bg-[#fff3f4] px-4 py-4 text-sm text-[#71313b]">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#9b1c32] text-xs font-bold text-white">!</span>
          <div>
            <p className="font-bold">Commission applies to the first 3 orders only</p>
            <p className="mt-1 leading-5">Affiliates earn commission on the 1st, 2nd, and 3rd order each referred customer places. No commission is earned on the 4th order onwards.</p>
          </div>
        </section>

        <section data-viewer-write className="mt-5 overflow-hidden rounded-xl border border-[#dfe5ea] bg-white shadow-[0_2px_6px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between bg-[#951d2c] px-5 py-4 text-white">
            <div>
              <h2 className="text-sm font-bold">Commission Rate Settings</h2>
              <p className="mt-1 text-xs text-white/80">Rate applies per order number placed by each referred customer</p>
            </div>
            {editing ? (
              <div className="flex items-center gap-3">
                <button type="button" onClick={cancelChanges} className="text-xs font-semibold text-white/85 hover:text-white">Cancel</button>
                <button type="button" onClick={saveChanges} className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-[#7f1829] hover:bg-[#fff2f3]">✓ Save Changes</button>
              </div>
            ) : (
              <button type="button" onClick={() => setEditing(true)} className="rounded-lg bg-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/25">✎ Edit Rates</button>
            )}
          </div>

          <div>
            {rates.map((rate, index) => (
              <div key={index} className="grid min-h-[72px] grid-cols-[125px_minmax(240px,1fr)_72px] items-center gap-5 border-b border-[#edf0f2] px-5 py-3 sm:grid-cols-[145px_minmax(300px,1fr)_72px]">
                <div>
                  <p className="text-sm font-bold text-[#35404a]">{index + 1}{index === 0 ? "st" : index === 1 ? "nd" : "rd"} Order</p>
                  <p className="mt-1 text-[11px] text-[#a0a8af]">per customer</p>
                </div>
                <div className="min-w-0">
                  <input type="range" min="0" max="100" value={rate} disabled={!editing} onChange={(event) => updateRate(index, event.target.value)} className="commission-range w-full" style={{ accentColor: index === 0 ? "#08b77b" : index === 1 ? "#f59e0b" : "#f97316" }} aria-label={`${index + 1} order commission rate`} />
                </div>
                {editing ? (
                  <label className="flex items-center gap-1"><input type="number" min="0" max="100" value={rate} onChange={(event) => updateRate(index, event.target.value)} className="h-9 w-16 rounded-lg border border-[#dfe5ea] px-2 text-center text-sm font-bold text-[#35404a] outline-none focus:border-[#09b77c]" aria-label={`${index + 1} order percentage`} /><span className="text-sm text-[#7c858d]">%</span></label>
                ) : <span className="text-right text-sm font-bold text-[#19815e]">{rate}%</span>}
              </div>
            ))}

            <div className="grid min-h-[72px] grid-cols-[125px_minmax(240px,1fr)_72px] items-center gap-5 border-b border-[#edf0f2] px-5 py-3 sm:grid-cols-[145px_minmax(300px,1fr)_72px]">
              <div><p className="text-sm font-bold text-[#35404a]">4th Order+</p><p className="mt-1 text-[11px] text-[#a0a8af]">no commission</p></div>
              <div className="h-2 rounded-full bg-[#f0f2f4]" />
              <span className="text-right text-sm font-bold text-[#b6bdc3]">0%</span>
            </div>
          </div>

          {editing && <div className="bg-[#fffbea] px-5 py-3 text-xs text-[#a56a2b]">Changes apply immediately to all commission calculations across Orders, Reports, and drill-down views.</div>}
          <footer className="flex flex-wrap items-center justify-between gap-3 bg-[#f8fafc] px-5 py-4 text-xs text-[#69747e]">
            <span className="font-mono">Order Amount × Rate = Commission</span>
            <span className="flex gap-4"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#08b77b]" />1st: {rates[0]}%</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#f59e0b]" />2nd: {rates[1]}%</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#f97316]" />3rd: {rates[2]}%</span></span>
          </footer>
        </section>
      </div>
    </main>
  );
}
