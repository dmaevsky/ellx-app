import { Ignore, All, Any, Star, Plus, Optional, Y, Node } from 'rd-parse';

import WORD from './word_regex';
import skipScanner from './skip_scanner';
// import OldSkipScanner from './old_skip_scanner';

function locAt(text, newPos, { pos, line, column }) {
  const re = /\n/g;
  re.lastIndex = pos;
  let match;
  let newLinePos = pos - column;

  while ((match = re.exec(text)) && match.index < newPos) {
    newLinePos = match.index;
    line++;
  }

  return {
    pos: newPos,
    line,
    column: newPos - newLinePos
  };
}

const SkipScanner = $ => {
  const $next = skipScanner($);
  if ($next === $) return $;

  if ($next.pos > $.lastSeen.pos) {
    Object.assign($.lastSeen, locAt($.text, $next.pos, $.lastSeen));
  }
  return $next;
}

// Tokens

const InImportExport = Rule => Ignore(Any(
  /^\s+/,
  /^\/\/[^\n]*/,                  // line comment
  /^\/\*(?:\*(?!\/)|[^*])*\*\//   // block comment
), Rule);

const NumericToken = Any(
  /^((?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][-+]?[0-9]+)?)\b/,   // decimal
  /^(0[xX][0-9a-fA-F]+)\b/                                   // hex
);

const StringToken = Any(
  /^'[^'\\]*(?:\\.[^'\\]*)*'/,  // single-quoted
  /^"[^"\\]*(?:\\.[^"\\]*)*"/   // double-quoted
);

const Identifier = WORD;

// Imports / exports

const ModuleName = Node(StringToken, (_, $, $next) => $.text.slice($.pos + 1, $next.pos - 1));

const Specifier = Node(Any(All(Identifier, /^as\b/, Identifier), Identifier), ([name, asName]) => ({ name, asName: asName || name }));
const SpecifierList = All(Specifier, Star(All(',', Specifier)), Optional(','));

const NameSpaceImport = Node(All('*', /^as\b/, Identifier), ([asName]) => ({ name: '*', asName }));
const DefaultBinding = Node(Identifier, ([asName]) => ({ name: 'default', asName }));

const ClauseEnd = /^;?\s*/;

// Imports
const ImportClause = Any(
  All('{', SpecifierList, '}'),
  NameSpaceImport,
  All(DefaultBinding, ',', '{', SpecifierList, '}'),
  All(DefaultBinding, ',', NameSpaceImport),
  DefaultBinding
);

const ImportDeclaration = Any(
  All(/^import\b/, ModuleName, ClauseEnd),
  All(/^import\b/, ImportClause, /^from\b/, ModuleName, ClauseEnd)
);

// Exports
const ExportClause = Any(
  All('{', '}'),
  All('{', SpecifierList, '}'),
);

const NameSpaceExport = Node('*', () => ({ name: '*' }));

const ReExportDeclaration = Any(
  All(/^export\b/, NameSpaceExport, /^from\b/, ModuleName, ClauseEnd),
  All(/^export\b/, ExportClause, /^from\b/, ModuleName, ClauseEnd)
);

const ExportedName = Node(Identifier, ([name]) => ({ name, asName: name }));

const BindingPattern = Y(Pattern => {
  // Array binding pattern
  const BindingElementList = All(Star(','), Pattern, Star(All(Plus(','), Pattern)));
  const BindingRestElement = All('...', ExportedName);

  const ArrayBindingPattern = Any(
    All('[', Star(','), Optional(BindingRestElement), ']'),
    All('[', BindingElementList, ']'),
    All('[', BindingElementList, Plus(','), Optional(BindingRestElement), ']')
  );

  // ObjectBindingPattern

  const PropertyName = Node(Any(NumericToken, StringToken, Identifier), () => null);
  const BindingProperty = Any(All(PropertyName, ':', Pattern), ExportedName);
  const BindingPropertyList = All(BindingProperty, Star(All(',', BindingProperty)));

  const ObjectBindingPattern = All('{', Optional( All(BindingPropertyList, Optional(',')) ), '}');

  return Any(ObjectBindingPattern, ArrayBindingPattern, ExportedName);
});

const Declaration = All(/^(?:var|const|let)\b/, BindingPattern);
const FunctionDeclaration = All(
  Any(/^class\b/, All(Optional(/^async\b/), /^function\b/, Optional('*'))),
  ExportedName
);

const DefaultExport = Node(/^default\b/, () => ({ asName: 'default' }));

const ExportDeclaration = Any(
  All(/^export\b/, ExportClause, ClauseEnd),
  All(/^export\b/, DefaultExport),
  All(/^export\b/, Declaration),
  All(/^export\b/, FunctionDeclaration)
);

// module is an array of modules names in this case
const CollectRequires = Node(SkipScanner, module => module.length ? ({ type: 'require', module }) : null);

const Block = (type, Rule) => InImportExport(
  Node(Rule, (mapping, $, $next) => {
    const source = type !== 'export' && { module: mapping.pop() };
    return {
      type,
      ...source,
      mapping,
      start: $.pos,
      end: $next.pos
    };
  })
);

const CodeFile = Node(
  Star(Any(
    Block('import', ImportDeclaration),
    Block('re-export', ReExportDeclaration),
    Block('export', ExportDeclaration),
    CollectRequires,
    // OldSkipScanner
  )),
  i => i
);

export default CodeFile;
