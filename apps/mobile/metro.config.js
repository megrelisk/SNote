// Metro config: watch the shared @snote/core package that lives outside this app.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const coreRoot = path.resolve(projectRoot, '../../packages/core');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [...(config.watchFolders ?? []), coreRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
