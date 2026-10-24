export const TIME_OPTIONS_24H = [];
for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, '0');
  TIME_OPTIONS_24H.push(`${hh}:00`);
  TIME_OPTIONS_24H.push(`${hh}:30`);
}
TIME_OPTIONS_24H.push('24:00');

export function formatTime24(timeStr) {
  if (!timeStr) return '';
  return String(timeStr).slice(0, 5);
}

export default function TimeSelect24({
  value,
  onChange,
  className = '',
  required = false,
  disabled = false,
}) {
  const normVal = value ? String(value).slice(0, 5) : '';
  const options = [...TIME_OPTIONS_24H];
  if (normVal && !options.includes(normVal)) {
    options.push(normVal);
    options.sort();
  }

  return (
    <select
      value={normVal}
      onChange={onChange}
      required={required}
      disabled={disabled}
      className={`px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer ${className}`}
    >
      <option value="">--:--</option>
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
