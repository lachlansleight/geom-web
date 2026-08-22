import type { OscillatorDef } from "_realtime/geom/patterns/GeomPattern";
import NumberSliderField from "./NumberSliderField";
import { OscDef } from "../paramDefs";

export type OscField = "center" | "amplitude" | "period" | "phase";
const FIELDS: OscField[] = ["center", "amplitude", "period", "phase"];

const OscillatorField = ({
    def,
    value,
    onChange,
}: {
    def: OscDef;
    value: OscillatorDef;
    onChange: (field: OscField, v: number) => void;
}): JSX.Element => {
    return (
        <div className="mb-2">
            <label className="text-white text-opacity-70 text-xs">{def.label}</label>
            <div className="pl-3">
                {FIELDS.map(field => (
                    <NumberSliderField
                        key={field}
                        def={def[field]}
                        value={value[field]}
                        onChange={v => onChange(field, v)}
                    />
                ))}
            </div>
        </div>
    );
};

export default OscillatorField;
