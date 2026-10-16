/**
 * The SKY RIG (day/night build, Adam, 2026-10-16) — the visible
 * heavens of BioForge: a BINARY SUN crossing the day, a huge
 * RINGED PLANET riding the night, and a seeded star shell.
 *
 * Adam's spec: "Binary sun, ten minutes per planet rotation,
 * stars and a huge moon at night" — refined mid-build by Adam:
 * not a moon, a huge RINGED PLANET like Saturn. Its pale shine
 * is the night's light.
 *
 * The cycle PHASE itself lives outside this file: App state
 * (dayNightCycle) is host-advanced at exactly 1/600 per second,
 * saved and synced; the engine's setDayNightTime stores the
 * phase and paints palettes from it, and calls this rig's
 * update() per frame to place the bodies. Convention
 * (load-bearing, shared with the HUD and the variant effects):
 * 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 0 = midnight.
 *
 * WHY A MODULE: threeEngine.ts sits within a few KB of the
 * single-file push ceiling (the water section already moved to
 * waterField.ts for the same reason). The sky is a
 * self-contained rig — it reads the phase and the camera, and
 * moves the engine's primary light — so it lives here.
 */

import * as THREE from 'three';

export class SkyRig {
  /** The companion sun's light (no shadows; the primary keeps them). */
  public sunLightB: THREE.DirectionalLight;
  /** Star material, exposed so the engine's palette pass can fade it. */
  public starMaterial: THREE.PointsMaterial;

  private skyGroup: THREE.Group = new THREE.Group();
  private sunMeshA: THREE.Mesh;
  private sunMeshB: THREE.Mesh;
  private sunGlowA: THREE.Mesh;
  private sunGlowB: THREE.Mesh;
  private planetGroup: THREE.Group;
  private starPoints: THREE.Points;
  private dirLight: THREE.DirectionalLight;

