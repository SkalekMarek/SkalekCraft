import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Player {
    constructor(camera, domElement, world) {
        this.camera = camera;
        this.world = world;
        this.controls = new PointerLockControls(camera, domElement);

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.input = { forward: false, backward: false, left: false, right: false, sprint: false, jump: false, down: false, crouch: false };
        this.canJump = false;

        // Water / State
        this.isSwimming = false;
        this.headSubmerged = false;

        this.defaultHeight = 1.6;
        this.crouchHeight = 1.0;
        this.currentHeight = 1.6;
        this.wasCrouching = false;

        this.setupInputs();
    }

    setupInputs() {
        // ... (Keep existing input setup but improve key handling if needed, existing looked okay-ish, but let's be robust)
        const onKeyDown = (event) => {
            switch (event.code) {
                case 'ArrowUp': case 'KeyW': this.input.forward = true; break;
                case 'ArrowLeft': case 'KeyA': this.input.left = true; break;
                case 'ArrowDown': case 'KeyS': this.input.backward = true; break;
                case 'ArrowRight': case 'KeyD': this.input.right = true; break;
                case 'Space':
                    this.input.jump = true;
                    if (this.canJump && !this.isSwimming) { this.velocity.y += 12; this.canJump = false; }
                    break;
                case 'ShiftLeft': case 'ShiftRight':
                    this.input.sprint = true;
                    this.input.down = true;
                    break;
                case 'ControlLeft': case 'KeyC':
                    this.input.crouch = true;
                    break;
            }
        };
        const onKeyUp = (event) => {
            switch (event.code) {
                case 'ArrowUp': case 'KeyW': this.input.forward = false; break;
                case 'ArrowLeft': case 'KeyA': this.input.left = false; break;
                case 'ArrowDown': case 'KeyS': this.input.backward = false; break;
                case 'ArrowRight': case 'KeyD': this.input.right = false; break;
                case 'Space': this.input.jump = false; break;
                case 'ShiftLeft': case 'ShiftRight':
                    this.input.sprint = false;
                    this.input.down = false;
                    break;
                case 'ControlLeft': case 'KeyC':
                    this.input.crouch = false;
                    break;
            }
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        document.addEventListener('click', () => {
            if (!this.controls.isLocked) this.controls.lock();
        });
    }

    update(delta) {
        if (!this.controls.isLocked) return;

        // Handle Un-Crouch
        if (this.input.crouch !== this.wasCrouching) {
            if (!this.input.crouch) {
                this.camera.position.y += (this.defaultHeight - this.crouchHeight);
            }
            this.wasCrouching = this.input.crouch;
        }

        // Check Environment
        this.checkIfInWater();

        // Constants
        const friction = this.isSwimming ? 4.0 : 10.0;
        const gravity = this.isSwimming ? 5.0 : 30.0;
        let walkSpeed = 50.0;
        let runSpeed = 100.0;
        let crouchSpeed = 20.0;

        if (this.isSwimming) {
            walkSpeed = 25.0;
            runSpeed = 40.0;
        }

        // Drag
        this.velocity.x -= this.velocity.x * friction * delta;
        this.velocity.z -= this.velocity.z * friction * delta;

        // Gravity / Buoyancy
        if (this.isSwimming) {
            this.velocity.y -= this.velocity.y * friction * delta;
            if (this.input.jump) this.velocity.y += 15.0 * delta;
            else if (this.input.down) this.velocity.y -= 15.0 * delta;
            else this.velocity.y -= 2.0 * delta;
        } else {
            this.velocity.y -= gravity * delta;
        }

        // Move
        this.direction.z = Number(this.input.forward) - Number(this.input.backward);
        this.direction.x = Number(this.input.right) - Number(this.input.left);
        this.direction.normalize();

        let speed = walkSpeed;
        if (this.input.sprint) speed = runSpeed;
        if (this.input.crouch) speed = crouchSpeed;

        if (this.input.forward || this.input.backward) this.velocity.z -= this.direction.z * speed * delta;
        if (this.input.left || this.input.right) this.velocity.x -= this.direction.x * speed * delta;

        // Physics X/Z
        this.controls.moveRight(-this.velocity.x * delta);
        if (this.checkCollision()) {
            this.controls.moveRight(this.velocity.x * delta);
            this.velocity.x = 0;
        }

        this.controls.moveForward(-this.velocity.z * delta);
        if (this.checkCollision()) {
            this.controls.moveForward(this.velocity.z * delta);
            this.velocity.z = 0;
        }

        // Physics Y
        this.camera.position.y += this.velocity.y * delta;

        if (this.checkCollision()) {
            if (this.velocity.y < 0) { // Landing
                this.camera.position.y -= this.velocity.y * delta;
                this.velocity.y = 0;
                this.canJump = true;
            } else { // Ceiling
                this.camera.position.y -= this.velocity.y * delta;
                this.velocity.y = 0;
            }
        }

        if (this.camera.position.y < -30) {
            this.camera.position.set(0, 30, 0);
            this.velocity.set(0, 0, 0);
        }

        // Visuals (Fog)
        if (this.headSubmerged) {
            this.world.scene.fog.color.setHex(0x001e0f);
            this.world.scene.fog.near = 1;
            this.world.scene.fog.far = 10;
        } else {
            this.world.scene.fog.color.setHex(0x87CEEB);
            this.world.scene.fog.near = 10;
            this.world.scene.fog.far = 60;
        }

        // Dynamic FOV
        let targetFOV = 75;
        if (this.input.sprint) targetFOV = 95;
        if (this.input.crouch) targetFOV = 70;
        this.camera.fov += (targetFOV - this.camera.fov) * 5 * delta;
        this.camera.updateProjectionMatrix();
    }

    checkIfInWater() {
        const p = this.camera.position;
        // Head
        const headType = this.world.getBlockType(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
        this.headSubmerged = (headType === 'water');
        // Feet
        const feetY = p.y - 1.5;
        const feetType = this.world.getBlockType(Math.floor(p.x), Math.floor(feetY), Math.floor(p.z));
        this.isSwimming = (feetType === 'water');
    }

    checkCollision() {
        const p = this.camera.position;
        const r = 0.3;
        const minX = Math.floor(p.x - r);
        const maxX = Math.floor(p.x + r);
        const minZ = Math.floor(p.z - r);
        const maxZ = Math.floor(p.z + r);

        const height = this.input.crouch ? this.crouchHeight : this.defaultHeight;
        const minY = Math.floor(p.y - height);
        const maxY = Math.floor(p.y - 0.1);

        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                for (let y = minY; y <= maxY; y++) {
                    const type = this.world.getBlockType(x, y, z);
                    if (type && type !== 'water') {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
