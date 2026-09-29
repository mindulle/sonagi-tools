export function hexToRgba(hex: string): RGBA {
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  let a = 1;
  if (h.length === 8) {
    a = parseInt(h.substring(6, 8), 16) / 255;
  }
  return { r, g, b, a };
}

export function flattenJson(
  obj: any,
  path: string[] = []
): Array<{ name: string; value: any; type: string }> {
  let result: Array<{ name: string; value: any; type: string }> = [];
  for (const key in obj) {
    const val = obj[key];
    if (val && typeof val === 'object' && ('$value' in val || 'value' in val)) {
      result.push({
        name: [...path, key].join('/'),
        value: val.$value !== undefined ? val.$value : val.value,
        type: (val.$type || val.type || 'string').toUpperCase(),
      });
    } else if (val && typeof val === 'object') {
      result = result.concat(flattenJson(val, [...path, key]));
    }
  }
  return result;
}
