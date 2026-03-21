import { Box3, Object3D, Vector3 } from 'three';

/** Information about a model's bounding box */
export interface ModelBoundingBoxInfo {
  center: Vector3;
  size: Vector3;
  maxDimension: number;
}

/**
 * Calculate bounding box information for a 3D model
 */
export function getModelBoundingBoxInfo(
  modelRoot: Object3D
): ModelBoundingBoxInfo {
  const box = new Box3().setFromObject(modelRoot);
  const center = box.getCenter(new Vector3());
  const sizeVec = box.getSize(new Vector3());
  const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 1e-3);

  return {
    center,
    size: sizeVec,
    maxDimension: maxDim,
  };
}
