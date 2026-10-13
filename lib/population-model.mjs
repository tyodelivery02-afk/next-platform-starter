export const colorPalette = {
  color1: '#FF5733', color2: '#28C76F', color3: '#FFCC00', color4: '#9B59B6',
  color5: '#E91E63', color6: '#F39C12', color7: '#34495E', color8: '#E67E22',
  color9: '#C0392B', color10: '#A3CB38', color11: '#0047AB', color12: '#2b94eb', color13: '#30D5C8',
};

export function buildPrefStats(prefCode, selectedAreas, populationData, prefMuniMapping, areaData, nationalPopulation, nationalArea) {
  const nationalCode = `${prefCode}000`;
  const wholePref = selectedAreas.includes(nationalCode);
  const muniCodes = prefMuniMapping[prefCode] || [];
  const selectedCodes = wholePref ? muniCodes : selectedAreas.filter(code => code.startsWith(prefCode) && !code.endsWith('000'));
  const totalPrefArea = Object.entries(areaData).reduce((sum, [code, value]) => sum + (code.startsWith(prefCode) && !code.endsWith('000') ? value : 0), 0);
  return {
    selectedPop: wholePref ? populationData[nationalCode] || 0 : selectedCodes.reduce((sum, code) => sum + (populationData[code] || 0), 0),
    totalPrefPop: populationData[nationalCode] || 0,
    nationalPop: nationalPopulation,
    selectedAreaCount: selectedCodes.length,
    totalAreaCount: muniCodes.length,
    prefSelectedCodes: selectedCodes,
    selectedArea: wholePref ? totalPrefArea : selectedCodes.reduce((sum, code) => sum + (areaData[code] || 0), 0),
    totalPrefArea,
    nationalArea,
    wholePref,
  };
}

// Keep individual colors unless every municipality has the same color.
export function collapsePrefecture(prefCode, selectedAreas, areaColors, muniCodes) {
  if (!muniCodes.length || !muniCodes.every(code => selectedAreas.includes(code))) return { selectedAreas, areaColors };
  const color = areaColors[muniCodes[0]];
  if (!color || !muniCodes.every(code => areaColors[code] === color)) return { selectedAreas, areaColors };
  const muniSet = new Set(muniCodes);
  const colors = Object.fromEntries(Object.entries(areaColors).filter(([code]) => !muniSet.has(code)));
  const nationalCode = `${prefCode}000`;
  return { selectedAreas: [...selectedAreas.filter(code => !muniSet.has(code) && code !== nationalCode), nationalCode], areaColors: { ...colors, [nationalCode]: color } };
}

export function sumSelectedPopulation(selectedAreas, populationData, areaColors) {
  const wholePrefs = new Set(selectedAreas.filter(code => code.endsWith('000')).map(code => code.slice(0, 2)));
  const colors = {};
  let total = 0;
  for (const code of selectedAreas) {
    if (!code.endsWith('000') && wholePrefs.has(code.slice(0, 2))) continue;
    const value = populationData[code] || 0;
    total += value;
    if (areaColors[code]) colors[areaColors[code]] = (colors[areaColors[code]] || 0) + value;
  }
  return { total, colors };
}
