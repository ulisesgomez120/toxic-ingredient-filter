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
    authCallback: "./src/popup/auth-callback.js", // Add entry for auth callback
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
      path: ".env",
      systemvars: true,
    }),

    // Copy static files
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "manifest.json" },
        { from: "src/popup/popup.html", to: "src/popup/popup.html" },
        { from: "src/popup/auth-callback.html", to: "src/popup/auth-callback.html" },
        { from: "src/options/options.html", to: "src/options/options.html" },
        { from: "src/**/*.css", to: "[path][name][ext]" },
      ],
    }),

    // Define environment variables for the extension
    new webpack.DefinePlugin({
      "process.env.SUPABASE_URL": JSON.stringify(process.env.SUPABASE_URL),
      "process.env.SUPABASE_ANON_KEY": JSON.stringify(process.env.SUPABASE_ANON_KEY),
      "process.env.PROXY_URL": JSON.stringify(process.env.PROXY_URL),
      "process.env.EXTENSION_KEY": JSON.stringify(process.env.EXTENSION_KEY),
    }),
  ],
  devtool: "source-map",
  resolve: {
    extensions: [".js"],
    fallback: {
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
      buffer: require.resolve("buffer/"),
      process: require.resolve("process/browser"),
    },
  },
};
