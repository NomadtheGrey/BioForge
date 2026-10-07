/**
 * BioForge First-Person Velocity Controller
 * Computes smooth continuous WASD acceleration, damping, and collision response
 * Enforces CODE_MANIFESTO.md Rule 1 (Zero 'else' / 'else if'), Rule 3 (Memoization), Rule 9 (Strict Types)
 */

import * as THREE from 'three';
import { StructureEntity, FloraEntity } from '../types/game';
import { resolveMovementWithCollision } from './collision';

// Scratch vectors pre-allocated at module scope (Rule 3)
const SCRATCH_FORWARD = new THREE.Vector3();
const SCRATCH_RIGHT = new THREE.Vector3();
const DESIRED_DIR = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export interface ControllerInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

export class FirstPersonMovementController {
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public maxSpeed: number = 6.4;
  public acceleration: number = 28.0;
  public friction: number = 16.0;

  public update(
    dt: number,
    currentX: number,
    currentZ: number,
    camera: THREE.Camera,
    input: ControllerInputState,
    isPaused: boolean,
    structures: StructureEntity[],
    flora: FloraEntity[]
  ): { x: number; z: number; isMoving: boolean } {
    // Guard Clause 1: If Esc / pause mode is active, damp velocity immediately and return
    if (isPaused) {
      this.velocity.set(0, 0, 0);
      return { x: currentX, z: currentZ, isMoving: false };
    }

    // Guard Clause 2: If delta time is non-positive or corrupted, return current position
    if (dt <= 0) {
      return { x: currentX, z: currentZ, isMoving: false };
    }

    // Calculate discrete input axes (flat, zero else)
    let moveZ = 0;
    if (input.forward) {
      moveZ += 1;
    }
    if (input.backward) {
      moveZ -= 1;
    }

    let moveX = 0;
    if (input.right) {
      moveX += 1;
    }
    if (input.left) {
      moveX -= 1;
    }

    // Get camera horizontal forward & right vectors
    camera.getWorldDirection(SCRATCH_FORWARD);
    SCRATCH_FORWARD.y = 0;
    SCRATCH_FORWARD.normalize();

    // Horizontal strafe vector: Forward cross UP points directly right
    SCRATCH_RIGHT.crossVectors(SCRATCH_FORWARD, WORLD_UP).normalize();

    // Compute desired movement direction
    DESIRED_DIR.set(0, 0, 0);
    const hasInput = moveZ !== 0 || moveX !== 0;

    if (hasInput) {
      DESIRED_DIR.addScaledVector(SCRATCH_FORWARD, moveZ);
      DESIRED_DIR.addScaledVector(SCRATCH_RIGHT, moveX);
      DESIRED_DIR.normalize();
    }

    // Accelerate or decelerate velocity vectors cleanly
    if (hasInput) {
      const targetVelX = DESIRED_DIR.x * this.maxSpeed;
      const targetVelZ = DESIRED_DIR.z * this.maxSpeed;

      this.velocity.x += (targetVelX - this.velocity.x) * Math.min(1, this.acceleration * dt);
      this.velocity.z += (targetVelZ - this.velocity.z) * Math.min(1, this.acceleration * dt);
    }

    if (!hasInput) {
      const damping = Math.max(0, 1 - this.friction * dt);
      this.velocity.x *= damping;
      this.velocity.z *= damping;

      if (Math.abs(this.velocity.x) < 0.05) {
        this.velocity.x = 0;
      }
      if (Math.abs(this.velocity.z) < 0.05) {
        this.velocity.z = 0;
      }
    }

    // Compute desired frame displacement
    const deltaX = this.velocity.x * dt;
    const deltaZ = this.velocity.z * dt;
    const isMoving = Math.hypot(this.velocity.x, this.velocity.z) > 0.1;

    // Guard Clause 3: If no displacement, return current
    if (Math.abs(deltaX) < 0.0001 && Math.abs(deltaZ) < 0.0001) {
      return { x: currentX, z: currentZ, isMoving: false };
    }

    // Apply spatial collision resolution with sliding
    const resolved = resolveMovementWithCollision(
      currentX,
      currentZ,
      deltaX,
      deltaZ,
      structures,
      flora
    );

    // If movement was blocked along an axis, zero out that velocity component
    if (Math.abs(resolved.x - currentX) < Math.abs(deltaX) * 0.1) {
      this.velocity.x = 0;
    }
    if (Math.abs(resolved.z - currentZ) < Math.abs(deltaZ) * 0.1) {
      this.velocity.z = 0;
    }

    return {
      x: resolved.x,
      z: resolved.z,
      isMoving,
    };
  }

  public resetVelocity() {
    this.velocity.set(0, 0, 0);
  }
}
