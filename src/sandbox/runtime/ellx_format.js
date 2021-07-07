import { Ignore, All, Any, Optional, Star, Node } from 'rd-parse';
import Grammar, { IdentifierToken, StringToken } from 'rd-parse-jsexpr';
import { fromAST } from './serialize';

const Scanner = Rule => Ignore(/^[ \t]+/, Rule);   // Ignore horizontal whitespace
const LineBreak = /^[\r\n]+/;

const Major = /^([0-9]+)/;
const Minor = Optional(All('.', Major));
const SemVer = Node(All(Major, Minor, Minor), version => version.join('.'));
const Version = Any(Node(StringToken, ([raw]) => (new Function('return ' + raw))()), SemVer);

const CalcNode = Node(All(IdentifierToken, '=', /^([^\n]+)/, LineBreak), ([name, formula]) => ({ [name]: formula.trim() }));
const CalcNodes = Node(Star(CalcNode), nodes => nodes.reduce((a, b) => ({ ...a, ...b }), {}));

const Sections = All(
  'version:', Version, LineBreak,
  'nodes:', LineBreak,
  CalcNodes,
  'layout:', LineBreak,
  Node(Grammar, ([ast]) => fromAST(ast))
);

const EllxFile = Scanner(Node(Sections, ([version, nodes, layout]) => ({ version, nodes, layout })));
export default EllxFile;
