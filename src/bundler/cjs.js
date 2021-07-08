import CodeFile from './imports_grammar.js';
import Parser from 'rd-parse';

export const parse = Parser(CodeFile);

export function transform(code) {
  const ast = parse(code);

  if (!ast.length) {
    return { code };
  }

  const imports = {};
  let required = [];
  let delta = 0;

  for (let { type, module, mapping, start, end } of ast) {
    if (type === 'require') {
      required = required.concat(module);
      continue;
    }

    let replacement = '';

    if (type === 'export'){
      const match = /^(export\b\s*)(\{|default|var|const|let|function|async|class)/.exec(code.slice(start - delta));

      if (match[2] === 'default') {
        replacement = 'exports.default =';
        end = start + match[0].length;
      }
      else if (match[2] !== '{') end = start + match[1].length;
    }
    else {
      imports[module] = mapping.reduce((acc, { name, asName }) => ({ ...acc, [name]: asName }), imports[module]);
    }
    code = code.slice(0, start - delta) + replacement + code.slice(end - delta);
    delta += end - start - replacement.length;
  }

  const preamble = ast
    .filter(({ type }) => type === 'import' || type === 're-export')
    .map(({ type, module, mapping }, i) => {
      const asterisk = mapping.find(({ name }) => name === '*');

      if (asterisk) {
        // This can be the only symbol in the mapping
        return type === 'import'
          ? `var ${asterisk.asName} = require('${module}');`
          : `Object.assign(exports, require('${module}'));`;
      }

      const moduleBinding = '__ellx_import__' + i;
      let required = `const ${moduleBinding} = require('${module}');\n`;

      const prefix = type === 'import' ? 'var ' : 'exports.';

      for (let { name, asName } of mapping) {
        if (name === 'default') {
          required += prefix + `${asName} = 'default' in ${moduleBinding} ? ${moduleBinding}.default : ${moduleBinding};\n`;
        }
        else {
          required += prefix + `${asName} = ${moduleBinding}.${name};\n`;
        }
      }

      return required;
    }).join('\n') + '\n';

  const allExports = ast
    .filter(({ type }) => type === 'export')
    .map(({ mapping }) => mapping
      .filter(({ name }) => Boolean(name))
      .map(({ name, asName }) => name === asName ? name : `${asName}: ${name}`)
      .join(',')
    )
    .filter(Boolean)
    .join(',');

  const footer = allExports ? `\nObject.assign(exports, {${allExports}});\n` : '';

  return {
    code: preamble + code + footer,
    imports,
    required
  };
}
