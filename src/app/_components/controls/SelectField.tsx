const SelectField = ({
    className,
    label,
    value,
    onChange,
    options,
}: {
    className?: string;
    label: string;
    value: string;
    onChange?: (value: string) => void;
    options: { value: string; label: string }[];
}): JSX.Element => {
    return (
        <div className={`w-full flex flex-col ${className}`}>
            <label className="text-xs text-neutral-400">{label}</label>
            <select
                className="flex-grow bg-neutral-700 rounded px-2 py-1 text-white"
                value={options.find(o => o.value === value)?.value || ""}
                onChange={v => {
                    if (onChange)
                        onChange(options.find(o => v.target.value === o.value)?.value || "");
                }}
            >
                {options.map((o, i) => {
                    return (
                        <option key={i} value={o.value}>
                            {o.label}
                        </option>
                    );
                })}
            </select>
        </div>
    );
};

export default SelectField;
