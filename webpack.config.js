// webpack.config.js

const path = require("path");
const webpack = require("webpack");
const DotenvPlugin = require("dotenv-webpack");
const CopyPlugin = require("copy-webpack-plugin");
const { DefinePlugin } = webpack;

module.exports = (env) => {
  // Determine which .env file to use based on environment
  const envPath = env.production ? ".env.production" : ".env.development";

  return {
    mode: env.production ? "production" : "development",
    entry: {
      background: "./src/background.js",
      content: "./src/content.js",
      popup: "./src/popup/popup.js",
      options: "./src/options/options.js",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "src/[name].js",
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"],
            },
          },
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    plugins: [
      // Load environment variables from .env file
      new DotenvPlugin({
        path: envPath,
        safe: true, // load '.env.example' to verify the '.env' variables are all set
        systemvars: true, // load all system variables as well
        defaults: false, // don't load '.env.defaults'
      }),

      // Define environment variables that will be replaced at build time
      new DefinePlugin({
        "process.env.SUPABASE_URL": JSON.stringify(process.env.SUPABASE_URL),
        "process.env.SUPABASE_KEY": JSON.stringify(process.env.SUPABASE_KEY),
        "process.env.NODE_ENV": JSON.stringify(env.production ? "production" : "development"),
      }),

      // Copy static files
      new CopyPlugin({
        patterns: [
          {
            from: "manifest.json",
            to: "manifest.json",
            transform(content) {
              // Remove any keys that shouldn't be in production
              const manifest = JSON.parse(content);
              if (env.production) {
                delete manifest.key;
                delete manifest.oauth2;
              }
              return JSON.stringify(manifest, null, 2);
            },
          },
          { from: "src/popup/popup.html", to: "src/popup/popup.html" },
          { from: "src/options/options.html", to: "src/options/options.html" },
          { from: "src/**/*.css", to: "[path][name][ext]" },
        ],
      }),
    ],
    devtool: env.production ? false : "source-map",
  };
};
