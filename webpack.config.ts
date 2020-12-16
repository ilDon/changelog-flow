import * as fs from 'fs-extra';
import { join } from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import { Configuration } from 'webpack';

const packageConfig = fs.readJSONSync('./package.json', { encoding: 'utf-8' });

const externals = {};
for (const packageName in packageConfig.dependencies)
  externals[packageName] = packageName;

const serverConfig: Configuration = {
  entry: {
    index: './src/index.ts'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    plugins: [
      new TsconfigPathsPlugin({ configFile: "./tsconfig.json" })
    ]
  },
  target: 'node',
  node: {
    __dirname: false
  },
  externals,
  output: {
    path: join(__dirname, 'out'),
    filename: '[name].js',
    library: '[name]',
    libraryTarget: 'umd'
  },
  module: {
    rules: [{
      test: /\.ts$/,
      loader: 'ts-loader'
    }]
  },
  mode: 'production',
  optimization: {
    minimize: false
  }
};

// tslint:disable-next-line:no-default-export
export default [serverConfig];
