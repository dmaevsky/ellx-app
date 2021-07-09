function renameType(node) {
  if (node.type === 'ExportNamedDeclaration' && node.source) {
    return { type: 're-export' };
  }
  if (node.type === 'ExportAllDeclaration') {
    return { type: 're-export' };
  }
  if (node.type.startsWith('Export')) {
    return { type: 'export' };
  }
  if (node.type.startsWith('Import')) {
    return { type: 'import' };
  }

  throw new Error('Unknown node type');
}

function multipleDeclarations(node) {
  if (!node.declaration || !node.declaration.declarations) return {};

  return {
    mapping: node.declaration.declarations.map(i => ({ name: i.id.name, asName: i.id.name })),
  };
}

function singleDeclaration(node) {
   if (node.type === 'ExportAllDeclaration') {
    return {
      mapping: [
        { name: "*" }
      ]
    }
  }

  if (node.type === 'ExportDefaultDeclaration') {
    return {
      mapping: [
        { asName: "default" }
      ]
    }
  }

  if (node.type === 'ExportNamedDeclaration' && node.declaration
      && node.declaration.declarations) {
    const { name } = node.declaration.declarations[0].id;
    return {
      mapping: [
        { name, asName: name }
      ]
    }
  }

  if (node.declaration && ['ClassDeclaration', 'FunctionDeclaration'].includes(node.declaration.type)) {
    const { name } = node.declaration.id
    return {
      mapping: [
        { name, asName: name }
      ]
    }
  }
}

function specifier({ type, ...s }, parent) {
  if (type === 'ExportSpecifier') {
    return { name: s.local.name, asName: s.exported.name };
  }

  if (type === 'ImportSpecifier') {
    return { name: s.imported.name, asName: s.local.name };
  }

  if (type === 'ImportDefaultSpecifier') {
    return { name: "default", asName: s.local.name };
  }

  if (type === 'ImportNamespaceSpecifier') {
    return { name: '*', asName: s.local.name };
  }
}

function specifierWithParent(node) {
  return n => specifier(n, node);
}

function importSpecifiers({ specifiers, ...node }) {
  if (!specifiers) return;

  return {
    mapping: specifiers.map(specifierWithParent(node)),
  }
}

function startEnd({ start, end }) {
  if (!end) return;

  return { start, end };
}

function sourceValueToModule({ source }) {
  if (!source) return;

  return { module: source.value };
}

const identity = node => node;

// function restrict(node) {
//   if (node.declaration && node.declaration.type === 'VariableDeclaration'
//       && node.declaration.declarations && node.declaration.declarations[0].type === 'VariableDeclarator'
//      && !node.declaration.declarations[0].init) {
//     throw new Error('Global variable export');
//   }
// }

const fns = [
  // restrict,
  renameType,
  multipleDeclarations,
  singleDeclaration,
  sourceValueToModule,
  importSpecifiers,
  startEnd,
//   identity,
];

function transformNode(node) {
  try {
    return fns.reduce((cjsNode, fn) => ({
       ...fn(node),
       ...cjsNode,
     }), {});
  } catch {
    return null;
  }
}

export function transform(ast) {
  const { body } = JSON.parse(JSON.stringify(ast));

  return body.map(transformNode)
//     .reduce((acc, cur) => [
//       ...acc,
//       (cur && (cur.type !== 'export' || !acc.some(i => i.type === 'export')) ? cur : false),
//     ], [])
    .filter(Boolean)
}
