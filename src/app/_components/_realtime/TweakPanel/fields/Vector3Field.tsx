import NumberSliderField from "./NumberSliderField";
import { Vec3Def } from "../paramDefs";

export type Axis = "x" | "y" | "z";
const AXES: Axis[] = ["x", "y", "z"];

const Vector3Field = ({
    def,
    value,
    onChange,
}: {
    def: Vec3Def;
    value: { x: number; y: number; z: number };
    onChange: (axis: Axis, v: number) => void;
}): JSX.Element => {
    return (
        <div className="mb-2">
            <label className="text-white text-opacity-70 text-xs">{def.label}</label>
            <div className="pl-3">
                {AXES.map((axis, i) => (
                    <NumberSliderField
                        key={axis}
                        def={def.axes[i]}
                        value={value[axis]}
                        onChange={v => onChange(axis, v)}
                    />
                ))}
            </div>
        </div>
    );
};

export default Vector3Field;
