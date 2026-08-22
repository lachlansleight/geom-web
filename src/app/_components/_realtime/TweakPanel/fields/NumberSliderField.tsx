import Slider from "_components/controls/Slider";
import { ParamDef } from "../paramDefs";

/**
 * Compact SliderField variant driven by a ParamDef: formatted value readout,
 * int rounding, and step-size → Slider step-count conversion.
 */
const NumberSliderField = ({
    def,
    value,
    onChange,
    onCommit,
    disabled,
}: {
    def: ParamDef;
    value: number;
    onChange: (v: number) => void;
    /** Fires on slider release — use for expensive/reshuffling applies. */
    onCommit?: () => void;
    disabled?: boolean;
}): JSX.Element => {
    const steps = def.step ? Math.round((def.max - def.min) / def.step) : undefined;
    const display = def.int ? Math.round(value).toString() : value.toFixed(def.decimals ?? 2);

    return (
        <div className="flex flex-col mb-1">
            <div className="flex justify-between">
                <label className="text-white text-opacity-50 text-xs">{def.label}</label>
                <span className="text-xs text-white text-opacity-80">{display}</span>
            </div>
            <Slider
                value={value}
                min={def.min}
                max={def.max}
                steps={steps}
                disabled={disabled}
                trackSize="0.25rem"
                knobSize="0.75rem"
                onChange={v => onChange(def.int ? Math.round(v) : v)}
                onStopEdit={onCommit}
            />
        </div>
    );
};

export default NumberSliderField;
