import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Calculator, CheckCircle2, AlertTriangle, Send, Zap, PiggyBank, Timer } from 'lucide-react';
import { api } from '../api.js';
import { formatINR, systemTypeLabel } from '../utils/format.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

const gridOptions = [
  { value: 'RELIABLE', label: 'Reliable', hint: 'Power cuts are rare' },
  { value: 'FREQUENT_CUTS', label: 'Frequent cuts', hint: 'Cuts most days' },
  { value: 'NO_GRID', label: 'No grid', hint: 'No electricity connection' },
];

const cardClass = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6';
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';
const inputClass =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400';

export default function Enquiry() {
  const [sizing, setSizing] = useState({ monthlyBill: '', roofAreaSqft: '', gridReliability: 'RELIABLE' });
  const [contact, setContact] = useState({
    name: '', phone: '', email: '', address: '', city: '', pincode: '', wantsSubsidy: false,
  });
  const [estimate, setEstimate] = useState(null);   // result from /estimate
  const [submitted, setSubmitted] = useState(null); // result from /enquiry
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Changing any sizing input clears the old estimate, so it's never out of date
  function updateSizing(field, value) {
    setSizing({ ...sizing, [field]: value });
    setEstimate(null);
  }

  function updateContact(e) {
    const { name, value, type, checked } = e.target;
    setContact({ ...contact, [name]: type === 'checkbox' ? checked : value });
  }

  async function getEstimate(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api('/public/estimate', { method: 'POST', body: sizing });
      setEstimate(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitEnquiry(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api('/public/enquiry', { method: 'POST', body: { ...sizing, ...contact } });
      setSubmitted(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* ---------- Top bar ---------- */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto flex items-center gap-2 px-4 py-3">
          <Sun className="text-amber-500" size={26} />
          <span className="text-lg font-semibold">TerraVolt</span>
          <div className="ml-auto flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-500 dark:text-slate-400 hover:text-amber-600">Staff login</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {submitted ? (
          /* ---------- Thank-you screen ---------- */
          <div className={`${cardClass} text-center space-y-3`}>
            <CheckCircle2 className="mx-auto text-green-600" size={48} />
            <h1 className="text-2xl font-semibold">Thank you, {contact.name.split(' ')[0]}!</h1>
            <p className="text-slate-600 dark:text-slate-300">
              Your enquiry reference is <strong className="font-mono">{submitted.reference}</strong>.
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              Our team will call you within one working day to book a free site survey.
              Your final quotation will be prepared after the survey.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">How much solar does your home need?</h1>
              <p className="text-slate-600 dark:text-slate-400">
                Answer three questions to get an instant estimate. No sign-up needed.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* ---------- Step 1: sizing questions ---------- */}
            <form onSubmit={getEstimate} className={`${cardClass} space-y-5`}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="monthlyBill" className={labelClass}>Average monthly electricity bill (₹)</label>
                  <input id="monthlyBill" type="number" min="1" required inputMode="numeric"
                    placeholder="e.g. 3000" value={sizing.monthlyBill}
                    onChange={(e) => updateSizing('monthlyBill', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="roofAreaSqft" className={labelClass}>Shadow-free roof area (sq ft)</label>
                  <input id="roofAreaSqft" type="number" min="1" required inputMode="numeric"
                    placeholder="e.g. 350" value={sizing.roofAreaSqft}
                    onChange={(e) => updateSizing('roofAreaSqft', e.target.value)} className={inputClass} />
                </div>
              </div>

              <fieldset>
                <legend className={labelClass}>How reliable is your electricity supply?</legend>
                <div className="grid sm:grid-cols-3 gap-3">
                  {gridOptions.map((option) => {
                    const selected = sizing.gridReliability === option.value;
                    return (
                      <button key={option.value} type="button"
                        onClick={() => updateSizing('gridReliability', option.value)}
                        aria-pressed={selected}
                        className={`text-left rounded-lg border px-4 py-3 transition ${
                          selected
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-500'
                            : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}>
                        <span className="block font-medium">{option.label}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{option.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <button type="submit" disabled={busy}
                className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-900 font-medium px-5 py-2.5">
                <Calculator size={18} />
                {busy && !estimate ? 'Calculating…' : 'Get my estimate'}
              </button>
            </form>

            {/* ---------- Step 2: the estimate ---------- */}
            {estimate && !estimate.feasible && (
              <div className="flex gap-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-5">
                <AlertTriangle className="text-amber-600 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">{estimate.reason}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    You can still send your details below. Our team will check other options for you.
                  </p>
                </div>
              </div>
            )}

            {estimate && estimate.feasible && (
              <div className={`${cardClass} space-y-5`}>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Recommended for you</p>
                  <h2 className="text-2xl font-bold">
                    {estimate.kw} kW {systemTypeLabel[estimate.systemType]} system
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Based on about {estimate.monthlyUnits} units of electricity a month
                    {estimate.systemType === 'OFF_GRID' && ', with batteries for power cuts'}
                  </p>
                </div>

                {estimate.limitedByRoof && (
                  <p className="text-sm rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2">
                    Your usage needs about {estimate.kwByUnits} kW, but your roof area fits {estimate.kwByRoof} kW.
                  </p>
                )}

                <div className="grid sm:grid-cols-3 gap-3">
                  <Stat icon={Zap} label="Approx. price (incl. GST)" value={formatINR(estimate.price.total)} />
                  <Stat icon={PiggyBank} label="Estimated saving" value={`${formatINR(estimate.savings.monthlySaving)}/month`} />
                  <Stat icon={Timer} label="Pays for itself in" value={estimate.savings.paybackYears ? `${estimate.savings.paybackYears} years` : '—'} />
                </div>

                <div>
                  <p className="text-sm font-medium mb-1">Main parts in this kit</p>
                  <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-0.5">
                    {estimate.kit.highlights.map((item) => (
                      <li key={item.name}>{item.qty} × {item.name}</li>
                    ))}
                    <li>Mounting structure, wiring, safety equipment and installation</li>
                  </ul>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This is an estimate. The final price is confirmed after a free site survey of your roof.
                </p>
              </div>
            )}

            {/* ---------- Step 3: contact details ---------- */}
            {estimate && (
              <form onSubmit={submitEnquiry} className={`${cardClass} space-y-4`}>
                <h2 className="text-lg font-semibold">Book a free site survey</h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className={labelClass}>Full name</label>
                    <input id="name" name="name" required value={contact.name} onChange={updateContact} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="phone" className={labelClass}>Mobile number</label>
                    <input id="phone" name="phone" type="tel" required inputMode="numeric" placeholder="10-digit mobile"
                      value={contact.phone} onChange={updateContact} className={inputClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="address" className={labelClass}>Installation address</label>
                    <input id="address" name="address" required value={contact.address} onChange={updateContact} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="city" className={labelClass}>City</label>
                    <input id="city" name="city" value={contact.city} onChange={updateContact} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="pincode" className={labelClass}>Pincode</label>
                    <input id="pincode" name="pincode" inputMode="numeric" maxLength={6}
                      value={contact.pincode} onChange={updateContact} className={inputClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="email" className={labelClass}>Email (optional)</label>
                    <input id="email" name="email" type="email" value={contact.email} onChange={updateContact} className={inputClass} />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="wantsSubsidy" checked={contact.wantsSubsidy} onChange={updateContact}
                    className="h-4 w-4 accent-amber-500" />
                  I want help applying for the government solar subsidy
                </label>

                <button type="submit" disabled={busy}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-900 font-medium px-5 py-2.5">
                  <Send size={18} />
                  {busy ? 'Sending…' : 'Request free site survey'}
                </button>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Small box showing one number with an icon
function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-4">
      <Icon size={18} className="text-amber-500 mb-1" />
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}