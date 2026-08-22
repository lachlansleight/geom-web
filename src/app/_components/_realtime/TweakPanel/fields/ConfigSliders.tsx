import { useState } from "react";
import GeomContainerEntity from "_realtime/geom/GeomContainerEntity";
import { ParamDef } from "../paramDefs";
import NumberSliderField from "./NumberSliderField";

/**
 * Renders one slider per def, seeded from geomContainer.config on mount and
 * writing straight back into it on change (picked up by the GPU next frame).
 * Remount (via key) to re-seed after a pattern switch or reset.
 */
const ConfigSliders = ({
    geomContainer,
    defs,
}: {
    geomContainer: GeomContainerEntity;
    defs: Record<string, ParamDef>;
}): JSX.Element => {
    const [values, setValues] = useState<Record<string, number>>(() => {
        const seed: Record<string, number> = {};
        for (const key of Object.keys(defs)) {
            seed[key] = (geomContainer.config as unknown as Record<string, number>)[key] ?? 0;
        }
        return seed;
    });

    const set = (key: string, v: number) => {
        (geomContainer.config as unknown as Record<string, number>)[key] = v;
        setValues(prev => ({ ...prev, [key]: v }));
    };

    return (
        <div>
            {Object.entries(defs).map(([key, def]) => (
                <NumberSliderField
                    key={key}
                    def={def}
                    value={values[key]}
                    onChange={v => set(key, v)}
                />
            ))}
        </div>
    );
};

export default ConfigSliders;
