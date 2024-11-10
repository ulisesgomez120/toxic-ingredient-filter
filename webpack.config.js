// webpack.config.js

const path = require("path");
const webpack = require("webpack");
const DotenvPlugin = require("dotenv-webpack");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "development", // Change to 'production' when building for production
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
      path: ".env", // Use single .env file
      systemvars: true,
    }),

    // Copy static files
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "manifest.json" },
        { from: "src/popup/popup.html", to: "src/popup/popup.html" },
        { from: "src/options/options.html", to: "src/options/options.html" },
        { from: "src/**/*.css", to: "[path][name][ext]" },
      ],
    }),
  ],
  devtool: "source-map",
};
