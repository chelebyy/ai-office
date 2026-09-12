import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { BufferGeometry, Group, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Combines immutable props by material; animated characters stay outside this boundary. */
export function StaticBatch({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  useLayoutEffect(() => {
    const root = group.current;
    if (!root) return;
    root.updateWorldMatrix(true, true);
    const inverse = new Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map<
      string,
      { geometries: BufferGeometry[]; sources: Mesh[]; material: MeshStandardMaterial }
    >();
    root.traverse((object) => {
      if (!(object instanceof Mesh) || Array.isArray(object.material) || !object.visible) return;
      const material = object.material as MeshStandardMaterial;
      const key = JSON.stringify([
        material.type,
        material.color?.getHex(),
        material.map?.uuid,
        material.roughness,
        material.metalness,
        material.emissive?.getHex(),
        material.emissiveIntensity,
        material.opacity,
        material.transparent,
        material.side,
        material.depthWrite,
        material.toneMapped,
        object.castShadow,
        object.receiveShadow,
        Object.keys(object.geometry.attributes).sort(),
      ]);
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      geometry.applyMatrix4(new Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { geometries: [], sources: [], material };
        buckets.set(key, bucket);
      }
      bucket.geometries.push(geometry);
      bucket.sources.push(object);
    });
    const mergedMeshes: Mesh[] = [];
    const hidden: Mesh[] = [];
    for (const bucket of buckets.values()) {
      const geometry = mergeGeometries(bucket.geometries, false);
      for (const input of bucket.geometries) input.dispose();
      if (!geometry) continue;
      geometry.computeBoundingSphere();
      const mesh = new Mesh(geometry, bucket.material.clone());
      mesh.castShadow = bucket.sources[0].castShadow;
      mesh.receiveShadow = bucket.sources[0].receiveShadow;
      for (const source of bucket.sources) {
        source.visible = false;
        hidden.push(source);
      }
      root.add(mesh);
      mergedMeshes.push(mesh);
    }
    return () => {
      for (const mesh of mergedMeshes) {
        root.remove(mesh);
        mesh.geometry.dispose();
        if (!Array.isArray(mesh.material)) mesh.material.dispose();
      }
      for (const mesh of hidden) mesh.visible = true;
    };
  }, []);
  return <group ref={group}>{children}</group>;
}
