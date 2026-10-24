export default function ExpandableAddButton({ label, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || label}
      className="group relative flex items-center h-10 px-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-sm hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer overflow-hidden border border-emerald-500/30"
    >
      <span className="text-xl font-black leading-none select-none transition-transform duration-300 group-hover:rotate-90">
        +
      </span>
      <span className="max-w-0 opacity-0 group-hover:max-w-[220px] group-hover:opacity-100 group-hover:ml-2 transition-all duration-300 ease-in-out whitespace-nowrap text-xs font-extrabold select-none">
        {label}
      </span>
    </button>
  );
}
