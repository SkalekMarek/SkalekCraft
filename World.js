import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.blocks = new Map(); // "x,y,z" -> type
        this.objects = []; // For raycasting
        this.seed = 123456; // Fixed seed

        // Materials
        const loader = new THREE.TextureLoader();
        // Fallback or generated textures
        const createTexture = (color) => {
            const canvas = document.createElement('canvas');
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 64, 64);
            // Noise (Deterministic visual noise NOT strictly required to be synced but better)
            for (let i = 0; i < 64; i++) {
                ctx.fillStyle = `rgba(0,0,0,${this.rng() * 0.15})`;
                ctx.fillRect(Math.floor(this.rng() * 64), Math.floor(this.rng() * 64), 4, 4);
            }
            const t = new THREE.CanvasTexture(canvas);
            t.magFilter = THREE.NearestFilter;
            return t;
        };

        this.materialMap = {
            grass: new THREE.MeshStandardMaterial({ map: createTexture('#5C9E38') }),
            stone: new THREE.MeshStandardMaterial({ map: createTexture('#757575') }),
            dirt: new THREE.MeshStandardMaterial({ map: createTexture('#5D4037') }),
            wood: new THREE.MeshStandardMaterial({ map: createTexture('#4E342E') }),
            leaves: new THREE.MeshStandardMaterial({ map: createTexture('#388E3C'), transparent: true })
        };

        this.geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    // Simple Linear Congruential Generator
    rng() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    getBlock(x, y, z) {
        return this.blocks.has(`${x},${y},${z}`);
    }

    placeBlock(x, y, z, type) {
        if (this.getBlock(x, y, z)) return; // Already exists

        const mat = this.materialMap[type];
        const mesh = new THREE.Mesh(this.geometry, mat);
        mesh.position.set(x + 0.5, y + 0.5, z + 0.5); // Center block

        this.scene.add(mesh);
        this.blocks.set(`${x},${y},${z}`, type);
        this.objects.push(mesh);
        mesh.userData = { x, y, z, type }; // Store coord
    }

    removeBlock(mesh) {
        this.scene.remove(mesh);
        this.objects = this.objects.filter(o => o !== mesh);
        const { x, y, z } = mesh.userData;
        this.blocks.delete(`${x},${y},${z}`);
    }

    generateSimple(size = 20) {
        // Reset seed for consistency
        this.seed = 123456;

        for (let x = -size; x < size; x++) {
            for (let z = -size; z < size; z++) {
                // Perlin-ish noise (using sin combination)
                const h = Math.floor(Math.sin(x * 0.1) * 3 + Math.cos(z * 0.1) * 3);

                // Blocks
                for (let y = -5; y <= h; y++) {
                    let type = 'stone';
                    if (y === h) type = 'grass';
                    else if (y > h - 3) type = 'dirt';
                    this.placeBlock(x, y, z, type);
                }

                // Trees
                if (x % 7 === 0 && z % 7 === 0 && this.rng() > 0.4) {
                    this.generateTree(x, h + 1, z);
                }
            }
        }
    }

    generateTree(x, y, z) {
        const height = 4 + Math.floor(this.rng() * 2);
        // Trunk
        for (let i = 0; i < height; i++) {
            this.placeBlock(x, y + i, z, 'wood');
        }
        // Leaves
        for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
                for (let ly = height - 1; ly <= height + 1; ly++) {
                    if (Math.abs(lx) + Math.abs(lz) > 3) continue; // Make it round-ish
                    if (lx === 0 && lz === 0 && ly < height + 1) continue; // Trunk
                    this.placeBlock(x + lx, y + ly, z + lz, 'leaves');
                }
            }
        }
    }
}
