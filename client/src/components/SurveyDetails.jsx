import { formatDate } from '../utils/format.js';

export default function SurveyDetails({ survey }) {
  const rows = [
    ['Roof faces', survey.roofDirection],
    ['Roof type', survey.roofType],
    ['Tilt', survey.tiltDeg != null ? `${Number(survey.tiltDeg)}°` : null],
    ['Cable run', survey.cableDistanceM != null ? `${Number(survey.cableDistanceM)} m` : null],
    ['Usable roof', survey.measuredRoofSqft != null ? `${survey.measuredRoofSqft} sq ft` : null],
    ['Recommended size', survey.recommendedKw != null ? `${survey.recommendedKw} kW` : null],
    ['Submitted', survey.submittedAt ? formatDate(survey.submittedAt, true) : null],
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-100">{value ?? '—'}</dd>
          </div>
        ))}
      </dl>

      {survey.notes && (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          {survey.notes}
        </p>
      )}

      {survey.photos?.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {survey.photos.map((src) => (
            <a key={src} href={src} target="_blank" rel="noreferrer">
              <img
                src={src}
                alt="Roof photo"
                className="aspect-square w-full rounded-lg border border-slate-200 object-cover dark:border-slate-800"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}