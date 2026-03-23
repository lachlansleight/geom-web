/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
        // Handle .wgsl files as raw text
        config.module.rules.push({
            test: /\.wgsl$/,
            type: "asset/source",
        });

        return config;
    },
};

module.exports = nextConfig;
