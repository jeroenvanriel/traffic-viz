import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getModelBoundingBoxInfo } from "./modelUtils";


/** Renders a GLTF model to a thumbnail image */
export async function renderModelThumbnail(modelUrl: string, size = 512): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(size, size, false);
  renderer.setClearColor(new Color("#f3f4f6"));

  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.01, 1000);

  scene.add(new AmbientLight(0xffffff, 1.0));
  const key = new DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 3, 2);
  scene.add(key);

  const fill = new DirectionalLight(0xffffff, 0.4);
  fill.position.set(-2, 1, -1);
  scene.add(fill);

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(modelUrl);
  const root = gltf.scene;
  scene.add(root);

  // compute bounding box to find center and size of model
  const bbInfo = getModelBoundingBoxInfo(root);

  // center model at origin
  root.position.sub(bbInfo.center);

  // position camera to fit model in view
  const fovRad = (camera.fov * Math.PI) / 180;
  const distance = (bbInfo.maxDimension / 2) / Math.tan(fovRad / 2);
  camera.position.set(distance * 0.95, distance * 0.75, distance * 0.95);
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);

  // create image blob from canvas
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Failed to generate thumbnail"));
    }, "image/png");
  });

  renderer.dispose();
  return blob;
}
