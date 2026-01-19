import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.blocks = new Map(); // "x,y,z" -> { type, instanceId }
        this.startTime = performance.now();

        // Materials
        const createTexture = (color) => {
            const canvas = document.createElement('canvas');
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 64, 64);
            // Noise 
            for (let i = 0; i < 64; i++) {
                ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; // deterministic visual noise not critical
                ctx.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 64), 4, 4);
            }
            const t = new THREE.CanvasTexture(canvas);
            t.magFilter = THREE.NearestFilter;
            return t;
        };

        const materials = {
            grass: new THREE.MeshStandardMaterial({ map: createTexture('#5C9E38') }),
            stone: new THREE.MeshStandardMaterial({ map: createTexture('#757575') }),
            dirt: new THREE.MeshStandardMaterial({ map: createTexture('#5D4037') }),
            wood: new THREE.MeshStandardMaterial({ map: createTexture('#4E342E') }),
            leaves: new THREE.MeshStandardMaterial({ map: createTexture('#388E3C'), transparent: true }),
            sand: new THREE.MeshStandardMaterial({ map: createTexture('#F4A460') }),
            bedrock: new THREE.MeshStandardMaterial({ map: createTexture('#1a1a1a') })
        };

        this.geometry = new THREE.BoxGeometry(1, 1, 1);

        // Instanced Rendering Setup
        this.capacity = 150000; // Increased capacity for 150x150 map
        this.instancedMeshes = {};
        this.objects = []; // For main.js raycaster

        for (const [type, mat] of Object.entries(materials)) {
            const mesh = new THREE.InstancedMesh(this.geometry, mat, this.capacity);
            mesh.count = 0;
            mesh.name = type;
            mesh.userData = { isWorldBlock: true, type: type };
            this.scene.add(mesh);
            this.instancedMeshes[type] = mesh;
            this.objects.push(mesh);
        }

        // Water System (Custom Mesh)
        this.waterSurfaceMat = new THREE.MeshStandardMaterial({
            color: 0x244F99, transparent: true, opacity: 0.7, side: THREE.DoubleSide
        });
        this.waterSideMat = new THREE.MeshStandardMaterial({
            color: 0x244F99, transparent: true, opacity: 0.7, side: THREE.FrontSide // Optimization: only see front
        });
        this.waterSurfaceMesh = null;
        this.waterSideMesh = null;
        this.waterUpdatePending = false;

        this.dummy = new THREE.Object3D();
        this.seed = 123456; // Sync seed

        setInterval(() => this.simulateWater(), 400);
    }

    // RNG
    rng() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    getBlock(x, y, z) {
        return this.blocks.has(`${x},${y},${z}`);
    }

    getBlockType(x, y, z) {
        const data = this.blocks.get(`${x},${y},${z}`);
        return data ? data.type : null;
    }

    placeBlock(x, y, z, type) {
        const key = `${x},${y},${z}`;
        if (this.blocks.has(key)) {
            const oldType = this.getBlockType(x, y, z);
            if (oldType === 'water' && type !== 'water') {
                // Replacing water
                this.blocks.set(key, { type, instanceId: -1 }); // Temp update
                this.requestWaterUpdate();
                // Then continue to place solid
            } else {
                return; // Block exists
            }
        }

        // Water Logic
        if (type === 'water') {
            this.blocks.set(key, { type, instanceId: -1 });
            this.requestWaterUpdate();
            return;
        }

        // Solid Logic (Instanced)
        const mesh = this.instancedMeshes[type];
        if (!mesh) return; // Unknown type
        if (mesh.count >= this.capacity) return; // Full

        const id = mesh.count++;
        this.dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(id, this.dummy.matrix);
        mesh.instanceMatrix.needsUpdate = true;

        this.blocks.set(key, { type, instanceId: id });

        // Also update water if we placed near it (to trigger side update)
        // this.requestWaterUpdate(); // Global update lazy check
    }

    removeBlock(mesh, instanceId) {
        // This signature is called from Raycaster which gives us the InstancedMesh and the ID
        // We need coords to update logic.
        // Recover coords from matrix
        const matrix = new THREE.Matrix4();
        mesh.getMatrixAt(instanceId, matrix);
        const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
        const x = Math.floor(pos.x);
        const y = Math.floor(pos.y);
        const z = Math.floor(pos.z);

        this.removeBlockAt(x, y, z);
    }

    removeBlockAt(x, y, z) {
        const key = `${x},${y},${z}`;
        const data = this.blocks.get(key);
        if (!data) return;

        if (data.type === 'water') {
            this.blocks.delete(key);
            this.requestWaterUpdate();
            return;
        }

        const mesh = this.instancedMeshes[data.type];
        if (mesh) {
            // Hide by scaling to 0
            this.dummy.position.set(0, 0, 0);
            this.dummy.scale.set(0, 0, 0);
            this.dummy.updateMatrix();
            mesh.setMatrixAt(data.instanceId, this.dummy.matrix);
            mesh.instanceMatrix.needsUpdate = true;
        }

        this.blocks.delete(key);
        // this.requestWaterUpdate(); // In case water flows into it (not fully implemented yet)
    }

    // --- GENERATION ---
    generateSimple(size = 75) { // Radius 75 = 150x150 map
        this.seed = 123456;

        // Reset
        for (const mesh of Object.values(this.instancedMeshes)) {
            mesh.count = 0;
            mesh.instanceMatrix.needsUpdate = true;
        }
        this.blocks.clear();
        this.requestWaterUpdate();

        for (let x = -size; x < size; x++) {
            for (let z = -size; z < size; z++) {
                // Deterministic integer noise
                let n = (x * 15731 + z * 789221 + 1376312589) & 0x7fffffff;
                n = (n >> 13) ^ n;
                n = (n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff;
                const h = Math.floor((n / 2147483648.0) * 4);

                for (let y = -5; y <= h; y++) {
                    let type = 'stone';
                    if (y === h) type = 'grass';
                    else if (y > h - 3) type = 'dirt';
                    this.placeBlock(x, y, z, type);
                }

                if (x % 7 === 0 && z % 7 === 0) {
                    if (this.rng() > 0.3) {
                        // Random Tree Type
                        if (this.rng() > 0.5) {
                            this.generateTree(x, h + 1, z);
                        } else {
                            this.generatePointyTree(x, h + 1, z);
                        }
                    }
                }
            }
        }

        document.getElementById('block-count').innerText = `Blocks: ${this.blocks.size} (Instanced)`;
    }

    generateTree(x, y, z) {
        const height = 4 + Math.floor(this.rng() * 2);
        for (let i = 0; i < height; i++) this.placeBlock(x, y + i, z, 'wood');
        for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
                for (let ly = height - 1; ly <= height + 1; ly++) {
                    if (Math.abs(lx) + Math.abs(lz) > 3) continue;
                    if (lx === 0 && lz === 0 && ly < height + 1) continue;
                    this.placeBlock(x + lx, y + ly, z + lz, 'leaves');
                }
            }
        }
    }

    generatePointyTree(x, y, z) { // Spruce-style
        const height = 6 + Math.floor(this.rng() * 3);
        // Tall trunk
        for (let i = 0; i < height; i++) this.placeBlock(x, y + i, z, 'wood');

        // Pointy leaves
        let radius = 2;
        for (let i = 2; i < height; i++) {
            // Taper radius regularly
            if (i % 2 === 0 && radius > 0 && i > 3) radius--;
            if (i === height - 1) radius = 0; // Top tip

            for (let lx = -radius; lx <= radius; lx++) {
                for (let lz = -radius; lz <= radius; lz++) {
                    if (Math.abs(lx) + Math.abs(lz) > radius * 1.5 + 0.5) continue;
                    if (lx === 0 && lz === 0) continue;
                    this.placeBlock(x + lx, y + i, z + lz, 'leaves');
                }
            }
        }
        this.placeBlock(x, y + height, z, 'leaves');
    }

    // --- WATER SYSTEM (Preserved) ---
    requestWaterUpdate() {
        if (!this.waterUpdatePending) {
            this.waterUpdatePending = true;
            requestAnimationFrame(() => this.updateWaterGeometry());
        }
    }

    updateWaterGeometry() {
        this.waterUpdatePending = false;
        const waterBlocks = [];
        for (const [key, data] of this.blocks) {
            if (data.type === 'water') {
                const parts = key.split(',').map(Number);
                waterBlocks.push({ x: parts[0], y: parts[1], z: parts[2] });
            }
        }
        if (this.waterSurfaceMesh) { this.scene.remove(this.waterSurfaceMesh); this.waterSurfaceMesh = null; }
        if (this.waterSideMesh) { this.scene.remove(this.waterSideMesh); this.waterSideMesh = null; }

        if (waterBlocks.length === 0) return;

        const surfaceVerts = [];
        const sideVerts = [];
        const addFace = (x, y, z, face, targetArray) => {
            const X = x, Y = y, Z = z;
            const X1 = x + 1, Y1 = y + 1, Z1 = z + 1;
            let v = [];
            if (face === 'px') v = [X1, Y, Z1, X1, Y, Z, X1, Y1, Z, X1, Y, Z1, X1, Y1, Z, X1, Y1, Z1];
            else if (face === 'nx') v = [X, Y, Z, X, Y, Z1, X, Y1, Z1, X, Y, Z, X, Y1, Z1, X, Y1, Z];
            else if (face === 'py') v = [X, Y1, Z1, X1, Y1, Z1, X1, Y1, Z, X, Y1, Z1, X1, Y1, Z, X, Y1, Z];
            else if (face === 'ny') v = [X, Y, Z, X1, Y, Z, X1, Y, Z1, X, Y, Z, X1, Y, Z1, X, Y, Z1];
            else if (face === 'pz') v = [X1, Y, Z1, X, Y, Z1, X, Y1, Z1, X1, Y, Z1, X, Y1, Z1, X1, Y1, Z1];
            else if (face === 'nz') v = [X, Y, Z, X1, Y, Z, X1, Y1, Z, X, Y, Z, X1, Y1, Z, X, Y1, Z];
            targetArray.push(...v);
        };

        for (const b of waterBlocks) {
            const { x, y, z } = b;
            if (!this.getBlock(x + 1, y, z)) addFace(x, y, z, 'px', sideVerts);
            if (!this.getBlock(x - 1, y, z)) addFace(x, y, z, 'nx', sideVerts);
            if (!this.getBlock(x, y + 1, z)) addFace(x, y, z, 'py', surfaceVerts);
            if (!this.getBlock(x, y - 1, z)) addFace(x, y, z, 'ny', sideVerts);
            if (!this.getBlock(x, y, z + 1)) addFace(x, y, z, 'pz', sideVerts);
            if (!this.getBlock(x, y, z - 1)) addFace(x, y, z, 'nz', sideVerts);
        }

        if (surfaceVerts.length > 0) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(surfaceVerts, 3));
            this.waterSurfaceMesh = new THREE.Mesh(geo, this.waterSurfaceMat);
            this.scene.add(this.waterSurfaceMesh);
        }
        if (sideVerts.length > 0) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(sideVerts, 3));
            this.waterSideMesh = new THREE.Mesh(geo, this.waterSideMat);
            this.scene.add(this.waterSideMesh);
        }
    }

    simulateWater() {
        // Placeholder for future water physics
    }
}
