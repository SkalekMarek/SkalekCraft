import * as THREE from 'three';

export class Mob {
    constructor(world, x, y, z, type) {
        this.world = world;
        this.type = type;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3();
        this.isDead = false;

        // Visuals
        const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6); // Player-like dimensions
        let texturePath = `${type}.png`; // bohy.png, ceca.png, kohoutek.png

        // Load Texture
        const loader = new THREE.TextureLoader();
        const texture = loader.load(texturePath);
        texture.magFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;

        // Map texture to all sides? Or just "Face"? 
        // For simplicity, applying same texture to all sides, or a color + face?
        // Let's apply texture to all sides but maybe mainly front.
        // If image is a "face" or "sprite", wrapping it around a box might look weird but it's "3D".
        // Better: Material array. If I only have one texture, I'll use it everywhere.

        const material = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.5
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);

        // Pivot/Offset
        // Geometry is centered, so (0,0,0) is center of box.
        // We want feet at position.y. Height is 1.8. Center is 0.9.
        this.mesh.position.y += 0.9;

        // Face Mesh (Optional additions if we want to model more complexly, but Box is start)

        this.world.scene.add(this.mesh);

        // Random behavior
        this.moveTimer = 0;
        this.moveDir = new THREE.Vector3();
    }

    update(delta, player) {
        if (this.isDead) return;

        // Gravity
        this.velocity.y -= 20 * delta;

        // Basic AI: Wander randomly
        this.moveTimer -= delta;
        if (this.moveTimer <= 0) {
            this.moveTimer = 1 + Math.random() * 2;
            const angle = Math.random() * Math.PI * 2;
            this.moveDir.set(Math.cos(angle), 0, Math.sin(angle));
        }

        // Apply movement
        const speed = 2.0;
        this.velocity.x = this.moveDir.x * speed;
        this.velocity.z = this.moveDir.z * speed;

        // Friction
        this.velocity.x *= 0.9;
        this.velocity.z *= 0.9;

        // Collision & Integration
        this.position.x += this.velocity.x * delta;
        if (this.checkCollision()) {
            this.position.x -= this.velocity.x * delta;
            this.moveDir.x *= -1; // Bounce
        }

        this.position.z += this.velocity.z * delta;
        if (this.checkCollision()) {
            this.position.z -= this.velocity.z * delta;
            this.moveDir.z *= -1;
        }

        this.position.y += this.velocity.y * delta;
        if (this.checkCollision()) {
            // Hit ground/ceiling
            this.position.y -= this.velocity.y * delta;
            this.velocity.y = 0;
        }

        // Update Mesh
        this.mesh.position.copy(this.position);
        this.mesh.position.y += 0.9; // Offset visual center

        // Rotation: Face movement direction? Or Player?
        // Real mobs face their movement or player.
        // Let's face movement if moving, else player?
        // Simple: Face player for now, or just rotate Y based on movement.
        if (this.velocity.x !== 0 || this.velocity.z !== 0) {
            const angle = Math.atan2(this.velocity.x, this.velocity.z);
            this.mesh.rotation.y = angle;
        }
    }

    checkCollision() {
        const p = this.position;
        const x = Math.floor(p.x);
        const y = Math.floor(p.y); // Feet
        const z = Math.floor(p.z);

        // Simple 1-block check (feet)
        const type = this.world.getBlockType(x, y, z);
        if (type && type !== 'water') return true;

        // Check head (hitbox height ~1)
        const headY = Math.floor(p.y + 0.8);
        const typeHead = this.world.getBlockType(x, headY, z);
        if (typeHead && typeHead !== 'water') return true;

        return false;
    }

    takeDamage() {
        if (this.isDead) return;

        // Play sound
        const audio = new Audio('died.mp3');
        audio.play().catch(e => console.warn("Audio play failed", e));

        // Visual death
        this.world.scene.remove(this.mesh);
        this.isDead = true;
    }
}
