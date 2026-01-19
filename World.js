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
            bedrock: new THREE.MeshStandardMaterial({ map: createTexture('#1a1a1a') }),
            water: new THREE.MeshStandardMaterial({ // Instanced water for simple check, though custom mesh system handles rendering
                color: 0x244F99, transparent: true, opacity: 0.7, side: THREE.DoubleSide
            })
        };

        this.geometry = new THREE.BoxGeometry(1, 1, 1);

        // Instanced Rendering Setup
        this.capacity = 300000; // Increased capacity for 200x200 map
        this.instancedMeshes = {};
        this.objects = []; // For main.js raycaster

        for (const [type, mat] of Object.entries(materials)) {
            // Skip water for instanced mesh if we use custom system, BUT having it here allows raycasting to hit it if we want
            // However, our custom system draws water separately. Let's keep it consistent with previous logic.
            if (type === 'water') continue;

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
            color: 0x244F99, transparent: true, opacity: 0.7, side: THREE.FrontSide
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
        this.requestWaterUpdate();
    }

    // --- GENERATION ---
    generateSimple(size = 100) { // Radius 100 = 200x200 map
        this.seed = 123456;

        // Reset
        for (const mesh of Object.values(this.instancedMeshes)) {
            mesh.count = 0;
            mesh.instanceMatrix.needsUpdate = true;
        }
        this.blocks.clear();
        this.requestWaterUpdate();

        const waterLevel = 0;

        for (let x = -size; x < size; x++) {
            for (let z = -size; z < size; z++) {
                // Smooth Terrain (Sine Waves) for Coherent Lakes
                // Large waves for hills/lakes
                const largeWave = Math.sin(x / 25) * Math.cos(z / 25);
                // Small waves for detail
                const smallWave = Math.sin(x / 8) * Math.cos(z / 8);

                // Combine: Primarily large wave, bit of detail (Range approx -1.3 to 1.3)
                let noise = largeWave + (smallWave * 0.3);

                // Scale and Offset
                // We want lakes to be smaller, so bias UP (+2 or +3)
                // Range becomes: ((-1.3 to 1.3) * 6) + 2 => -5.8 to 9.8
                let h = Math.floor(noise * 6 + 2);

                // Edge Mask (Force borders UP)
                // Distance from center
                const dist = Math.sqrt(x * x + z * z);
                const maxDist = size * 0.85;
                if (dist > maxDist) {
                    // Ramp up
                    const rise = (dist - maxDist) * 0.8;
                    h += Math.floor(rise);
                }

                // Blocks
                for (let y = -5; y <= h; y++) {
                    let type = 'stone';
                    if (y === h && y >= waterLevel) type = 'grass';
                    else if (y > h - 3 && y >= waterLevel) type = 'dirt';
                    else if (y < h && y <= waterLevel) type = 'sand'; // Underwater floor

                    this.placeBlock(x, y, z, type);
                }

                // Water
                if (h < waterLevel) {
                    for (let wy = h + 1; wy <= waterLevel; wy++) {
                        this.placeBlock(x, wy, z, 'water');
                    }
                }

                // Trees (Random density, no grid)
                // Only on land and enough space
                if (h >= waterLevel) {
                    // 1 in 60 chance (~1.6%)
                    if (this.rng() < 0.016) {
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
