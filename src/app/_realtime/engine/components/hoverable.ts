import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";

interface Hoverable {
    isHoverable: true;
    isHovered: boolean;
    hover: () => void;
    unhover: () => void;
}

export const objectIsHoverable = (obj: any): obj is Hoverable => {
    return obj.isHoverable;
};

export type HoverableEntity = RealtimeEntity & Hoverable;

export default Hoverable;
