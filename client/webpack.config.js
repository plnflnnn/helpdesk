import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import webpack from 'webpack';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Build-time settings from the shared server/.env (or the shell). Only the CLIENT_* values used
// below end up in the public bundle.
config({ path: path.resolve(dirname, '../server/.env'), quiet: true });

/** @returns {import('webpack').Configuration & { devServer?: import('webpack-dev-server').Configuration }} */
export default (_env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/main.tsx',
    output: {
      path: path.resolve(dirname, 'dist'),
      filename: isProduction ? 'assets/[name].[contenthash].js' : 'assets/[name].js',
      publicPath: '/',
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: { '@': path.resolve(dirname, 'src') },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          // Type checking runs separately (`npm run typecheck`) to keep rebuilds fast.
          use: { loader: 'ts-loader', options: { transpileOnly: true } },
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            { loader: 'css-loader', options: { importLoaders: 1 } },
            'postcss-loader',
          ],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({ template: './public/index.html' }),
      new webpack.DefinePlugin({
        __SENTRY_DSN__: JSON.stringify(process.env.CLIENT_SENTRY_DSN ?? ''),
        __APP_ENV__: JSON.stringify(isProduction ? 'production' : 'development'),
      }),
      ...(isProduction
        ? [new MiniCssExtractPlugin({ filename: 'assets/[name].[contenthash].css' })]
        : []),
    ],
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    // Internal dashboard behind a login: warn only for bundles above 500 KiB.
    performance: { maxEntrypointSize: 512_000, maxAssetSize: 512_000 },
    devServer: {
      port: 3000,
      hot: true,
      historyApiFallback: true,
      proxy: [{ context: ['/api'], target: 'http://localhost:4000' }],
    },
  };
};
