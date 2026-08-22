import { useRef, useState } from "react";
import GeomContainerEntity from "_realtime/geom/GeomContainerEntity";
import type { ShufflerConfig } from "_realtime/geom/animation/OscillatorShuffler";
import Foldout from "_components/controls/Foldout";
import ToggleField from "_components/controls/ToggleField";
import NumberSliderField from "../fields/NumberSliderField";
import { ANIMATOR_NAMES, animatorAbsRanges, animatorSharedDefs } from "../paramDefs";

type AnimatorState = {
    interpolationPeriodMin: number;
    interpolationPeriodMax: number;
    shuffler: ShufflerConfig;
};

type AllState = Record<string, AnimatorState>;

// Fields applied on slider release (applyAnimatorConfigs reshuffles on every
// call, so per-tick application would prevent transitions from completing).
type ShufflerNumberKey =
    | "absoluteMin"
    | "absoluteMax"
    | "maxChangePerSecond"
    | "minFrequency"
    | "maxFrequency"
    | "freezeChance"
    | "sawtoothChance";

const AnimationTab = ({ geomContainer }: { geomContainer: GeomContainerEntity }): JSX.Element => {
    const [state, setState] = useState<AllState>(() => {
        const seed: AllState = {};
        for (const name of ANIMATOR_NAMES) {
            const interp = geomContainer.animator.interpolators.get(name);
            if (!interp) continue;
            seed[name] = {
                interpolationPeriodMin: interp.interpolatorConfig.interpolationPeriodMin,
                interpolationPeriodMax: interp.interpolatorConfig.interpolationPeriodMax,
                // shuffler.config is the fully-resolved ShufflerConfig
                shuffler: { ...interp.shuffler.config },
            };
        }
        return seed;
    });

    // onStopEdit fires from a document mouseup — read latest state via ref
    const stateRef = useRef(state);
    stateRef.current = state;

    const apply = (name: string, cfg: AnimatorState) => {
        geomContainer.animator.applyAnimatorConfigs({
            [name]: {
                interpolationPeriodMin: cfg.interpolationPeriodMin,
                interpolationPeriodMax: cfg.interpolationPeriodMax,
                shuffler: cfg.shuffler,
            },
        });
    };

    const commit = (name: string) => apply(name, stateRef.current[name]);

    const editShuffler = (name: string, key: ShufflerNumberKey, v: number) => {
        setState(prev => {
            const shuffler = { ...prev[name].shuffler, [key]: v };
            // Clamp the edited value so pairs stay ordered
            if (key === "absoluteMin") shuffler.absoluteMin = Math.min(v, shuffler.absoluteMax);
            if (key === "absoluteMax") shuffler.absoluteMax = Math.max(v, shuffler.absoluteMin);
            if (key === "minFrequency") shuffler.minFrequency = Math.min(v, shuffler.maxFrequency);
            if (key === "maxFrequency") shuffler.maxFrequency = Math.max(v, shuffler.minFrequency);
            return { ...prev, [name]: { ...prev[name], shuffler } };
        });
    };

    const editPeriod = (name: string, key: "interpolationPeriodMin" | "interpolationPeriodMax", v: number) => {
        setState(prev => {
            const next = { ...prev[name], [key]: v };
            if (key === "interpolationPeriodMin") {
                next.interpolationPeriodMin = Math.min(v, next.interpolationPeriodMax);
            } else {
                next.interpolationPeriodMax = Math.max(v, next.interpolationPeriodMin);
            }
            return { ...prev, [name]: next };
        });
    };

    const setMuted = (name: string, muted: boolean) => {
        const next: AnimatorState = {
            ...state[name],
            shuffler: { ...state[name].shuffler, muted },
        };
        setState(prev => ({ ...prev, [name]: next }));
        apply(name, next); // immediate — toggles shouldn't wait for a slider release
    };

    return (
        <div>
            <p className="text-white text-opacity-40 text-[10px] mb-2">
                these params are animator-driven — pin a value via min=max. sliders apply on
                release. muted settles at the range midpoint over ~2 interp periods.
            </p>
            {ANIMATOR_NAMES.map(name => {
                const cfg = state[name];
                if (!cfg) return null;
                const absRange = animatorAbsRanges[name];
                return (
                    <Foldout
                        key={name}
                        label={`${name}${cfg.shuffler.muted ? " (muted)" : ""}`}
                        labelClassName={
                            cfg.shuffler.muted
                                ? "text-white text-opacity-40 text-xs"
                                : "text-white text-xs"
                        }
                        className="mb-1"
                    >
                        <ToggleField
                            label="muted"
                            value={cfg.shuffler.muted}
                            onChange={v => setMuted(name, v)}
                        />
                        <NumberSliderField
                            def={{ ...animatorSharedDefs.absoluteMin, min: absRange.min, max: absRange.max }}
                            value={cfg.shuffler.absoluteMin}
                            onChange={v => editShuffler(name, "absoluteMin", v)}
                            onCommit={() => commit(name)}
                        />
                        <NumberSliderField
                            def={{ ...animatorSharedDefs.absoluteMax, min: absRange.min, max: absRange.max }}
                            value={cfg.shuffler.absoluteMax}
                            onChange={v => editShuffler(name, "absoluteMax", v)}
                            onCommit={() => commit(name)}
                        />
                        <NumberSliderField
                            def={animatorSharedDefs.maxChangePerSecond}
                            value={cfg.shuffler.maxChangePerSecond}
                            onChange={v => editShuffler(name, "maxChangePerSecond", v)}
                            onCommit={() => commit(name)}
                        />
                        <NumberSliderField
                            def={animatorSharedDefs.minFrequency}
                            value={cfg.shuffler.minFrequency}
                            onChange={v => editShuffler(name, "minFrequency", v)}
                            onCommit={() => commit(name)}
                        />
                        <NumberSliderField
                            def={animatorSharedDefs.maxFrequency}
                            value={cfg.shuffler.maxFrequency}
                            onChange={v => editShuffler(name, "maxFrequency", v)}
                            onCommit={() => commit(name)}
                        />
                        <NumberSliderField
                            def={animatorSharedDefs.freezeChance}
                            value={cfg.shuffler.freezeChance}
                            onChange={v => editShuffler(name, "freezeChance", v)}
                            onCommit={() => commit(name)}
                        />
                        <NumberSliderField
                            def={animatorSharedDefs.interpolationPeriodMin}
                            value={cfg.interpolationPeriodMin}
                            onChange={v => editPeriod(name, "interpolationPeriodMin", v)}
                            onCommit={() => commit(name)}
                        />
                        <NumberSliderField
                            def={animatorSharedDefs.interpolationPeriodMax}
                            value={cfg.interpolationPeriodMax}
                            onChange={v => editPeriod(name, "interpolationPeriodMax", v)}
                            onCommit={() => commit(name)}
                        />
                        {absRange.isIntegrated ? (
                            <NumberSliderField
                                def={animatorSharedDefs.sawtoothChance}
                                value={cfg.shuffler.sawtoothChance}
                                onChange={v => editShuffler(name, "sawtoothChance", v)}
                                onCommit={() => commit(name)}
                            />
                        ) : null}
                    </Foldout>
                );
            })}
        </div>
    );
};

export default AnimationTab;
