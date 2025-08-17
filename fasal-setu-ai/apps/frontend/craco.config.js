module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Ignore source map warnings from third-party packages
      webpackConfig.ignoreWarnings = [
        {
          module: /source-map-loader/,
        },
        function ignoreSourceMapWarnings(warning) {
          return (
            warning.module &&
            warning.module.resource &&
            warning.module.resource.includes('node_modules') &&
            warning.details &&
            warning.details.includes('source map')
          );
        }
      ];

      // Modify source-map-loader to ignore missing source maps
      const sourceMapLoader = webpackConfig.module.rules.find(rule => {
        return rule.enforce === 'pre' && rule.use && rule.use.find(use => 
          use.loader && use.loader.includes('source-map-loader')
        );
      });

      if (sourceMapLoader) {
        sourceMapLoader.exclude = [
          /node_modules\/@mediapipe/,
          /node_modules\/.*\.js\.map$/
        ];
      }

      return webpackConfig;
    },
  },
};
