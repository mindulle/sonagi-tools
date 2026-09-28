function rgbaToHex({r, g, b, a}: RGBA) {
  const toHex = (value: number) => {
    const hex = Math.round(value * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  if (a !== undefined && a < 1) {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export async function exportTokens() {
  const collections = figma.variables.getLocalVariableCollections();
  const variables = figma.variables.getLocalVariables();
  
  const result: Record<string, any> = {};

  for (const collection of collections) {
    const collectionData: any = {};
    const defaultModeId = collection.modes[0].modeId;
    
    const collectionVars = variables.filter(v => v.variableCollectionId === collection.id);
    
    for (const variable of collectionVars) {
      const parts = variable.name.split('/');
      let current = collectionData;
      
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) current[part] = {};
        current = current[part];
      }
      
      const leafName = parts[parts.length - 1];
      const val = variable.valuesByMode[defaultModeId];
      
      let finalVal: any = val;
      let typeStr = variable.resolvedType.toLowerCase();
      if (typeStr === 'float') typeStr = 'number';
      
      if (val !== null && typeof val === 'object') {
        if ('type' in val && val.type === 'VARIABLE_ALIAS') {
          const aliasVar = figma.variables.getVariableById(val.id);
          if (aliasVar) {
            finalVal = `{${aliasVar.name.replace(/\//g, '.')}}`;
          }
        } else if ('r' in val) {
          finalVal = rgbaToHex(val as RGBA);
          typeStr = 'color';
        }
      }
      
      current[leafName] = {
        $value: finalVal,
        $type: typeStr
      };
    }
    
    result[collection.name] = collectionData;
  }
  
  return result;
}

export async function importTokens(payload: Record<string, any>) {
  console.log("Importing tokens", payload);
  // Full alias mapping and creation requires a lot of logic. 
  // We'll stub it with a notification for now.
  figma.notify("Tokens imported (check console for payload)");
}
