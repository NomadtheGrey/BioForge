// ============================================================================
// structureLife.ts — per-frame "alive" passes for grown structures
// ============================================================================
// Extracted from threeEngine.ts (2026-10-17, Adam's layout ruling:
// when a landing touches a monolith, the piece it touches moves out
// into its own module as part of the same landing). The engine owns
// the frame loop and calls these; everything about how a structure
// BREATHES, pulses, and tells its state lives here.
//
// The heartbeat math (pulseHeartbeat, phaseForId) lives in
// game/structures/lifePulse.ts so this module and the builders share it.
// Geometry is built ONCE per structure (structureBuilders.ts) —
// these passes never allocate, they only stir named parts.
// ============================================================================

import * as THREE from 'three';
import type { StructureEntity } from '../../types/game';
import { pulseHeartbeat, phaseForId } from './lifePulse';

/**
 * The culture vat's life (Adam, 2026-10-15; grotesque pass 2026-10-17):
 * the sac breathes on a slow swell, and the curled silhouette inside
 * (vatCore) firms up with gestation — opacity, scale, and a restless
 * shiver at full term. The grotesque pass adds veins ('vatVeins') whose
 * heartbeat QUICKENS as gestation progresses: an idle vat throbs slow
 * and faint, a vat near hatching throbs fast and hard. The pulse reads
 * the same gestation record as the core, so the veins and the creature
 * inside are always in the same hurry.
 */
export function updateVatLife(
  structureMeshMap: Map<string, THREE.Group>,
  elapsedTime: number,
): void {
  structureMeshMap.forEach((mesh) => {
    const entity = mesh.userData.entity as StructureEntity | undefined;
    if (!entity || entity.type !== 'culture_vat') return;
    const sac = mesh.getObjectByName('vatSac');
    const core = mesh.getObjectByName('vatCore') as THREE.Mesh | undefined;
    const phase = entity.id.length * 1.7;
    if (sac) {
      const b = 1 + 0.028 * Math.sin(elapsedTime * 1.3 + phase);
      sac.scale.set(b, 1.12 * b, b);
    }
    // The vein heartbeat: rate and strength scale with gestation.
    const g = entity.vat?.gestating;
    const f = g && g.total > 0 ? Math.min(1, g.progress / g.total) : 0;
    const veins = mesh.getObjectByName('vatVeins');
    if (veins) {
      const first = veins.children[0] as THREE.Mesh | undefined;
      const mat = first?.material as THREE.MeshStandardMaterial | undefined;
      if (mat) {
        // 1.7s beats with nothing gestating, ~0.8s at full term.
        const p = pulseHeartbeat(elapsedTime, 1.7 - 0.9 * f, phaseForId(entity.id));
        const strength = 0.25 + 0.75 * f;
        veins.scale.setScalar(1 + 0.05 * strength * p);
        mat.emissiveIntensity = 0.08 + strength * p;
      }
    }
    if (!core) return;
    if (!g) {
      core.scale.setScalar(0.001);
      return;
    }
    const s = 0.25 + 0.85 * f;
    core.scale.set(s, s * 1.08, s);
    core.rotation.y = elapsedTime * 0.25 + phase;
    core.position.y = 0.92 + (f >= 1 ? 0.05 * Math.sin(elapsedTime * 2.2 + phase) : 0);
    const mat = core.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.25 + 0.65 * f;
    mat.emissiveIntensity = f >= 1 ? 0.7 + 0.3 * Math.sin(elapsedTime * 2.2 + phase) : 0.25;
  });
}

/**
 * Tunnel life (2026-10-16; grotesque pass 2026-10-17): a BioTunnel
 * mouth's glow tells the pair's state at a glance — while the pair is
 * whole (the derived flag on the entity record, refreshed by App at
 * sync) the throat's inner membrane burns teal and stirs on a slow
 * breath, phased by entity id like the vats; with an end gone it goes
 * dark and still. Presentation only: pairing truth lives in
 * game/world/tunnel.ts.
 *
 * The grotesque pass adds two more named parts. The veins
 * ('tunnelVeins') throb on the double-thump heartbeat whenever the
 * pair is whole — phased per mouth so a pair never throbs in sync —
 * and the lip ('tunnelLip') ripples with a slow peristaltic wave.
 * Unpaired, everything goes slack, dark, and still: veins flat and
 * unlit, the lip unrippled — a mouth with nothing to say.
 */
