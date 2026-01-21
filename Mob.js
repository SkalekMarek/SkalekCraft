import * as THREE from 'three';

export class Mob {
    constructor(scene, world, position, type = 'ceca', id = null, isRemote = false) {
        this.scene = scene;
        this.world = world;
        this.type = type;
        this.position = position.clone();
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.onGround = false;
        this.isDead = false;
        this.health = 3; // 3 Hits

        // Multiplayer
        this.id = id || crypto.randomUUID(); // Unique ID for sync
        this.isRemote = isRemote;
        this.targetPos = this.position.clone(); // For interpolation
        this.targetRot = 0;

        // Visuals
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.scale.set(0.7, 0.7, 0.7); // 70% size
        this.group.userData = { mob: this }; // Link for raycasting
        this.scene.add(this.group);

        this.createModel(type);
    }

    takeDamage(amount, attackerPos) {
        if (this.isDead) return;
        // In multiplayer, only the owner (or everyone?) processes damage?
        // Ideally, the attacker sends a 'hit' event.
        // For simplicity: Attacker simulates hit locally -> sends 'mobDeath' if health <= 0.
        // Or: Attacker sends 'mobHit' to owner? 
        // Current Plan: P2P trust. Attacker calculates damage locally.
        // If this is a remote mob, we shouldn't really calculate physics recoil here unless we sync it.
        // BUT for a simple game: Allow local feedback, then sync position updates from owner.
        // Actually, if isRemote, we probably shouldn't "own" the health logic, but we want visual feedback.

        this.health -= amount;

        // Visual Feedback (Red Flash) - Show this on all clients
        this.flashRed();

        // Physics Recoil - Only if we own it? 
        // If we knock back a remote mob, it will snap back when owner sends update. 
        // For now, let's allow local knockback for "Juice", but it might glitch back.
        if (!this.isRemote) {
            const recoil = this.position.clone().sub(attackerPos).normalize();
            recoil.y = 0.5;
            this.velocity.add(recoil.multiplyScalar(15));
            this.onGround = false;
        }

        // Death - Handled by caller broadcasting 'mobDeath'
        if (this.health <= 0) {
            this.die();
        }
    }

    // Called by network when owner says this mob moved
    updateRemote(x, y, z, ry) {
        this.targetPos.set(x, y, z);
        this.targetRot = ry;
    }

    update(delta, playerPos, isHoldingBait) {
        if (this.isDead) return;

        if (this.isRemote) {
            // INTERPOLATION for remote mobs
            this.position.lerp(this.targetPos, 10 * delta); // Smooth move
            this.group.position.copy(this.position);

            // Smooth Rotation (shortest path)
            // Simple lerp for rotation y
            // To do it properly with wrapping would be ideal, but simple lerp:
            this.group.rotation.y += (this.targetRot - this.group.rotation.y) * 10 * delta;

            // Animation (Walk if moving)
            const dist = this.position.distanceTo(this.targetPos);
            if (dist > 0.1 || Math.abs(this.group.rotation.y - this.targetRot) > 0.1) {
                const time = performance.now() / 1000;
                const walkSpeed = 10;
                if (this.legs && this.legs.length >= 4) {
                    this.legs[0].rotation.x = Math.sin(time * walkSpeed) * 0.5;
                    this.legs[1].rotation.x = Math.sin(time * walkSpeed + Math.PI) * 0.5;
                    this.legs[2].rotation.x = Math.sin(time * walkSpeed + Math.PI) * 0.5;
                    this.legs[3].rotation.x = Math.sin(time * walkSpeed) * 0.5;
                }
            } else {
                if (this.legs) this.legs.forEach(l => l.rotation.x = 0);
            }
            return; // Skip physics/AI for remote mobs
        }

        // --- LOCAL LOGIC BELOW (Gravity, AI, Physics) ---

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
                            const headBlock = this.world.getBlockType(Math.floor(this.position.x), Math.floor(this.position.y + 0.5), Math.floor(this.position.z));
                            const inWater = (headBlock === 'water');

                            if ((this.onGround || inWater) && y === Math.floor(this.position.y)) {
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
                            const headBlock = this.world.getBlockType(Math.floor(this.position.x), Math.floor(this.position.y + 0.5), Math.floor(this.position.z));
                            const inWater = (headBlock === 'water');

                            if ((this.onGround || inWater) && y === Math.floor(this.position.y)) {
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

    createModel(type) {
        // Use MeshBasicMaterial to ensure visibility and avoid black "void" look
        const material = new THREE.MeshBasicMaterial();
        let geometry;
        let bodyMesh;

        if (type === 'ceca') {
            // Pig-like
            geometry = new THREE.BoxGeometry(0.6, 0.6, 1.0);
            material.color.setHex(0xffaaaa); // Pink

            bodyMesh = new THREE.Mesh(geometry, material);
            this.group.add(bodyMesh);

            // Face
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load('textures/ceca.png', (tex) => {
                const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
                const face = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mat);
                face.position.set(0, 0, 0.51);
                this.group.add(face);
            });
        } else if (type === 'bohy') {
            // Cow-like
            geometry = new THREE.BoxGeometry(0.7, 1.0, 1.2);
            material.color.setHex(0x553311); // Brown
            bodyMesh = new THREE.Mesh(geometry, material);
            this.group.add(bodyMesh);
        } else if (type === 'kohoutek') {
            // Chicken-like
            geometry = new THREE.BoxGeometry(0.4, 0.6, 0.4);
            material.color.setHex(0xffffff); // White
            bodyMesh = new THREE.Mesh(geometry, material);
            this.group.add(bodyMesh);
        } else if (type === 'ulrich') {
            // Wolf-like
            geometry = new THREE.BoxGeometry(0.5, 0.6, 1.0);
            material.color.setHex(0xaaaaaa); // Grey

            this.body = new THREE.Group();
            this.group.add(this.body);
            bodyMesh = new THREE.Mesh(geometry, material);
            this.body.add(bodyMesh);

            const tailGeo = new THREE.BoxGeometry(0.2, 0.2, 0.6);
            const tail = new THREE.Mesh(tailGeo, material);
            tail.position.set(0, 0.2, -0.6);
            this.body.add(tail);
            // Removed return; continuing to leg generation
        } else {
            // Default Error Box
            geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            material.color.setHex(0xff0000);
            bodyMesh = new THREE.Mesh(geometry, material);
            this.group.add(bodyMesh);
        }

        // Legs (Generic 4 legs)
        this.legs = [];
        const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
        const legMat = material.clone();
        legMat.color.setHex(material.color.getHex() * 0.8);

        let legPositions = [
            [-0.2, -0.5, 0.3], [0.2, -0.5, 0.3],
            [-0.2, -0.5, -0.3], [0.2, -0.5, -0.3]
        ];

        if (type === 'kohoutek') {
            legPositions = [[-0.1, -0.3, 0], [0.1, -0.3, 0]];
        }

        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(...pos);
            this.group.add(leg);
            this.legs.push(leg);
        });
    }

