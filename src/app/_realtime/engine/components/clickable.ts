import RealtimeEntity from "_realtime/engine/entities/realtimeEntity";

interface Clickable {
    isClickable: true;
    leftClickDown: () => void;
    middleClickDown: () => void;
    rightClickDown: () => void;
    leftClickUp: () => void;
    middleClickUp: () => void;
    rightClickUp: () => void;
}

export const objectIsClickable = (obj: any): obj is Clickable => {
    return obj?.isClickable;
};

export type ClickableEntity = RealtimeEntity & Clickable;

export default Clickable;