  constructor(scene: THREE.Scene, dirLight: THREE.DirectionalLight) {
    this.dirLight = dirLight;
    const disc = (radius: number, color: number, opacity: number) => {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 40),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          fog: false,
          depthWrite: false,
        }),
      );
      m.renderOrder = -10;
      return m;
    };
    // The binary: a large warm primary and its smaller companion.
    this.sunGlowA = disc(15, 0xffdf8a, 0.28);
    this.sunMeshA = disc(7, 0xfff3c4, 1);
    this.sunGlowB = disc(9.5, 0xffc98a, 0.24);
    this.sunMeshB = disc(4.4, 0xffe3ae, 1);
    // The ringed giant: a huge pale disc with a banded face and a
    // tilted ring, riding the night path.
    this.planetGroup = new THREE.Group();
    const planetFace = disc(12, 0xdfe9f5, 1);
    const planetBand = disc(12, 0xb9c9de, 0.55);
    planetBand.scale.set(1, 0.32, 1);
    planetBand.position.z = 0.01;
    const planetCore = disc(5.5, 0xcdd9ea, 0.5);
    planetCore.position.z = 0.02;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(15.5, 24, 48),
      new THREE.MeshBasicMaterial({
        color: 0xe8dcc0,
        transparent: true,
        opacity: 0.8,
        fog: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = Math.PI / 2.35;
    ring.position.z = -0.01;
    ring.renderOrder = -10;
    this.planetGroup.add(planetFace);
    this.planetGroup.add(planetBand);
    this.planetGroup.add(planetCore);
    this.planetGroup.add(ring);
    // Stars: a seeded shell (identical on every client), revealed
    // by the night — opacity is driven from the engine's palette
    // pass through starMaterial.
    const starGeo = new THREE.BufferGeometry();
    const starCount = 700;
    const pos = new Float32Array(starCount * 3);
    let s = 1234567;
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < starCount; i++) {
      const az = rnd() * Math.PI * 2;
      const el = Math.asin(rnd() * 0.98 + 0.01);
      const r = 178;
      pos[i * 3] = Math.cos(az) * Math.cos(el) * r;
      pos[i * 3 + 1] = Math.sin(el) * r;
      pos[i * 3 + 2] = Math.sin(az) * Math.cos(el) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.7,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    this.starPoints = new THREE.Points(starGeo, this.starMaterial);
    this.starPoints.renderOrder = -11;
    // The companion sun gets its own light; both lights aim
    // through the primary's target, which rides the camera (added
    // to the scene here so its matrix updates).
    this.sunLightB = new THREE.DirectionalLight(0xffd9a0, 0);
    scene.add(this.sunLightB);
    scene.add(dirLight.target);
    this.skyGroup.add(this.sunGlowA);
    this.skyGroup.add(this.sunMeshA);
    this.skyGroup.add(this.sunGlowB);
    this.skyGroup.add(this.sunMeshB);
    this.skyGroup.add(this.planetGroup);
    this.skyGroup.add(this.starPoints);
    scene.add(this.skyGroup);
  }

  /**
   * Per-frame placement: the dome follows the camera so it is
   * never approached; the suns cross the day band as a pair (B
   * trailing A), the ringed giant crosses the night band on the
   * mirrored path, and the lights ride their bodies. At night
   * the primary light repositions to the giant — planetshine.
   * Underground (cavern/ruin), the sky simply isn't.
   */
  public update(cycle: number, camPos: THREE.Vector3, underground: boolean): void {
    this.skyGroup.visible = !underground;
    if (underground) return;
    this.skyGroup.position.copy(camPos);
    // Signed sun elevation over the whole cycle: +1 at noon, -1
    // at midnight, zero at both horizons.
    const sunSigned = Math.sin((Math.PI * (cycle - 0.25)) / 0.5);
    const dayT = (cycle - 0.25) / 0.5;
    const pathDir = (t: number) => {
      const el = Math.sin(Math.PI * t);
      const az = Math.PI * (1 - t);
      return new THREE.Vector3(Math.cos(az) * 0.92, el, 0.38).normalize();
    };
    const R = 165;
    // The binary pair: B trails A along the same path by a
    // fraction of the day band.
    const inDayBand = dayT >= -0.04 && dayT <= 1.04;
    const dirA = pathDir(THREE.MathUtils.clamp(dayT, 0, 1));
    const dirB = pathDir(THREE.MathUtils.clamp(dayT - 0.055, 0, 1));
    this.sunMeshA.visible = inDayBand;
    this.sunGlowA.visible = inDayBand;
    this.sunMeshB.visible = inDayBand && dayT > 0.03;
    this.sunGlowB.visible = this.sunMeshB.visible;
    this.sunMeshA.position.copy(dirA).multiplyScalar(R);
    this.sunGlowA.position.copy(dirA).multiplyScalar(R + 1);
    this.sunMeshB.position.copy(dirB).multiplyScalar(R);
    this.sunGlowB.position.copy(dirB).multiplyScalar(R + 1);
    this.sunMeshA.lookAt(camPos);
    this.sunGlowA.lookAt(camPos);
    this.sunMeshB.lookAt(camPos);
    this.sunGlowB.lookAt(camPos);
    // The giant: rises as the suns set, on the mirrored path.
    const planetT =
      cycle >= 0.75 ? (cycle - 0.75) / 0.5 : cycle < 0.25 ? (cycle + 0.25) / 0.5 : -1;
    const planetUp = planetT >= 0;
    this.planetGroup.visible = planetUp;
    let dirP: THREE.Vector3 | null = null;
    if (planetUp) {
      dirP = pathDir(THREE.MathUtils.clamp(planetT, 0, 1));
      this.planetGroup.position.copy(dirP).multiplyScalar(R);
      this.planetGroup.lookAt(camPos);
    }
    // The star shell wheels very slowly with the cycle.
    this.starPoints.rotation.y = cycle * 0.8;
    // Lights ride their bodies; one shared target at the camera
    // keeps the direction honest in every zone.
    const target = this.dirLight.target;
    target.position.copy(camPos);
    target.updateMatrixWorld();
    if (sunSigned >= -0.12) {
      this.dirLight.position.copy(camPos).addScaledVector(dirA, 70);
      this.sunLightB.position.copy(camPos).addScaledVector(dirB, 70);
      this.sunLightB.target = target;
    } else {
      // Night: the giant's shine takes the primary light.
      const p = dirP ?? pathDir(0.5);
      this.dirLight.position.copy(camPos).addScaledVector(p, 70);
      this.sunLightB.intensity = 0;
    }
  }
}
