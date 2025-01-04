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
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js", // Output JS files directly in dist
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
      path: ".env",
      systemvars: true,
    }),

    // Copy static files
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "manifest.json" },
        // Copy HTML files to their respective folders
        {
          from: "src/popup/popup.html",
          to: "popup/popup.html",
        },
        // Copy CSS files to their respective folders
        {
          from: "src/popup/popup.css",
          to: "popup/popup.css",
        },
        // Copy any other CSS files
        {
          from: "src/styles",
          to: "styles",
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  devtool: "source-map",
};
