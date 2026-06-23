/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
        // Handle .wgsl files as raw text
        config.module.rules.push({
            test: /\.wgsl$/,
            type: "asset/source",
        });

        // node-canvas uses native bindings; do not bundle it for the server
        if (isServer) {
            config.externals.push({ canvas: "commonjs canvas" });
        }

        return config;
    },
};

module.exports = nextConfig;
