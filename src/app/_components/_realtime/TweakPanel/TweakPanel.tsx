import { useState } from "react";
import GeomContainerEntity from "_realtime/geom/GeomContainerEntity";
import GeomPatternManager from "_realtime/geom/patterns/GeomPatternManager";
import CameraTab from "./tabs/CameraTab";
import ColorTab from "./tabs/ColorTab";
import GeomMovementTab from "./tabs/GeomMovementTab";
import ParticleDissolveTab from "./tabs/ParticleDissolveTab";
import AnimationTab from "./tabs/AnimationTab";

type TabId = "camera" | "color" | "movement" | "particles" | "animation";

const TABS: { id: TabId; label: string }[] = [
    { id: "camera", label: "camera" },
    { id: "color", label: "color settings" },
    { id: "movement", label: "geom movement" },
    { id: "particles", label: "particle dissolve" },
    { id: "animation", label: "animation" },
];

/**
 * Dev-only parameter tweaking overlay (toggled with backtick).
 * All edits are ephemeral — they write straight into the live entities and
 * are discarded on pattern switch, reset, or reload.
 */
const TweakPanel = ({
    patternManager,
    geomContainer,
    patternVersion,
    setZoom,
}: {
    patternManager: GeomPatternManager;
    geomContainer: GeomContainerEntity;
    /** Bumped by the Renderer on pattern switch so tabs re-seed. */
    patternVersion: number;
    setZoom: (zoom: number) => void;
}): JSX.Element => {
    const [activeTab, setActiveTab] = useState<TabId>("camera");
    const [resetCounter, setResetCounter] = useState(0);

    const pattern = patternManager.patterns[patternManager.currentIndex];
    // Remounting the active tab is the refresh mechanism: tabs seed local
    // state on mount, so a new key re-reads everything from the engine.
    const seedKey = `${patternVersion}-${resetCounter}`;

    const reset = () => {
        patternManager.applyPattern(patternManager.currentIndex);
        setResetCounter(c => c + 1);
    };

    return (
        <div
            className="fixed top-8 right-0 bottom-0 w-[380px] z-50 pointer-events-auto bg-black/80 text-white text-xs overflow-y-auto scrollbar-thin p-4"
            onMouseDown={e => e.stopPropagation()}
        >
            <div className="flex justify-between items-center mb-2">
                <span className="uppercase tracking-widest text-white text-opacity-90">
                    {pattern.name}
                </span>
                <button
                    className="border border-white border-opacity-40 rounded px-2 py-0.5 hover:bg-white hover:bg-opacity-10"
                    onClick={reset}
                >
                    reset
                </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`border rounded px-2 py-0.5 ${
                            activeTab === tab.id
                                ? "border-rose-400 text-rose-300"
                                : "border-white border-opacity-30 text-white text-opacity-60 hover:text-opacity-100"
                        }`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            {activeTab === "camera" && (
                <CameraTab key={seedKey} patternManager={patternManager} setZoom={setZoom} />
            )}
            {activeTab === "color" && <ColorTab key={seedKey} geomContainer={geomContainer} />}
            {activeTab === "movement" && (
                <GeomMovementTab key={seedKey} geomContainer={geomContainer} />
            )}
            {activeTab === "particles" && (
                <ParticleDissolveTab key={seedKey} geomContainer={geomContainer} />
            )}
            {activeTab === "animation" && (
                <AnimationTab key={seedKey} geomContainer={geomContainer} />
            )}
        </div>
    );
};

export default TweakPanel;
