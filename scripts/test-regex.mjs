const src = `t('artist:empty.owned_filtered', { format: formatOptions.find((o) => o.value === formatFilter)?.label })`;
const callRe = /\bt\(/g;
let m;
while ((m = callRe.exec(src))) {
  let depth = 0;
  let end = m.index + 2;
  for (let i = m.index + 2; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      if (depth === 0) { end = i; break; }
      depth--;
    }
  }
  const args = src.slice(m.index + 2, end);
  console.log('ARGS:', args);
  for (const str of args.matchAll(/['"]([^'"]+)['"]/g)) console.log('  STR:', str[1]);
  callRe.lastIndex = end + 1;
}
