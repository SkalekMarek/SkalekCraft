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
        this.health -= amount;
        this.flashRed();

        if (!this.isRemote) {
            const recoil = this.position.clone().sub(attackerPos).normalize();
            recoil.y = 0.5;
            this.velocity.add(recoil.multiplyScalar(15));
            this.onGround = false;
        }

        if (this.health <= 0) {
            this.die();
        }
    }

    updateRemote(x, y, z, ry) {
        this.targetPos.set(x, y, z);
        this.targetRot = ry;
    }

    update(delta, playerPos, isHoldingBait) {
        if (this.isDead) return;

        if (this.isRemote) {
            // INTERPOLATION for remote mobs
            this.position.lerp(this.targetPos, 10 * delta);
            this.group.position.copy(this.position);
            this.group.rotation.y += (this.targetRot - this.group.rotation.y) * 10 * delta;

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
            return;
        }

        // --- LOCAL LOGIC BELOW ---
        this.velocity.y -= 25 * delta;

        const headBlock = this.world.getBlockType(Math.floor(this.position.x), Math.floor(this.position.y + 0.5), Math.floor(this.position.z));

        if (headBlock === 'water') {
            this.velocity.y = 5;
            this.velocity.x *= 0.8;
            this.velocity.z *= 0.8;
        } else {
            this.velocity.y -= 25 * delta;
        }

        let moveDir = new THREE.Vector3(0, 0, 0);
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

        let speed = 3.0;
        if (this.type === 'ulrich') speed = 5.0;

        this.velocity.x = moveDir.x * speed;
        this.velocity.z = moveDir.z * speed;

        this.position.x += this.velocity.x * delta;
        this.handleCollisions('x');
        this.position.z += this.velocity.z * delta;
        this.handleCollisions('z');
        this.position.y += this.velocity.y * delta;
        this.handleCollisions('y');

        this.group.position.copy(this.position);

        if (moveDir.lengthSq() > 0.1) {
            const targetRot = Math.atan2(moveDir.x, moveDir.z);
            this.group.rotation.y = targetRot;

            const walkSpeed = 10;
            const time = performance.now() / 1000;
            if (this.legs && this.legs.length >= 4) {
                this.legs[0].rotation.x = Math.sin(time * walkSpeed) * 0.5;
                this.legs[1].rotation.x = Math.sin(time * walkSpeed + Math.PI) * 0.5;
                this.legs[2].rotation.x = Math.sin(time * walkSpeed + Math.PI) * 0.5;
                this.legs[3].rotation.x = Math.sin(time * walkSpeed) * 0.5;
            }
            if (this.type === 'ulrich') {
                if (this.body && this.body.children.length > 1) {
                    this.body.children[1].rotation.y = Math.sin(time * 15) * 0.3;
                }
            }
        } else {
            if (this.legs) this.legs.forEach(l => l.rotation.x = 0);
        }
    }

    handleCollisions(axis) {
        const width = 0.6 * 0.7;
        const height = 1.4 * 0.7;

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
                    if (block && block !== 'water') {
                        if (axis === 'y') {
                            if (this.velocity.y < 0) {
                                this.position.y = y + 1.001;
                                this.velocity.y = 0;
                                this.onGround = true;
                            } else if (this.velocity.y > 0) {
                                this.position.y = y - height - 0.001;
                                this.velocity.y = 0;
                            }
                        } else if (axis === 'x') {
                            const headBlock = this.world.getBlockType(Math.floor(this.position.x), Math.floor(this.position.y + 0.5), Math.floor(this.position.z));
                            const inWater = (headBlock === 'water');
                            if ((this.onGround || inWater) && y === Math.floor(this.position.y)) {
                                const blockAbove = this.world.getBlockType(x, y + 1, z);
                                const blockTwoAbove = this.world.getBlockType(x, y + 2, z);
                                if ((!blockAbove || blockAbove === 'water') && (!blockTwoAbove || blockTwoAbove === 'water')) {
                                    this.position.y += 1.1;
                                    return;
                                }
                            }
                            if (this.velocity.x > 0) this.position.x = x - width / 2 - 0.001;
                            else this.position.x = x + 1 + width / 2 + 0.001;
                        } else if (axis === 'z') {
                            const headBlock = this.world.getBlockType(Math.floor(this.position.x), Math.floor(this.position.y + 0.5), Math.floor(this.position.z));
                            const inWater = (headBlock === 'water');
                            if ((this.onGround || inWater) && y === Math.floor(this.position.y)) {
                                const blockAbove = this.world.getBlockType(x, y + 1, z);
                                const blockTwoAbove = this.world.getBlockType(x, y + 2, z);
                                if ((!blockAbove || blockAbove === 'water') && (!blockTwoAbove || blockTwoAbove === 'water')) {
                                    this.position.y += 1.1;
                                    return;
                                }
                            }
                            if (this.velocity.z > 0) this.position.z = z - width / 2 - 0.001;
                            else this.position.z = z + 1 + width / 2 + 0.001;
                        }
                        return;
                    }
                }
            }
        }
        if (axis === 'y' && this.velocity.y < 0) this.onGround = false;
    }

    createModel(type) {
        const material = new THREE.MeshBasicMaterial();
        let geometry;
        let bodyMesh;

        const legH = (type === 'kohoutek') ? 0.2 : 0.4;
        const bodyOffset = legH;

        if (type === 'ceca') {
            // Pig
            const width = 0.6; const height = 0.6; const depth = 1.0;
            geometry = new THREE.BoxGeometry(width, height, depth);
            material.color.setHex(0xffaaaa);

            bodyMesh = new THREE.Mesh(geometry, material);
            bodyMesh.position.y = bodyOffset + height / 2;
            this.group.add(bodyMesh);

            // Tail (Pig)
            const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), material);
            tail.position.set(0, -height / 4, -depth / 2 - 0.05); // Low back
            bodyMesh.add(tail);

            // Ears (Pig)
            const earGeo = new THREE.BoxGeometry(0.2, 0.2, 0.05);
            const leftEar = new THREE.Mesh(earGeo, material);
            leftEar.position.set(-0.35, 0.35, 0.3);
            bodyMesh.add(leftEar);
            const rightEar = new THREE.Mesh(earGeo, material);
            rightEar.position.set(0.35, 0.35, 0.3);
            bodyMesh.add(rightEar);

            const textureLoader = new THREE.TextureLoader();
            textureLoader.load('textures/ceca.png', (tex) => {
                const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
                const face = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mat);
                face.position.set(0, 0, depth / 2 + 0.01);
                bodyMesh.add(face);
            });
        } else if (type === 'bohy') {
            // Cow
            const width = 0.7; const height = 1.0; const depth = 1.2;
            geometry = new THREE.BoxGeometry(width, height, depth);
            material.color.setHex(0x553311);

            bodyMesh = new THREE.Mesh(geometry, material);
            bodyMesh.position.y = bodyOffset + height / 2;
            this.group.add(bodyMesh);

            // Horns (Cow)
            const hornGeo = new THREE.BoxGeometry(0.1, 0.25, 0.1);
            const hornMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
            const leftHorn = new THREE.Mesh(hornGeo, hornMat);
            leftHorn.position.set(-0.3, 0.6, 0.55);
            bodyMesh.add(leftHorn);

            const rightHorn = new THREE.Mesh(hornGeo, hornMat);
            rightHorn.position.set(0.3, 0.6, 0.55);
            bodyMesh.add(rightHorn);

            // Tail (Cow)
            const tailGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
            const tail = new THREE.Mesh(tailGeo, material);
            tail.position.set(0, 0.2, -depth / 2 - 0.05);
            tail.rotation.x = 0.2;
            bodyMesh.add(tail);

            const textureLoader = new THREE.TextureLoader();
            textureLoader.load('textures/bohy.png', (tex) => {
                const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
                const face = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), mat);
                face.position.set(0, 0.2, depth / 2 + 0.01);
                bodyMesh.add(face);
            });
        } else if (type === 'kohoutek') {
            // Chicken
            const width = 0.4; const height = 0.6; const depth = 0.4;
            geometry = new THREE.BoxGeometry(width, height, depth);
            material.color.setHex(0xffffff);

            bodyMesh = new THREE.Mesh(geometry, material);
            bodyMesh.position.y = bodyOffset + height / 2;
            this.group.add(bodyMesh);

            const textureLoader = new THREE.TextureLoader();
            textureLoader.load('textures/kohoutek.png', (tex) => {
                const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
                const face = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), mat);
                face.position.set(0, 0.1, depth / 2 + 0.01);
                bodyMesh.add(face);
            });
        } else if (type === 'ulrich') {
            // Wolf
            const width = 0.5; const height = 0.6; const depth = 1.0;
            geometry = new THREE.BoxGeometry(width, height, depth);
            material.color.setHex(0xaaaaaa);

            this.body = new THREE.Group();
            this.body.position.y = bodyOffset + height / 2;
            this.group.add(this.body);

            bodyMesh = new THREE.Mesh(geometry, material);
            this.body.add(bodyMesh);

            const tailGeo = new THREE.BoxGeometry(0.2, 0.2, 0.6);
            const tail = new THREE.Mesh(tailGeo, material);
            tail.position.set(0, 0.2, -0.6);
            this.body.add(tail);

            const textureLoader = new THREE.TextureLoader();
            textureLoader.load('textures/ulrich.jpeg', (tex) => {
                const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
                const face = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), mat);
                face.position.set(0, 0, depth / 2 + 0.01);
                this.body.add(face);
            });
        } else {
            const s = 0.5;
            geometry = new THREE.BoxGeometry(s, s, s);
            material.color.setHex(0xff0000);
            bodyMesh = new THREE.Mesh(geometry, material);
            bodyMesh.position.y = s / 2;
            this.group.add(bodyMesh);
        }

        // Legs
        this.legs = [];
        const legGeo = new THREE.BoxGeometry(0.15, legH, 0.15);
        const legMat = material.clone();
        legMat.color.multiplyScalar(0.8); // Proper darkening

        let legPositions = [
            [-0.2, legH / 2, 0.3], [0.2, legH / 2, 0.3],
            [-0.2, legH / 2, -0.3], [0.2, legH / 2, -0.3]
        ];

        if (type === 'kohoutek') {
            legPositions = [[-0.1, legH / 2, 0], [0.1, legH / 2, 0]];
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
        const sound = new Audio('sounds/died.mp3');
        sound.volume = 0.5;
        sound.play().catch(e => console.warn("Audio play failed", e));

        const startTime = performance.now();
        const animateDeath = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > 1.0) {
                this.scene.remove(this.group);
                this.world.removeFromUpdate(this);
                return;
            }
            this.group.rotation.z = Math.min(Math.PI / 2, elapsed * Math.PI);
            this.group.position.y -= 0.01;
            requestAnimationFrame(animateDeath);
        };
        animateDeath();
    }
}
