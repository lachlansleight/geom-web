"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "_components/layout/Header";
import Renderer from "_components/_realtime/Renderer";

export default function MainPage() {

    //used for any async setup needing to be done
    //(e.g. fetching requirements for first render from API)
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        setLoading(true);
        console.log("Got search parameters", searchParams);
        setLoading(false);
    }, [searchParams]);

    if (loading) return <div className="w-screen h-screen grid place-items-center">...</div>;

    return (
            <>
                <Header />
                <Renderer />
            </>
    );
}
