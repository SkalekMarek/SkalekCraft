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
            // Wolf Model (Smaller, No Snout, Ears)
            // Body (Grey/Silver)
            // Reduced size: 0.8 -> 0.5, 1.3 -> 0.9
            const bodyGeo = new THREE.BoxGeometry(0.5, 0.5, 0.9);
            const furMat = new THREE.MeshStandardMaterial({ color: 0x999999 }); // Grey
            this.body = new THREE.Mesh(bodyGeo, furMat);
            this.body.position.y = 0.4; // Lower due to size
            this.group.add(this.body);

            // Head
            // Reduced size: 0.7 -> 0.45
            const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
            const loader = new THREE.TextureLoader();
            const faceTexture = loader.load('textures/ulrich.jpeg');
            faceTexture.magFilter = THREE.NearestFilter;
            const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture });

            // Apply face to front, fur to others
            const headMats = [
                furMat, furMat, // x
                furMat, furMat, // y
                faceMat, furMat // z
            ];

            this.head = new THREE.Mesh(headGeo, headMats);
            this.head.position.set(0, 0.5, 0.7); // Adjusted pos relative to body
            this.body.add(this.head); // Attach to body so it moves with it? logic below adds to group logic usually.
            // Wait, previous code added head to group. Let's keep consistency.
            // Previous: head.position.set(0, 1.2, 0.9); group.add(head);
            // Let's attach head to body for better animation potential later? 
            // The existing code for other mobs adds head to group. I will stick to group for safety unless I want to change animation logic.
            // Actually, attaching to body makes "body rotation" rotate head too.
            // But let's stick to the pattern: group.add(head).
            // New pos needs to match scaled body. Body center is y=0.4. Height=0.5. Top=0.65.
            // Head center y should be around 0.8.

            // Re-evaluating attachment:
            // logic in update() doesn't rotate body x/z, so group structure is fine.
            // Let's use group.add(head)

            // Resetting head parentage to group to match others.
        } else if (type === 'ulrich') {
            // Wolf Model (Refined: Smaller, Ears, No Snout)

            // Body 
            const bodyGeo = new THREE.BoxGeometry(0.5, 0.5, 0.9);
            const furMat = new THREE.MeshStandardMaterial({ color: 0x999999 });
            this.body = new THREE.Mesh(bodyGeo, furMat);
            this.body.position.y = 0.5;
            this.group.add(this.body);

            // Head (Smaller)
            const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
            const loader = new THREE.TextureLoader();
            const faceTexture = loader.load('textures/ulrich.jpeg');
            faceTexture.magFilter = THREE.NearestFilter;
            const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture });

            const headMats = [
                furMat, furMat,
                furMat, furMat,
                faceMat, furMat
            ];

            this.head = new THREE.Mesh(headGeo, headMats);
            this.head.position.set(0, 0.95, 0.65); // Just above body front
            this.group.add(this.head);

            // Ears (New!)
            const earGeo = new THREE.BoxGeometry(0.1, 0.15, 0.1);
            // Left Ear
            const earL = new THREE.Mesh(earGeo, furMat);
            earL.position.set(-0.12, 0.25, -0.05); // Top of head
            this.head.add(earL);
            // Right Ear
            const earR = new THREE.Mesh(earGeo, furMat);
            earR.position.set(0.12, 0.25, -0.05);
            this.head.add(earR);

            // NO SNOUT explicitly

            // Tail (Smaller)
            const tailGeo = new THREE.BoxGeometry(0.12, 0.12, 0.5);
            const tail = new THREE.Mesh(tailGeo, furMat);
            tail.position.set(0, 0.1, -0.5);
            tail.rotation.x = -0.5;
            this.body.add(tail);

            // Legs (Smaller)
            this.legs = [];
            const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
            const legPos = [
                { x: -0.15, z: 0.25 }, { x: 0.15, z: 0.25 },
                { x: -0.15, z: -0.25 }, { x: 0.15, z: -0.25 }
            ];
            legPos.forEach(p => {
                const leg = new THREE.Mesh(legGeo, furMat);
                leg.position.set(p.x, 0.2, p.z);
                this.legs.push(leg);
                this.group.add(leg);
            });

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

        // Normal Mob Gravity/Water
        if (headBlock === 'water') {
            this.velocity.y = 5; // Float up like holding space
            this.velocity.x *= 0.8; // Water resistance
            this.velocity.z *= 0.8;
        } else {
            this.velocity.y -= 25 * delta;
        }

        // Physics / movement Intent
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



        // Apply Horizontal Velocity (with friction/acceleration)
        let speed = 3.0;
        if (this.type === 'ulrich') speed = 5.0; // Faster wolf

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
            if (this.legs && this.legs.length >= 4) {
                this.legs[0].rotation.x = Math.sin(time * walkSpeed) * 0.5;
                this.legs[1].rotation.x = Math.sin(time * walkSpeed + Math.PI) * 0.5;
                this.legs[2].rotation.x = Math.sin(time * walkSpeed + Math.PI) * 0.5;
                this.legs[3].rotation.x = Math.sin(time * walkSpeed) * 0.5;
            }

            // Tail Wag (Simple)
            if (this.type === 'ulrich') {
                // Tail is last child of body usually? No, let's find it. 
                // In creation: body.add(tail). Tag it?
                // Just assuming child 0 based on logic, but be careful.
                // Actually in creation I did body.add(tail) so it's body.children[0]
                if (this.body && this.body.children[0]) {
                    this.body.children[0].rotation.y = Math.sin(time * 15) * 0.3;
                }
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