    createModel(type) {
        // Simple Box Models for now, but distinct colors/shapes
        const material = new THREE.MeshStandardMaterial();
        let geometry;

        if (type === 'ceca') {
            // Pig-like
            geometry = new THREE.BoxGeometry(0.6, 0.6, 1.0);
            material.color.setHex(0xffaaaa); // Pink
            // Face
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load('textures/ceca.png', (tex) => {
                const mat = new THREE.MeshStandardMaterial({ map: tex });
                const face = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mat);
                face.position.set(0, 0, 0.51);
                this.group.add(face);
            });
        } else if (type === 'bohy') {
            // Cow-like
            geometry = new THREE.BoxGeometry(0.7, 1.0, 1.2);
            material.color.setHex(0x553311); // Brown
        } else if (type === 'kohoutek') {
            // Chicken-like
            geometry = new THREE.BoxGeometry(0.4, 0.6, 0.4);
            material.color.setHex(0xffffff); // White
        } else if (type === 'ulrich') {
            // Wolf-like
            geometry = new THREE.BoxGeometry(0.5, 0.6, 1.0);
            material.color.setHex(0xaaaaaa); // Grey

            // Body container for tail wag
            this.body = new THREE.Group();
            this.group.add(this.body);
            const bodyMesh = new THREE.Mesh(geometry, material);
            this.body.add(bodyMesh);

            // Tail
            const tailGeo = new THREE.BoxGeometry(0.2, 0.2, 0.6);
            const tail = new THREE.Mesh(tailGeo, material);
            tail.position.set(0, 0.2, -0.6);
            this.body.add(tail);
            return; // Special construction
        } else {
            geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            material.color.setHex(0xff0000); // Error red
        }

        const mesh = new THREE.Mesh(geometry, material);
        this.group.add(mesh);

        // Legs (Generic 4 legs)
        this.legs = [];
        const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
        const legMat = material.clone();

        const legPositions = [
            [-0.2, -0.5, 0.3], [0.2, -0.5, 0.3],
            [-0.2, -0.5, -0.3], [0.2, -0.5, -0.3]
        ];

        if (type === 'kohoutek') {
            // 2 Legs
            legPositions.length = 2;
            legPositions[0] = [-0.1, -0.3, 0];
            legPositions[1] = [0.1, -0.3, 0];
        }

        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(...pos);
            this.group.add(leg);
            this.legs.push(leg);
        });
    }

    flashRed() {
        this.group.traverse(child => {
            if (child.isMesh && child.material) {
                const oldColor = child.material.color.getHex();
                child.material.color.setHex(0xff0000);
                setTimeout(() => {
                    if (child.material) child.material.color.setHex(oldColor);
                }, 200);
            }
        });
    }

    die() {
        this.isDead = true;

        // Play sound
        const sound = new Audio('sounds/died.mp3');
        sound.volume = 0.5;
        sound.play().catch(e => console.warn("Audio play failed", e));

        // Animation: Tip over
        const startRot = this.group.rotation.x;
        const startTime = performance.now();

        const animateDeath = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > 1.0) {
                this.scene.remove(this.group);
                this.world.removeFromUpdate(this); // Assuming world has list? No, main.js has list.
                // Actually relying on main.js to filter out dead or garbage collect
                return;
            }

            // Tip over 90 deg (PI/2)
            this.group.rotation.z = Math.min(Math.PI / 2, elapsed * Math.PI);
            this.group.position.y -= 0.01;

            requestAnimationFrame(animateDeath);
        };
        animateDeath();

        // Remove from main list done via filter in update loop usually?
        // main.js: const mobs = []; ... checks if !m.isDead
    }
}
