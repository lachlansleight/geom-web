const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
    theme: {
        extend: {
            // colors: {
            //     primary: {
            //         light: "#FADEFF",
            //         mid: "#D4B3FF",
            //         dark: "#8F00FF",
            //     },
            //     secondary: {
            //         mid: "#FF76B8",
            //         dark: "#DD0393",
            //     },
            //     tertiary: {
            //         mid: "#446FC3",
            //         dark: "#323A7D",
            //     },
            //     black: "#000",
            // },
            // fontSize: {
            //     "4xl": "36pt",
            //     "3xl": "28pt",
            //     "2xl": "24pt",
            //     xl: "18pt",
            //     lg: "16pt",
            //     md: "14pt",
            //     sm: "12pt",
            //     xs: "8pt",
            // },
            fontFamily: {
                abyssinica: ["var(--font-abyssinica)", "serif"],
                aleo: ["var(--font-aleo)", "serif"],
                jetbrains: ["var(--font-jetbrains)", "serif"],
            },
        },
    },
    plugins: [require("tailwind-scrollbar")],
};
