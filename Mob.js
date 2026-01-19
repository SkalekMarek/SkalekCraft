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
        this.group.scale.set(0.7, 0.7, 0.7); // 70% size
        this.scene.add(this.group);

        this.createModel(type);
    }

    createCowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Base Brown
        ctx.fillStyle = '#4B3621';
        ctx.fillRect(0, 0, 128, 128);

        // White Patches
        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 8; i++) {
            const x = Math.random() * 128;
            const y = Math.random() * 128;
            const w = 20 + Math.random() * 40;
            const h = 20 + Math.random() * 40;
            ctx.fillRect(x, y, w, h);
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        return tex;
    }

    createModel(type) {
        if (type === 'bohy') {
            // Chicken-like model
            // Body (White)
            const bodyGeo = new THREE.BoxGeometry(0.6, 0.6, 0.8);
            const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            this.body = new THREE.Mesh(bodyGeo, whiteMat);
            this.body.position.y = 0.5;
            this.group.add(this.body);

            // Head
            const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            const loader = new THREE.TextureLoader();
            const faceTexture = loader.load('textures/bohy.png');
            faceTexture.magFilter = THREE.NearestFilter;
            const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture });

            const headMats = [
                whiteMat, whiteMat,
                whiteMat, whiteMat,
                faceMat, whiteMat
            ];
            this.head = new THREE.Mesh(headGeo, headMats);
            this.head.position.set(0, 0.9, 0.5);
            this.group.add(this.head);

            // Legs (Yellow)
            this.legs = [];
            const legGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
            const yellowMat = new THREE.MeshStandardMaterial({ color: 0xFFFF00 });
            const legPos = [
                { x: -0.2, z: 0.1 }, { x: 0.2, z: 0.1 },
                { x: -0.2, z: -0.1 }, { x: 0.2, z: -0.1 }
            ];
            legPos.forEach(p => {
                const leg = new THREE.Mesh(legGeo, yellowMat);
                leg.position.set(p.x, 0.25, p.z);
                this.legs.push(leg);
                this.group.add(leg);
            });

        } else if (type === 'kohoutek') {
            // Cow-like model (Larger by ~30%, Dark Brown, patches)
            // Body with Procedural Texture
            const bodyGeo = new THREE.BoxGeometry(1.2, 1.2, 1.8); // +30% size

            // Create unique texture for each cow so patterns look different
            const cowTexture = this.createCowTexture();
            const brownMat = new THREE.MeshStandardMaterial({ map: cowTexture });

            this.body = new THREE.Mesh(bodyGeo, brownMat);
            this.body.position.y = 0.9;
            this.group.add(this.body);

            // Head
            const headGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
            const loader = new THREE.TextureLoader();
            const faceTexture = loader.load('textures/kohoutek.png');
            faceTexture.magFilter = THREE.NearestFilter;
            const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture });

            // Reuse brown mat for head sides so it matches body
            const headMats = [
                brownMat, brownMat,
                brownMat, brownMat,
                faceMat, brownMat
            ];
            this.head = new THREE.Mesh(headGeo, headMats);
            this.head.position.set(0, 1.6, 1.2);
            this.group.add(this.head);

            // Legs
            this.legs = [];
            const legGeo = new THREE.BoxGeometry(0.35, 0.9, 0.35);
            const legPos = [
                { x: -0.4, z: 0.6 }, { x: 0.4, z: 0.6 },
                { x: -0.4, z: -0.6 }, { x: 0.4, z: -0.6 }
            ];
            legPos.forEach(p => {
                const leg = new THREE.Mesh(legGeo, brownMat);
                leg.position.set(p.x, 0.45, p.z);
                this.legs.push(leg);
                this.group.add(leg);
            });

        } else if (type === 'ulrich') {
            // Fish model
            // Body (Horizontal)
            const bodyGeo = new THREE.BoxGeometry(0.4, 0.6, 1.0); // Thin, tallish, long
            const fishMat = new THREE.MeshStandardMaterial({ color: 0x44aaaa }); // Teal/Silver
            this.body = new THREE.Mesh(bodyGeo, fishMat);
            this.body.position.y = 0.3;
            // Rotate body to be horizontal effectively if needed, but Box is already aligned Z
            // Let's add fins

            // Tail
            const tailGeo = new THREE.BoxGeometry(0.1, 0.4, 0.4);
            const tail = new THREE.Mesh(tailGeo, fishMat);
            tail.position.set(0, 0, -0.6);
            this.body.add(tail);

            // Face
            const faceGeo = new THREE.PlaneGeometry(0.35, 0.35);
            const loader = new THREE.TextureLoader();
            const faceTexture = loader.load('textures/ulrich.jpeg');
            // faceTexture.rotation = -Math.PI / 2; // Adjust if needed
            const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture, side: THREE.DoubleSide });
            const face = new THREE.Mesh(faceGeo, faceMat);
            face.position.set(0, 0.1, 0.51); // Front
            this.body.add(face);

            this.group.add(this.body);
            this.legs = []; // No legs

        } else {
            // Pig-like model (Ceca)
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
            const faceTexture = loader.load('textures/' + type + '.png'); // ceca.png -> textures/ceca.png
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
    }

    update(delta, playerPos, isHoldingBait) {
        if (this.isDead) return;

        // Gravity
        this.velocity.y -= 25 * delta;

        // Water Physics (Swimming)
        const headBlock = this.world.getBlockType(Math.floor(this.position.x), Math.floor(this.position.y + 0.5), Math.floor(this.position.z));
        const inWater = (headBlock === 'water');

        if (this.type === 'ulrich') {
            if (inWater) {
                this.velocity.y *= 0.9; // Drag
                if (Math.abs(this.velocity.y) < 0.1) this.velocity.y = 0;

                // Keep inside water (swim)
                // If attempting to move out, block it?
                // AI will handle steering, but here we just apply generic water drag
                this.velocity.x *= 0.8;
                this.velocity.z *= 0.8;
            } else {
                // Out of water! Jump/Flop towards water
                this.velocity.y -= 25 * delta; // Gravity
                this.velocity.x *= 0.5; // High friction on land
                this.velocity.z *= 0.5;

                // Scan for water
                const now = performance.now();
                if (this.onGround && (!this.lastWaterSearch || now - this.lastWaterSearch > 2000)) { // Check every 2s
                    this.lastWaterSearch = now;
                    const range = 5; // Reduced range from 8 to 5 for performance
                    let bestWater = null;
                    let minDst = 999;
                    const bx = Math.floor(this.position.x);
                    const by = Math.floor(this.position.y);
                    const bz = Math.floor(this.position.z);

                    for (let x = -range; x <= range; x++) {
                        for (let z = -range; z <= range; z++) {
                            for (let y = -2; y <= 2; y++) { // Check nearby heights
                                if (this.world.getBlockType(bx + x, by + y, bz + z) === 'water') {
                                    const d = x * x + y * y + z * z;
                                    if (d < minDst) {
                                        minDst = d;
                                        bestWater = new THREE.Vector3(bx + x + 0.5, by + y + 0.5, bz + z + 0.5);
                                    }
                                }
                            }
                        }
                    }

                    if (bestWater) {
                        // Jump towards water
                        const dir = new THREE.Vector3().subVectors(bestWater, this.position).normalize();
                        this.velocity.x = dir.x * 4;
                        this.velocity.z = dir.z * 4;
                        this.velocity.y = 5;
                        this.onGround = false;
                    } else {
                        // Panicked flopping
                        this.velocity.y = 3;
                        this.velocity.x = (Math.random() - 0.5) * 2;
                        this.velocity.z = (Math.random() - 0.5) * 2;
                        this.onGround = false;
                    }
                }
            }
        } else {
            // Normal Mob Gravity/Water
            if (headBlock === 'water') {
                this.velocity.y = 5; // Float up like holding space
                this.velocity.x *= 0.8; // Water resistance
                this.velocity.z *= 0.8;
            } else {
                this.velocity.y -= 25 * delta;
            }
        }

        // Physics / Movement Intent
        let moveDir = new THREE.Vector3(0, 0, 0);

        // AI: Attraction to Bait
        let attracted = false;
        if (isHoldingBait) {
            if (this.type === 'ceca' && isHoldingBait === 'cecabait') attracted = true;
            if (this.type === 'bohy' && isHoldingBait === 'bohybait') attracted = true;
            if (this.type === 'kohoutek' && isHoldingBait === 'kohoutekbait') attracted = true;
            if (this.type === 'ulrich' && isHoldingBait === 'ulrichbait') attracted = true;
        }

        if (attracted) {
            const dist = this.position.distanceTo(playerPos);
            let stopDist = 2.5;
            if (this.type === 'kohoutek') stopDist = 3.5;

            if (dist < 30 && dist > stopDist) {
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

        // Special restriction for Ulrich: Stay in water if already in water
        if (this.type === 'ulrich' && inWater && !attracted) {
            // If moveDir would take us into non-water, cancel or invert it?
            // Simple check: Look ahead
            const nextPos = this.position.clone().add(moveDir.clone().multiplyScalar(0.5));
            const nextBlock = this.world.getBlockType(Math.floor(nextPos.x), Math.floor(nextPos.y), Math.floor(nextPos.z));
            if (nextBlock !== 'water') {
                moveDir.set(0, 0, 0); // Don't swim onto land
                this.isWandering = false; // Pick new dir later
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

            // Ulrich Tail Wag
            if (this.type === 'ulrich') {
                this.body.children[0].rotation.y = Math.sin(time * 20) * 0.5; // Tail is 1st child
            }
        } else {
            // Reset legs
            if (this.legs) this.legs.forEach(l => l.rotation.x = 0);
        }
    }

    handleCollisions(axis) {
        // Simple bounding box check against world blocks
        const width = 0.6 * 0.7; // ~0.42
        const height = 1.4 * 0.7; // ~0.98

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
                            // Auto-Step Up Logic
                            if (this.onGround && y === Math.floor(this.position.y)) {
                                const blockAbove = this.world.getBlockType(x, y + 1, z);
                                const blockTwoAbove = this.world.getBlockType(x, y + 2, z);
                                if ((!blockAbove || blockAbove === 'water') && (!blockTwoAbove || blockTwoAbove === 'water')) {
                                    this.position.y += 1.1;
                                    return; // Successfully stepped up, ignore this collision
                                }
                            }

                            if (this.velocity.x > 0) this.position.x = x - width / 2 - 0.001;
                            else this.position.x = x + 1 + width / 2 + 0.001;
                        } else if (axis === 'z') {
                            // Auto-Step Up Logic
                            if (this.onGround && y === Math.floor(this.position.y)) {
                                const blockAbove = this.world.getBlockType(x, y + 1, z);
                                const blockTwoAbove = this.world.getBlockType(x, y + 2, z);
                                if ((!blockAbove || blockAbove === 'water') && (!blockTwoAbove || blockTwoAbove === 'water')) {
                                    this.position.y += 1.1;
                                    return; // Successfully stepped up, ignore this collision
                                }
                            }

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