export function updateTunnelLife(
  structureMeshMap: Map<string, THREE.Group>,
  elapsedTime: number,
): void {
  structureMeshMap.forEach((mesh) => {
    const entity = mesh.userData.entity as StructureEntity | undefined;
    if (!entity || entity.type !== 'biotunnel_mouth') return;
    const phase = entity.id.length * 1.7;
    const paired = !!entity.tunnel?.paired;
    // The pairing tell — unchanged from the 2026-10-16 pass; the
    // membrane just hangs inside the gullet now instead of capping
    // the front.
    const membrane = mesh.getObjectByName('tunnelMembrane') as THREE.Mesh | undefined;
    if (membrane) {
      const mat = membrane.material as THREE.MeshStandardMaterial;
      if (paired) {
        const stir = 1 + 0.035 * Math.sin(elapsedTime * 1.6 + phase);
        membrane.scale.set(stir, stir, 1);
        mat.emissiveIntensity = 0.55 + 0.3 * Math.sin(elapsedTime * 1.6 + phase);
        mat.opacity = 0.55;
      } else {
        membrane.scale.set(1, 1, 1);
        mat.emissiveIntensity = 0;
        mat.opacity = 0.92;
      }
    }
    // The veins: heartbeat while the pair is whole, flat when not.
    const veins = mesh.getObjectByName('tunnelVeins');
    if (veins) {
      const first = veins.children[0] as THREE.Mesh | undefined;
      const mat = first?.material as THREE.MeshStandardMaterial | undefined;
      if (mat) {
        if (paired) {
          const p = pulseHeartbeat(elapsedTime, 1.6, phaseForId(entity.id));
          veins.scale.setScalar(1 + 0.05 * p);
          mat.emissiveIntensity = 0.12 + 0.9 * p;
        } else {
          veins.scale.setScalar(1);
          mat.emissiveIntensity = 0;
        }
      }
    }
    // The lip: a slow peristaltic ripple while paired, slack when not.
    const lip = mesh.getObjectByName('tunnelLip');
    if (lip) {
      if (paired) {
        const r = 1 + 0.03 * Math.sin(elapsedTime * 1.1 + phase);
        lip.scale.set(r, r, 1);
      } else {
        lip.scale.set(1, 1, 1);
      }
    }
  });
}

/**
 * The Heart Tile's life (Adam, 2026-10-17): the tile has a heart, and
 * it beats. The 'heartOrgan' swells on the shared double-thump
 * heartbeat (~1.1s cycle) — scale bulge plus an emissive swell from
 * within — phased per entity so neighboring tiles never beat in sync.
 * The pass only stirs the named part; geometry is built once per tile.
 */
export function updateHeartLife(
  structureMeshMap: Map<string, THREE.Group>,
  elapsedTime: number,
): void {
  structureMeshMap.forEach((mesh) => {
    const entity = mesh.userData.entity as StructureEntity | undefined;
    if (!entity || entity.type !== 'heart_tile') return;
    const heart = mesh.getObjectByName('heartOrgan') as THREE.Mesh | undefined;
    if (!heart) return;
    const p = pulseHeartbeat(elapsedTime, 1.1, phaseForId(entity.id));
    heart.scale.set(0.92 * (1 + 0.09 * p), 0.92 * (1 + 0.055 * p), 0.92 * (1 + 0.09 * p));
    const mat = heart.material as THREE.MeshStandardMaterial | undefined;
    if (mat) mat.emissiveIntensity = 0.18 + 0.55 * p;
  });
}

/**
 * The Banner Post's life (Ingredient Sinks, 2026-10-17): the
 * cloth breathes on its bar. 'bannerCloth' hangs from its top
 * edge (the builder translated the geometry), so a small
 * rotation around the bar reads as wind worrying the weave —
 * a slow billow (rotation.x) over a slower drift (rotation.z),
 * phased per entity so a row of banners never moves as one.
 */
export function updateBannerLife(
  structureMeshMap: Map<string, THREE.Group>,
  elapsedTime: number,
): void {
  structureMeshMap.forEach((mesh) => {
    const entity = mesh.userData.entity as StructureEntity | undefined;
    if (!entity || entity.type !== 'banner_post') return;
    const cloth = mesh.getObjectByName('bannerCloth');
    if (!cloth) return;
    const phase = phaseForId(entity.id);
    cloth.rotation.x = 0.16 + 0.13 * Math.sin(elapsedTime * 1.15 + phase);
    cloth.rotation.z = 0.05 * Math.sin(elapsedTime * 0.6 + phase * 1.7);
  });
}
