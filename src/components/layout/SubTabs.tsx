export interface SubTabDef {
  key: string;
  label: string;
  icon?: any;
  hidden?: boolean;
}

export function SubTabs({
  tabs,
  active,
  onChange,
  right,
}: {
  tabs: SubTabDef[];
  active: string;
  onChange: (k: string) => void;
  right?: React.ReactNode;
}) {
  const visible = tabs.filter(t => !t.hidden);
  return (
    <div className="flex items-center gap-1 px-4 pt-2 border-b border-line/60 bg-bg-800/40">
      {visible.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 px-3 py-2 text-[12px] border-b-2 transition-colors ${
            active === key
              ? 'border-brand text-brand font-medium'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          {Icon && <Icon size={13} />}
          <span>{label}</span>
        </button>
      ))}
      {right && <div className="ml-auto pb-2">{right}</div>}
    </div>
  );
}
