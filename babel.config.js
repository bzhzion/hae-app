module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Transform import.meta.env to process.env for Metro web compatibility.
      // Zustand v5 ESM builds use import.meta.env.MODE which is invalid in non-module scripts.
      function importMetaTransform({ types: t }) {
        return {
          visitor: {
            MetaProperty(path) {
              if (
                path.node.meta.name === 'import' &&
                path.node.property.name === 'meta'
              ) {
                path.replaceWith(
                  t.objectExpression([
                    t.objectProperty(
                      t.identifier('env'),
                      t.objectExpression([
                        t.objectProperty(
                          t.identifier('MODE'),
                          t.conditionalExpression(
                            t.binaryExpression(
                              '!==',
                              t.memberExpression(
                                t.memberExpression(t.identifier('process'), t.identifier('env')),
                                t.identifier('NODE_ENV')
                              ),
                              t.stringLiteral('production')
                            ),
                            t.stringLiteral('development'),
                            t.stringLiteral('production')
                          )
                        ),
                      ])
                    ),
                  ])
                );
              }
            },
          },
        };
      },
      // Must be last per Reanimated docs.
      'react-native-reanimated/plugin',
    ],
  };
};
