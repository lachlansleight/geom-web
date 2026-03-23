import GlobalApp from "_realtime/engine/systems/GlobalApp";
import RealtimeInteractor from "./interactor";

//this is all just for the nice pretty debug string :P
const logKeyDebugString = (e: KeyboardEvent) => {
    if (e.key === "Meta" || e.key === "Control" || e.key === "Alt" || e.key === "Shift") {
        //console.log(`${e.key} ${e.type === "keydown" ? "DOWN" : "UP"}`);
    } else {
        const keys = [];
        if (e.metaKey) keys.push(navigator.platform.includes("Win") ? "Win" : "Cmd");
        if (e.ctrlKey) keys.push("Ctrl");
        if (e.altKey) keys.push(navigator.platform.includes("Win") ? "Alt" : "Opt");
        if (e.shiftKey) keys.push("Shift");
        keys.push((e.key === " " ? "SPACE" : e.key).toUpperCase());
        console.log(`${keys.join("+")} ${e.type === "keydown" ? "DOWN" : "UP"}`);
    }
};

export const handleKey = (interator: RealtimeInteractor, e: KeyboardEvent) => {
    if (!GlobalApp.instance) return;

    logKeyDebugString(e);

    //because we don't want to do annoying things like worry about if it's "z" or "Z",
    //we just track the key name and shift as bool
    const capitalKey = (e.key === " " ? "SPACE" : e.key).toUpperCase();
    if (e.key === "Shift") interator.shiftHeld = e.type === "keydown";

    //no longer super well supported, but it's nice not having to worry about this when switching OSs
    const ctrlCmd = navigator.platform.includes("Win") ? e.ctrlKey : e.metaKey;

    //just for fun :D
    if (capitalKey === "ARROWLEFT" && e.type === "keydown") {
        console.log("Applying debug rotation");
        GlobalApp.instance.orthoCam.rotateY(0.1);
        GlobalApp.instance.renderOrthographic = false;
    } else if (capitalKey === "ARROWRIGHT" && e.type === "keydown") {
        console.log("Applying debug rotation");
        GlobalApp.instance.orthoCam.rotateY(-0.1);
        GlobalApp.instance.renderOrthographic = false;
    } else if (capitalKey === "ARROWUP" && e.type === "keydown") {
        console.log("Applying debug rotation");
        GlobalApp.instance.orthoCam.rotateX(0.1);
        GlobalApp.instance.renderOrthographic = false;
    } else if (capitalKey === "ARROWDOWN" && e.type === "keydown") {
        console.log("Applying debug rotation");
        GlobalApp.instance.orthoCam.rotateX(-0.1);
        GlobalApp.instance.renderOrthographic = false;
    } else if (capitalKey === "0" && e.type === "keydown") {
        console.log("Resetting debug rotation");
        GlobalApp.instance.orthoCam.rotation.set(0, 0, 0);
        GlobalApp.instance.renderOrthographic = true;
    }
};
