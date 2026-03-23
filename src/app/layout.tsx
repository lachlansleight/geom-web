import "./globals.css";
import { Abyssinica_SIL, Aleo, JetBrains_Mono } from "next/font/google";

const abyssincina = Abyssinica_SIL({
    weight: "400",
    subsets: ["latin"],
    variable: "--font-abyssinica",
});
const aleo = Aleo({
    weight: "700",
    subsets: ["latin"],
    variable: "--font-aleo",
});
const jetbrains = JetBrains_Mono({
    weight: ["100", "300", "400", "600", "800"],
    subsets: ["latin"],
    variable: "--font-jetbrains",
});

export const metadata = {
    title: "A Realtime Website",
    description: "This site is yet to fully exist",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body
                className={`bg-neutral-500 text-white ${abyssincina.variable} ${aleo.variable} ${jetbrains.variable}`}
            >
                <div className="w-full mx-auto stretch font-jetbrains">{children}</div>
            </body>
        </html>
    );
}
