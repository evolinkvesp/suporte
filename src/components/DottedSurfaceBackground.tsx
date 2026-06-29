import { useEffect, useRef } from "react";
import * as THREE from "three";

import { cn } from "@/lib/utils";

type DottedSurfaceBackgroundProps = React.HTMLAttributes<HTMLDivElement>;

export const DottedSurfaceBackground = ({ className, ...props }: DottedSurfaceBackgroundProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SEPARATION = 140;
    const AMOUNT_X = 40;
    const AMOUNT_Y = 60;
    const totalPoints = AMOUNT_X * AMOUNT_Y;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x070b16, 1500, 9000);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 355, 1220);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(totalPoints * 3);
    const colors = new Float32Array(totalPoints * 3);

    let i = 0;
    for (let ix = 0; ix < AMOUNT_X; ix++) {
      for (let iy = 0; iy < AMOUNT_Y; iy++) {
        const index = i * 3;
        positions[index] = ix * SEPARATION - (AMOUNT_X * SEPARATION) / 2;
        positions[index + 1] = 0;
        positions[index + 2] = iy * SEPARATION - (AMOUNT_Y * SEPARATION) / 2;

        colors[index] = 0.72;
        colors[index + 1] = 0.75;
        colors[index + 2] = 0.82;

        i++;
      }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 7,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      sizeAttenuation: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let animationId = 0;
    let count = 0;

    const renderFrame = () => {
      const positionAttribute = geometry.getAttribute("position") as THREE.BufferAttribute;
      const positionArray = positionAttribute.array as Float32Array;

      let idx = 0;
      for (let ix = 0; ix < AMOUNT_X; ix++) {
        for (let iy = 0; iy < AMOUNT_Y; iy++) {
          const base = idx * 3;
          positionArray[base + 1] = Math.sin((ix + count) * 0.3) * 50 + Math.sin((iy + count) * 0.5) * 50;
          idx++;
        }
      }

      positionAttribute.needsUpdate = true;
      renderer.render(scene, camera);
      count += 0.1;
    };

    const animate = () => {
      animationId = window.requestAnimationFrame(animate);
      renderFrame();
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    if (prefersReducedMotion) {
      renderFrame();
    } else {
      animate();
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationId) window.cancelAnimationFrame(animationId);

      scene.remove(points);
      geometry.dispose();
      material.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} aria-hidden className={cn("pointer-events-none fixed inset-0 z-0 overflow-hidden", className)} {...props} />;
};
