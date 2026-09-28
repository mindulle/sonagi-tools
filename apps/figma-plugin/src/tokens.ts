import { flattenJson, hexToRgba } from './importLogic';

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
  const figmaCollections = figma.variables.getLocalVariableCollections();
  const figmaVariables = figma.variables.getLocalVariables();
  
  const varMap = new Map<string, Variable>(); // key: name (with slashes), value: Variable

  // Pre-fill existing variables
  for (const v of figmaVariables) {
    varMap.set(v.name, v);
  }

  // Pass 1: Create collections and variables, and set raw values (non-alias)
  const aliasQueue: { variable: Variable, aliasString: string, modeId: string }[] = [];

  for (const [collectionName, collectionData] of Object.entries(payload)) {
    let collection = figmaCollections.find(c => c.name === collectionName);
    if (!collection) {
      collection = figma.variables.createVariableCollection(collectionName);
    }
    
    const defaultModeId = collection.modes[0].modeId;
    const flatVars = flattenJson(collectionData);

    for (const flatVar of flatVars) {
      const varName = flatVar.name;
      let figmaType: VariableResolvedDataType = 'STRING';
      if (flatVar.type === 'COLOR') figmaType = 'COLOR';
      else if (flatVar.type === 'NUMBER' || flatVar.type === 'FLOAT') figmaType = 'FLOAT';
      else if (flatVar.type === 'BOOLEAN') figmaType = 'BOOLEAN';

      let variable = varMap.get(varName);
      if (!variable) {
        variable = figma.variables.createVariable(varName, collection.id, figmaType);
        varMap.set(varName, variable);
      }

      const val = flatVar.value;
      if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
        // Alias
        aliasQueue.push({ variable, aliasString: val.slice(1, -1), modeId: defaultModeId });
      } else {
        // Raw value
        if (figmaType === 'COLOR' && typeof val === 'string') {
          variable.setValueForMode(defaultModeId, hexToRgba(val));
        } else {
          variable.setValueForMode(defaultModeId, val);
        }
      }
    }
  }

  // Pass 2: Resolve aliases
  for (const item of aliasQueue) {
    const targetName = item.aliasString.replace(/\./g, '/');
    const targetVar = varMap.get(targetName);
    if (targetVar) {
      item.variable.setValueForMode(item.modeId, figma.variables.createVariableAlias(targetVar));
    } else {
      console.warn(`Alias target not found: ${targetName} for variable ${item.variable.name}`);
    }
  }

  figma.notify("Tokens successfully imported and updated!");
}
