"use client";

import Link from "next/link";
import { useState } from "react";
import AudioCapture from "_realtime/engine/systems/AudioCapture";
import useAnimationFrame from "_lib/hooks/useAnimationFrame";

const Header = (): JSX.Element => {
    const [audioActive, setAudioActive] = useState(false);
    const [audioLevel, setAudioLevel] = useState([0]);

    const toggleAudio = async () => {
        const capture = AudioCapture.instance;
        if (capture.active) {
            capture.stop();
            setAudioActive(false);
        } else {
            const ok = await capture.start();
            setAudioActive(ok);
        }
    };

    useAnimationFrame(e => {
        setAudioLevel([
            AudioCapture.instance.momentary,
            AudioCapture.instance.halfSecond,
            AudioCapture.instance.second,
            AudioCapture.instance.fiveSecond,
            AudioCapture.instance.tenSecond,
            AudioCapture.instance.thirtySecond,
            AudioCapture.instance.flicker,
            AudioCapture.instance.pulse,
            AudioCapture.instance.vibe,
        ]);
    }, []);

    return (
        <div className="fixed top-0 left-0 w-screen h-8 bg-black flex justify-between items-center px-8 gap-4 z-50">
            <Link href="/">
                <span className="text-neutral-800">A Realtime Site</span>
            </Link>
            <div className="flex items-center justify-end gap-2">
                {audioLevel.map((level, index) => (
                    <div key={index} className="w-[50px] h-4 bg-neutral-900 rounded-full grid place-items-center relative">
                        <div className="absolute top-0 left-0 h-full bg-neutral-700 rounded-full" style={{ width: `${level * 100}%` }}></div>
                        <span className="text-xs text-yellow-300 font-bold absolute left-0 top-0 w-full h-full text-left px-1" style={{ opacity: level * 0.5 + 0.1 }}>
                            {index === 0 
                                ? "!" : index === 1 
                                ? "½" : index === 2 
                                ? "1" : index === 3 
                                ? "5" : index === 4 
                                ? "10" : index === 5 
                                ? "30" : index === 6 
                                ? "⚡" : index === 7 
                                ? "🟡" : index === 8 
                                ? "💛" : ""
                            }
                        </span>
                        {/* <span className="text-xs text-neutral-100 font-bold absolute left-0 top-0 w-full h-full text-center" style={{ opacity: level * 0.5 + 0.1 }}>{level.toFixed(2)}</span> */}
                    </div>
                ))}
                <button
                    onClick={toggleAudio}
                    className="ml-auto text-xs px-3 rounded-full bg-neutral-900 text-yellow-400 text-opacity-50 font-bold hover:bg-neutral-500 transition-colors"
                >
                    {audioActive ? "Stop" : "Capture Audio"}
                </button>
            </div>
        </div>
    );
};

export default Header;
