import * as THREE from 'three';

export function createFlowDeformer(geometry, { tail = false, seed = 0 } = {}) {
  const positions = geometry.attributes.position; const normals = geometry.attributes.normal;
  const base = new Float32Array(positions.array); const baseNormals = new Float32Array(normals.array);
  const weights = new Float32Array(positions.count); const gradients = new Float32Array(base.length);
  const phaseSine = new Float32Array(positions.count); const phaseCosine = new Float32Array(positions.count);
  const columnStep = new THREE.Vector3(); const rowStep = new THREE.Vector3(); const temporary = new THREE.Vector3();
  for (let index = 0; index < positions.count; index++) {
    const weight = tail ? Math.max(0, -base[index * 3 + 1]) / 4.2 : geometry.attributes.uv.getY(index);
    weights[index] = weight; phaseSine[index] = Math.sin(weight * 4); phaseCosine[index] = Math.cos(weight * 4);
    if (tail) { gradients[index * 3 + 1] = base[index * 3 + 1] < 0 ? -1 / 4.2 : 0; continue; }
    const row = Math.floor(index / 7); const column = index % 7;
    const lower = Math.max(0, row - 1) * 7 + column; const upper = Math.min(28, row + 1) * 7 + column;
    const left = row * 7 + Math.max(0, column - 1); const right = row * 7 + Math.min(6, column + 1);
    rowStep.fromArray(base, upper * 3).sub(temporary.fromArray(base, lower * 3));
    columnStep.fromArray(base, right * 3).sub(temporary.fromArray(base, left * 3));
    const columnLength = columnStep.lengthSq();
    if (columnLength > 1e-12) rowStep.addScaledVector(columnStep, -rowStep.dot(columnStep) / columnLength);
    const rowLength = rowStep.lengthSq();
    if (rowLength > 1e-12) rowStep.multiplyScalar((geometry.attributes.uv.getY(upper) - geometry.attributes.uv.getY(lower)) / rowLength).toArray(gradients, index * 3);
  }
  positions.setUsage(THREE.DynamicDrawUsage); normals.setUsage(THREE.DynamicDrawUsage);
  const horizontalAmplitude = tail ? 0.34 : 0.18; const depthAmplitude = tail ? 0.18 : 0.24;
  return {
    update(time) {
      const horizontalSine = Math.sin(time * 0.9 + seed); const horizontalCosine = Math.cos(time * 0.9 + seed);
      const depthSine = Math.sin(time * 0.65 + seed); const depthCosine = Math.cos(time * 0.65 + seed);
      for (let index = 0; index < positions.count; index++) {
        const offset = index * 3; const weight = weights[index]; const squared = weight * weight;
        const horizontalWave = horizontalSine * phaseCosine[index] + horizontalCosine * phaseSine[index];
        const horizontalSlope = horizontalCosine * phaseCosine[index] - horizontalSine * phaseSine[index];
        const depthWave = depthSine * phaseCosine[index] - depthCosine * phaseSine[index];
        const depthSlope = depthCosine * phaseCosine[index] + depthSine * phaseSine[index];
        positions.array[offset] = base[offset] + horizontalWave * squared * horizontalAmplitude;
        positions.array[offset + 2] = base[offset + 2] + depthWave * squared * depthAmplitude;
        const horizontalDerivative = (horizontalSlope * squared * 4 + horizontalWave * weight * 2) * horizontalAmplitude;
        const depthDerivative = (-depthSlope * squared * 4 + depthWave * weight * 2) * depthAmplitude;
        const determinant = 1 + gradients[offset] * horizontalDerivative + gradients[offset + 2] * depthDerivative;
        const projection = (baseNormals[offset] * horizontalDerivative + baseNormals[offset + 2] * depthDerivative) / (Math.abs(determinant) > 1e-6 ? determinant : 1);
        const horizontalNormal = baseNormals[offset] - gradients[offset] * projection;
        const verticalNormal = baseNormals[offset + 1] - gradients[offset + 1] * projection;
        const depthNormal = baseNormals[offset + 2] - gradients[offset + 2] * projection;
        const length = Math.sqrt(horizontalNormal * horizontalNormal + verticalNormal * verticalNormal + depthNormal * depthNormal) || 1;
        normals.array[offset] = horizontalNormal / length; normals.array[offset + 1] = verticalNormal / length; normals.array[offset + 2] = depthNormal / length;
      }
      positions.needsUpdate = true; normals.needsUpdate = true;
    },
  };
}
