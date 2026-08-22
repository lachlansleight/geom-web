import GeomContainerEntity from "_realtime/geom/GeomContainerEntity";
import ConfigSliders from "../fields/ConfigSliders";
import { colorDefs } from "../paramDefs";

const ColorTab = ({ geomContainer }: { geomContainer: GeomContainerEntity }): JSX.Element => {
    return (
        <div>
            <p className="text-white text-opacity-40 text-[10px] mb-2">
                note: audio capture overrides hue + brightness while active; hue itself is
                animator-driven (see animation tab)
            </p>
            <ConfigSliders geomContainer={geomContainer} defs={colorDefs} />
        </div>
    );
};

export default ColorTab;
