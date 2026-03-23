const TextField = ({
    className,
    label,
    value,
    placeholder = "",
    onChange,
    onFocus,
    onBlur,
    onEnter,
    type = "text",
}: {
    className?: string;
    label: string;
    value: string;
    placeholder?: string;
    onChange?: (value: string) => void;
    type?: string;
    onFocus?: () => void;
    onBlur?: () => void;
    onEnter?: () => void;
}): JSX.Element => {
    return (
        <div className={`w-full flex flex-col ${className}`}>
            <label className="text-xs text-neutral-400">{label}</label>
            <input
                type={type}
                className="flex-grow bg-neutral-700 rounded px-2 py-1"
                value={value}
                onChange={e => {
                    if (onChange) onChange(e.target.value);
                }}
                onFocus={onFocus}
                onBlur={onBlur}
                onKeyDown={e => {
                    if (e.key === "Enter" && onEnter) onEnter();
                }}
                placeholder={placeholder}
            />
        </div>
    );
};

export default TextField;
