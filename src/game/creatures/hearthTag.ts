// hearthTag.ts — the Hearth Dog's visible decide timer (Adam,
// 2026-10-16), extracted from threeEngine the day it was written:
// the engine file sits at the single-push size cap, and this keeper
// is exactly the kind of self-contained piece that lives outside it
// (the waterField / skyRig precedent). The engine's syncFauna calls
// updateHearthTag for the one undecided dog; everything about the
// tag — canvas, ring, label, pips — is here and nowhere else.
import * as THREE from 'three';
import type { FaunaEntity } from '../../types/game';

// The Hearth Dog's decide tag (Adam, 2026-10-16): a small
// floating plate over an undecided dog — an amber ring that
// drains as his thirty days run down, the label 'Deciding · Nd'
// saying what the timer is FOR in a word or two, and three pips
// for the offerings he has taken. A child of the dog's own mesh
// group, so it follows him for free; the canvas redraws only
// when the day count or the pips change. Bonded or clockless
// dogs wear nothing — a decided dog has no timer to show.
export function updateHearthTag(mesh: THREE.Group, f: FaunaEntity, growth: number): void {
  const deciding = !f.isTamed && f.hearthDecideTimer !== undefined;
  const existing = mesh.getObjectByName('hearthTag') as THREE.Sprite | undefined;
  if (!deciding) {
    if (existing) {
      mesh.remove(existing);
      (existing.material as THREE.SpriteMaterial).map?.dispose();
      (existing.material as THREE.SpriteMaterial).dispose();
    }
    return;
  }
  const daysLeft = Math.max(0, Math.ceil((f.hearthDecideTimer ?? 0) / 600));
  const feedings = f.hearthFeedings ?? 0;
  const labelKey = `${daysLeft}|${feedings}`;
  let sprite = existing;
  if (!sprite) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas);
    sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.name = 'hearthTag';
    sprite.position.set(0, 1.35, 0);
    sprite.userData.hearthCanvas = canvas;
    sprite.userData.hearthTexture = texture;
    mesh.add(sprite);
  }
  // The sprite lives inside the (growing) dog group; counter-scale
  // so the tag itself stays one readable size at every age.
  sprite.scale.set(1.7 / growth, 0.85 / growth, 1);
  if (sprite.userData.hearthLabelKey === labelKey) return;
  sprite.userData.hearthLabelKey = labelKey;
  const canvas = sprite.userData.hearthCanvas as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, 256, 128);
  // Plate.
  ctx.fillStyle = 'rgba(8, 10, 14, 0.55)';
  ctx.beginPath();
  ctx.roundRect(28, 18, 200, 92, 14);
  ctx.fill();
  // The ring: what is left of the thirty days.
  const frac = Math.max(0, Math.min(1, (f.hearthDecideTimer ?? 0) / 18000));
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  ctx.arc(62, 56, 21, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(62, 56, 21, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
  // The label, in Adam's word or two.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 27px system-ui, sans-serif';
  ctx.fillText(`Deciding · ${daysLeft}d`, 94, 66);
  // The offerings: three pips, lit as taken.
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(102 + i * 26, 92, 7, 0, Math.PI * 2);
    if (i < feedings) {
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  (sprite.userData.hearthTexture as THREE.CanvasTexture).needsUpdate = true;
}
