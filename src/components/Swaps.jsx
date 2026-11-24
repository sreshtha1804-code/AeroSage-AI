import { useState } from 'react';
import { applianceSavings, reusableComparison } from '../lib/impact.js';
import { NumberField } from './common.jsx';

const Box = ({ title, value }) => (
  <div className="rounded-xl bg-navy-900 p-3 text-center">
    <div className="text-xs text-slate-300">{title}</div>
    <div className="text-lg font-bold text-leaf">{value}</div>
  </div>
);

export default function Swaps() {
  const [r, setR] = useState({
    disposableCost: 2,
    usesPerMonth: 60,
    reusablePrice: 300,
    reusableLifetime: 500,
  });
  const [a, setA] = useState({
    conventionalW: 1500,
    efficientW: 900,
    hoursPerDay: 6,
    tariff: 8,
    extraPrice: 8000,
    gridFactor: 0.7,
  });
  const setR1 = (k) => (v) => setR((s) => ({ ...s, [k]: v }));
  const setA1 = (k) => (v) => setA((s) => ({ ...s, [k]: v }));
  const rc = reusableComparison(r);
  const ap = applianceSavings(a);

  return (
    <>
      <section className="card">
        <h2 className="font-semibold text-teal-300">Disposable vs reusable (cost)</h2>
        <p className="mb-2 text-xs text-amber-200">
          All inputs are your own assumptions. Environmental benefit: fewer single-use items means
          less plastic waste and less temptation to burn it; we don&apos;t state a precise figure
          because it depends on the item.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <NumberField
            label="Disposable ₹/item"
            value={r.disposableCost}
            onChange={setR1('disposableCost')}
            step={0.5}
          />
          <NumberField
            label="Uses per month"
            value={r.usesPerMonth}
            onChange={setR1('usesPerMonth')}
          />
          <NumberField
            label="Reusable price ₹"
            value={r.reusablePrice}
            onChange={setR1('reusablePrice')}
          />
          <NumberField
            label="Reusable lifetime (uses)"
            value={r.reusableLifetime}
            onChange={setR1('reusableLifetime')}
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Box title="Disposable / month" value={`₹${rc.disposableMonthly.toFixed(0)}`} />
          <Box title="Reusable / month" value={`₹${rc.reusableMonthly.toFixed(0)}`} />
          <Box
            title="Break-even after"
            value={rc.breakEvenUses === null ? '–' : `${rc.breakEvenUses} uses`}
          />
        </div>
      </section>
      <section className="card">
        <h2 className="font-semibold text-teal-300">Energy-efficient vs conventional appliance</h2>
        <p className="mb-2 text-xs text-amber-200">
          Use wattage from the product label. Grid factor 0.7 kg CO₂/kWh and tariff ₹8/kWh are
          placeholders; replace with your electricity bill and an official grid emission factor.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <NumberField
            label="Conventional (W)"
            value={a.conventionalW}
            onChange={setA1('conventionalW')}
          />
          <NumberField label="Efficient (W)" value={a.efficientW} onChange={setA1('efficientW')} />
          <NumberField
            label="Hours/day"
            value={a.hoursPerDay}
            onChange={setA1('hoursPerDay')}
            step={0.5}
          />
          <NumberField
            label="Tariff ₹/kWh"
            value={a.tariff}
            onChange={setA1('tariff')}
            step={0.5}
          />
          <NumberField label="Extra price ₹" value={a.extraPrice} onChange={setA1('extraPrice')} />
          <NumberField
            label="Grid kg CO₂/kWh"
            value={a.gridFactor}
            onChange={setA1('gridFactor')}
            step={0.05}
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <Box title="kWh saved/month" value={ap.kwh.toFixed(0)} />
          <Box title="₹ saved/month" value={`₹${ap.rupees.toFixed(0)}`} />
          <Box
            title="Payback"
            value={ap.paybackMonths === null ? '–' : `${ap.paybackMonths.toFixed(1)} mo`}
          />
          <Box title="Est. CO₂ saved/month" value={`${ap.co2.toFixed(0)} kg`} />
        </div>
        <p className="mt-2 text-xs text-slate-300">
          Why it matters: less electricity drawn means less fuel burned at power plants, cutting CO₂
          and particulate emissions at source. Estimates only.
        </p>
      </section>
    </>
  );
}
