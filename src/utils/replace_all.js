// String.prototype.replaceAll limited polyfill
export default function replaceAll(input, regex, replacer) {
  let result = input;
  let match, delta = 0;

  while (match = regex.exec(input)) {
    const replacement = replacer(...match);
    result = result.slice(0, match.index + delta) + replacement + result.slice(regex.lastIndex + delta);
    delta += replacement.length - match[0].length;
  }

  return result;
}
