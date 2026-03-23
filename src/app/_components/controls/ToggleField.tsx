import Toggle from "./Toggle";

const ToggleField = ({
    className,
    label,
    value,
    onChange,
}: {
    className?: string;
    label: string;
    value: boolean;
    onChange?: (value: boolean) => void;
}): JSX.Element => {
    return (
        <div className={`w-full flex flex-col ${className}`}>
            <label className="text-xs text-neutral-400">{label}</label>
            <Toggle value={value} onChange={onChange} />
        </div>
    );
};

export default ToggleField;
