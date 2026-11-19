import * as THREE from 'three';

export function travelGaze(position, tangent, originLook, destinationLook, progress, originPosition = position) {
  const direction = tangent.clone().normalize();
  const start = originLook.clone().sub(originPosition).normalize();
  const finish = destinationLook.clone().sub(position).normalize();
  if (direction.lengthSq() < 0.5) direction.set(0, 0, -1);
  if (start.lengthSq() < 0.5) start.copy(direction);
  if (finish.lengthSq() < 0.5) finish.copy(direction);
  const departure = THREE.MathUtils.smoothstep(progress, 0, 0.18);
  const arrival = THREE.MathUtils.smoothstep(progress, 0.78, 1);
  const rotation = new THREE.Quaternion().setFromUnitVectors(start, direction);
  const look = start.applyQuaternion(new THREE.Quaternion().slerp(rotation, departure));
  const docking = new THREE.Quaternion().setFromUnitVectors(look, finish);
  look.applyQuaternion(new THREE.Quaternion().slerp(docking, arrival));
  return position.clone().addScaledVector(look, THREE.MathUtils.lerp(45, Math.max(1, destinationLook.distanceTo(position)), arrival));
}
