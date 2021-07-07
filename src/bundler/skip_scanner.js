import WORD from './word_regex';

export default function($) {
  let { text, pos, sp } = $;

  let level = 0;
  let lastToken = ''
  let lastLastToken = '';

  function eat(n) {
    [lastLastToken, lastToken] = [lastToken, text.slice(pos, pos + n)];
    pos += n;
  }

  function ignore() {
    // ignore whitespace (but not newLine) and line and block comments
    const match = /^([ \t\r\f]+|\/\/[^\n]*|\/\*(\*(?!\/)|[^*])*\*\/)/.exec(text.slice(pos));
    if (match) pos += match[0].length;
  }

  function stringToken() {
    const match = /^('[^'\\]*(?:\\.[^'\\]*)*'|"[^"\\]*(?:\\.[^"\\]*)*")/.exec(text.slice(pos));
    if (match) eat(match[0].length);
  }

  function regex() {
    if (text[pos] !== '/') return;

    if (/([\]})0-9$_]|\+\+|--)$/.test(lastToken)) return;

    if (WORD.test(lastToken) && (
      lastLastToken === '.' ||
      !/^(return|throw|yield|await|delete|else|extends|instanceof|typeof|with|case|new|of|in)$/.test(lastToken)
    )) return;

    eat(1); // eat delimiter

    while (pos < text.length && text[pos] !== '/') {
      if (text[pos] === '[') regexCharClass();
      else {
        if (text[pos] === '\\') eat(1);
        eat(1);
      }
    }
    eat(1); // eat delimiter

    const flags = /^[gimuy]+\b/.exec(text.slice(pos));
    if (flags) {
      eat(flags[0].length);
    }
  }

  function regexCharClass() {
    eat(1); // eat delimiter

    while (pos < text.length && text[pos] !== ']') {
      if (text[pos] === '\\') eat(1);
      eat(1);
    }
    eat(1); // eat delimiter
  }

  function div() {
    if (text[pos] !== '/') return;

    eat(1);
    if (text[pos] === '=') eat(1);
  }

  function stringTemplate() {
    if (text[pos] !== '`') return;

    eat(1); // eat delimiter

    while (pos < text.length && text[pos] !== '`') {
      if (text[pos] === '$') {
        eat(1);
        codeBlock();
      }
      else {
        if (text[pos] === '\\') eat(1);
        eat(1);
      }
    }
    eat(1); // eat delimiter
  }

  function codeBlock() {
    if (text[pos] !== '{') return;
    eat(1);
    level++;
    code();
    level--;
    if (text[pos] !== '}') {
      throw new Error(`Unknown token: ${text.slice(pos, pos + 40)}`);
    }
    eat(1);
  }

  function word() {
    const match = WORD.exec(text.slice(pos));
    if (!match) return;

    if (level === 0 && lastToken !== '.' && /^(import|export)$/.test(match[0])) return;

    eat(match[0].length);

    if (lastToken === 'require') requireModule();
  }

  function requireModule() {
    ignore();
    if (text[pos] !== '(') return;
    eat(1);
    ignore();
    if (text[pos !== '"' && text[pos] !== "'"]) return;
    stringToken();
    ignore();
    if (text[pos] !== ')') return;
    eat(1);

    $.stack[sp++] = lastLastToken.slice(1, -1);
  }

  function newLine() {
    if (text[pos] !== '\n') return;

    if (lastToken !== '\n' && lastToken !== '.') eat(1);
    else pos++;
  }

  function everythingElse() {
    const match = /^[0-9:;,?.<>=&^|*%+~!()[\]-]+/.exec(text.slice(pos));
    if (!match) return;

    eat(match[0].length);
  }

  function anyOf(...scanners) {
    const startPos = pos;
    for (let scanner of scanners) {
      scanner();
      if (pos > startPos) return true;
    }
    return false;
  }

  function code() {
    while (anyOf(
      ignore,
      stringToken,
      stringTemplate,
      regex, div,
      codeBlock,
      newLine,
      word,
      everythingElse
    ));
  }

  code();
  return pos > $.pos ? {...$, pos, sp} : $;
}
