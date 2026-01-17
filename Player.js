import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Player {
    constructor(camera, domElement, world) {
        this.camera = camera;
        this.world = world;
        this.controls = new PointerLockControls(camera, domElement);

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.input = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sprint: false
        };

        this.canJump = false;
        this.playerHeight = 1.6;
        this.playerWidth = 0.6; // For collision padding

        this.setupInputs();
    }

    setupInputs() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Locking
        document.addEventListener('click', () => {
            if (!this.controls.isLocked) this.controls.lock();
        });
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': this.input.forward = true; break;
            case 'ArrowLeft': case 'KeyA': this.input.left = true; break;
            case 'ArrowDown': case 'KeyS': this.input.backward = true; break;
            case 'ArrowRight': case 'KeyD': this.input.right = true; break;
            case 'Space':
                if (this.canJump) {
                    this.velocity.y += 10; // Jump force
                    this.canJump = false;
                }
                break;
            case 'ShiftLeft': case 'ShiftRight': this.input.sprint = true; break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': this.input.forward = false; break;
            case 'ArrowLeft': case 'KeyA': this.input.left = false; break;
            case 'ArrowDown': case 'KeyS': this.input.backward = false; break;
            case 'ArrowRight': case 'KeyD': this.input.right = false; break;
            case 'ShiftLeft': case 'ShiftRight': this.input.sprint = false; break;
        }
    }

    update(delta) {
        if (!this.controls.isLocked) return;

        // Apply Damping
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;

        // Gravity
        this.velocity.y -= 30.0 * delta;

        // Determine move direction
        this.direction.z = Number(this.input.forward) - Number(this.input.backward);
        this.direction.x = Number(this.input.right) - Number(this.input.left);
        this.direction.normalize();

        const speed = this.input.sprint ? 12.0 : 6.0;

        if (this.input.forward || this.input.backward) this.velocity.z -= this.direction.z * 80.0 * delta * (speed / 6);
        if (this.input.left || this.input.right) this.velocity.x -= this.direction.x * 80.0 * delta * (speed / 6);

        // Apply X/Z Movement with Collision checks
        this.controls.moveRight(-this.velocity.x * delta);
        if (this.checkCollision()) {
            // Revert if hit
            this.controls.moveRight(this.velocity.x * delta);
            this.velocity.x = 0;
        }

        this.controls.moveForward(-this.velocity.z * delta);
        if (this.checkCollision()) {
            // Revert if hit
            this.controls.moveForward(this.velocity.z * delta);
            this.velocity.z = 0;
        }

        // Apply Y Movement
        this.camera.position.y += this.velocity.y * delta;

        // Simple Ground Collision
        if (this.checkCollision()) {
            // If falling down
            if (this.velocity.y < 0) {
                this.camera.position.y -= this.velocity.y * delta; // revert
                // Snap to nearest integer probably? 
                // For now just stop
                this.velocity.y = 0;
                this.canJump = true;
            } else {
                // Hit head
                this.camera.position.y -= this.velocity.y * delta;
                this.velocity.y = 0;
            }
        }

        // Void check
        if (this.camera.position.y < -20) {
            this.camera.position.set(0, 20, 0);
            this.velocity.set(0, 0, 0);
        }

        // FOV
        const targetFOV = this.input.sprint ? 85 : 75;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.1);
        this.camera.updateProjectionMatrix();
    }

    // AABB Collision with world blocks
    // Very naive: check the block the player camera is in
    checkCollision() {
        // Player Bounding Box (approximate)
        // x/z radius = 0.3, y = 1.6 down
        const p = this.camera.position;
        const radius = 0.3;
        const height = 1.6;

        // Check feet and head and mid
        // We really need to check neighboring blocks to the player's position
        const minX = Math.floor(p.x - radius);
        const maxX = Math.floor(p.x + radius);
        const minY = Math.floor(p.y - height);
        const maxY = Math.floor(p.y);
        const minZ = Math.floor(p.z - radius);
        const maxZ = Math.floor(p.z + radius);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (this.world.getBlock(x, y, z)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
