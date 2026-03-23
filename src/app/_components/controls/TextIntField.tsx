const TextIntField = ({
    className,
    label,
    value,
    onChange,
    type = "text",
}: {
    className?: string;
    label: string;
    value?: number;
    onChange?: (value: number) => void;
    type?: string;
}): JSX.Element => {
    return (
        <div className={`w-full flex items-center ${className}`}>
            <label className="w-24">{label}</label>
            <input
                type={type}
                className="flex-grow bg-gray-700 rounded px-2 py-1"
                value={value?.toString() || ""}
                onChange={e => {
                    if (onChange) onChange(e.target.value ? parseInt(e.target.value) : 0);
                }}
            />
        </div>
    );
};

export default TextIntField;
