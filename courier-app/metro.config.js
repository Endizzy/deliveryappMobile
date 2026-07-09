// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Меньше параллельных воркеров → меньше пиковая память при бандлинге (фикс OOM)
config.maxWorkers = 2;

module.exports = config;
