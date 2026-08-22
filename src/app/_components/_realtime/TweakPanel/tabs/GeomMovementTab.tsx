import { useState } from "react";
import * as THREE from "three";
import GeomContainerEntity from "_realtime/geom/GeomContainerEntity";
import ConfigSliders from "../fields/ConfigSliders";
import Vector3Field, { Axis } from "../fields/Vector3Field";
import { geomMovementScalarDefs, geomMovementVectorDefs } from "../paramDefs";

type VecValues = Record<string, { x: number; y: number; z: number }>;

const GeomMovementTab = ({
    geomContainer,
}: {
    geomContainer: GeomContainerEntity;
}): JSX.Element => {
    const [vecValues, setVecValues] = useState<VecValues>(() => {
        const seed: VecValues = {};
        for (const key of Object.keys(geomMovementVectorDefs)) {
            const vec = (geomContainer.config as unknown as Record<string, THREE.Vector3>)[key];
            seed[key] = { x: vec.x, y: vec.y, z: vec.z };
        }
        return seed;
    });

    const setVec = (key: string, axis: Axis, v: number) => {
        // Mutate the component in place — the config holds live Vector3 instances
        (geomContainer.config as unknown as Record<string, THREE.Vector3>)[key][axis] = v;
        setVecValues(prev => ({ ...prev, [key]: { ...prev[key], [axis]: v } }));
    };

    return (
        <div>
            <ConfigSliders geomContainer={geomContainer} defs={geomMovementScalarDefs} />
            {Object.entries(geomMovementVectorDefs).map(([key, def]) => (
                <Vector3Field
                    key={key}
                    def={def}
                    value={vecValues[key]}
                    onChange={(axis, v) => setVec(key, axis, v)}
                />
            ))}
        </div>
    );
};

export default GeomMovementTab;
