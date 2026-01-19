import * as THREE from 'three';

export class Mob {
    constructor(scene, world, position, type = 'ceca') {
        this.scene = scene;
        this.world = world;
        this.type = type;
        this.position = position.clone();
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.onGround = false;
        this.isDead = false;

        // Visuals
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.scene.add(this.group);

        this.createModel(type);
    }

    createModel(type) {
        // Pig-like model
        // Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 1.2);
        const pinkMat = new THREE.MeshStandardMaterial({ color: 0xFFC0CB }); // Pink
        this.body = new THREE.Mesh(bodyGeo, pinkMat);
        this.body.position.y = 0.6;
        this.group.add(this.body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
        // Face Texture
        const loader = new THREE.TextureLoader();
        const faceTexture = loader.load(type + '.png'); // ceca.png
        faceTexture.magFilter = THREE.NearestFilter;

        const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture });
        const headMats = [
            pinkMat, pinkMat, // x
            pinkMat, pinkMat, // y
            faceMat, pinkMat  // z (face is usually +z or -z depending on orientation)
        ];

        this.head = new THREE.Mesh(headGeo, headMats);
        this.head.position.set(0, 1.1, 0.8); // Slightly forward and up
        this.group.add(this.head);

        // Legs
        this.legs = [];
        const legGeo = new THREE.BoxGeometry(0.25, 0.6, 0.25);
        const legPos = [
            { x: -0.25, z: 0.4 }, { x: 0.25, z: 0.4 },
            { x: -0.25, z: -0.4 }, { x: 0.25, z: -0.4 }
        ];

        legPos.forEach(p => {
            const leg = new THREE.Mesh(legGeo, pinkMat);
            leg.position.set(p.x, 0.3, p.z);
            this.legs.push(leg);
            this.group.add(leg);
        });
    }

    update(delta, playerPos, isHoldingBait) {
        if (this.isDead) return;

        // Gravity
        this.velocity.y -= 25 * delta;

        // Water Physics (Swimming)
        const headBlock = this.world.getBlockType(Math.floor(this.position.x), Math.floor(this.position.y + 0.5), Math.floor(this.position.z));
        if (headBlock === 'water') {
            this.velocity.y = 5; // Float up like holding space
            this.velocity.x *= 0.8; // Water resistance
            this.velocity.z *= 0.8;
        }

        // Physics / Movement Intent
        let moveDir = new THREE.Vector3(0, 0, 0);

        // AI: Attraction to Bait
        if (isHoldingBait && this.type === 'ceca') { // Only Ceca likes cecabait
            const dist = this.position.distanceTo(playerPos);
            if (dist < 20 && dist > 2.5) { // Stop 1 block away (approx 1.5 + radius)
                moveDir.subVectors(playerPos, this.position).normalize();
            }
        } else {
            // Wander Randomly (Simple)
            if (Math.random() < 0.02) {
                this.wanderAngle = Math.random() * Math.PI * 2;
                this.isWandering = true;
            }
            if (Math.random() < 0.01) this.isWandering = false;

            if (this.isWandering) {
                moveDir.x = Math.sin(this.wanderAngle);
                moveDir.z = Math.cos(this.wanderAngle);
            }
        }

        // Apply Horizontal Velocity (with friction/acceleration)
        const speed = 3.0;
        this.velocity.x = moveDir.x * speed;
        this.velocity.z = moveDir.z * speed;

        // Collision & Integration
        this.position.x += this.velocity.x * delta;
        this.handleCollisions('x');
        this.position.z += this.velocity.z * delta;
        this.handleCollisions('z');
        this.position.y += this.velocity.y * delta;
        this.handleCollisions('y');

        this.group.position.copy(this.position);

        // Rotation (Look at move dir)
        if (moveDir.lengthSq() > 0.1) {
            const targetRot = Math.atan2(moveDir.x, moveDir.z);
            this.group.rotation.y = targetRot;

            // Walk Animation
            const walkSpeed = 10;
            const time = performance.now() / 1000;
            this.legs[0].rotation.x = Math.sin(time * walkSpeed) * 0.5;
            this.legs[1].rotation.x = Math.sin(time * walkSpeed + Math.PI) * 0.5;
            this.legs[2].rotation.x = Math.sin(time * walkSpeed + Math.PI) * 0.5;
            this.legs[3].rotation.x = Math.sin(time * walkSpeed) * 0.5;
        } else {
            // Reset legs
            this.legs.forEach(l => l.rotation.x = 0);
        }
    }

    handleCollisions(axis) {
        // Simple bounding box check against world blocks
        const width = 0.6;
        const height = 1.4; // Pig height approx

        const minX = Math.floor(this.position.x - width / 2);
        const maxX = Math.floor(this.position.x + width / 2);
        const minY = Math.floor(this.position.y);
        const maxY = Math.floor(this.position.y + height);
        const minZ = Math.floor(this.position.z - width / 2);
        const maxZ = Math.floor(this.position.z + width / 2);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const block = this.world.getBlockType(x, y, z);
                    if (block && block !== 'water') { // Solid block collision
                        if (axis === 'y') {
                            if (this.velocity.y < 0) { // Falling
                                this.position.y = y + 1.001;
                                this.velocity.y = 0;
                                this.onGround = true;
                            } else if (this.velocity.y > 0) { // Jumping/Head hit
                                this.position.y = y - height - 0.001;
                                this.velocity.y = 0;
                            }
                        } else if (axis === 'x') {
                            if (this.velocity.x > 0) this.position.x = x - width / 2 - 0.001;
                            else this.position.x = x + 1 + width / 2 + 0.001;
                        } else if (axis === 'z') {
                            if (this.velocity.z > 0) this.position.z = z - width / 2 - 0.001;
                            else this.position.z = z + 1 + width / 2 + 0.001;
                        }
                        return; // Collided
                    }
                }
            }
        }
        if (axis === 'y' && this.velocity.y < 0) this.onGround = false; // logic check
    }
}
