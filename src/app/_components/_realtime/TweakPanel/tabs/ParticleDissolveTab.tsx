import GeomContainerEntity from "_realtime/geom/GeomContainerEntity";
import ConfigSliders from "../fields/ConfigSliders";
import { particleDefs } from "../paramDefs";

const ParticleDissolveTab = ({
    geomContainer,
}: {
    geomContainer: GeomContainerEntity;
}): JSX.Element => {
    return <ConfigSliders geomContainer={geomContainer} defs={particleDefs} />;
};

export default ParticleDissolveTab;
