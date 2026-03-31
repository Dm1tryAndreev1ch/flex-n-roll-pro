import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                require: "readonly",
                module: "readonly",
                process: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                console: "readonly",
                setTimeout: "readonly",
                setInterval: "readonly",
                setImmediate: "readonly",
                Buffer: "readonly",
                URLSearchParams: "readonly",
                Promise: "readonly",
                exports: "readonly",
                describe: "readonly",
                it: "readonly",
                expect: "readonly",
                beforeAll: "readonly",
                afterAll: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly",
                jest: "readonly"
            }
        },
        rules: {
            "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
            "no-control-regex": "off"
        }
    }
];
