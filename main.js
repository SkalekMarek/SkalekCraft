import * as THREE from 'three';
import { World } from './World.js?v=16';
import { Player } from './Player.js';
import { Mob } from './Mob.js?v=11';
import { MobileControls } from './MobileControls.js';


// --- INIT ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 20, 60);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
// renderer.shadowMap.enabled = true; // Disabled for performance on large grids without optimization
document.body.appendChild(renderer.domElement);

// --- LIGHTS ---
const ambient = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(100, 100, 50);
scene.add(dirLight);

// --- GAME OBJECTS ---
const world = new World(scene);
world.generateSimple(100); // Increased Size 200x200



const player = new Player(camera, document.body, world);
const mobileControls = new MobileControls(player, world);


// --- MOBS ---
const mobs = [];
// --- UTILS ---
function generateUUID() {
    // Simple UUID v4 replacement if crypto is missing
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function spawnMob(type, x, y, z) {
    try {
        // Create Mob
        const m = new Mob(scene, world, new THREE.Vector3(x, y, z), type);
        mobs.push(m);
    } catch (e) {
        console.error("Error spawning mob:", e);
    }
}

// Initial Spawn (Randomly around center)
// Initial Spawn logic moved after network initialization to avoid ReferenceError



// --- INTERACTION & UI ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);
let selectedSlot = 0;
const slots = document.querySelectorAll('.slot');

// Hotbar selection
document.addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '9') {
        selectedSlot = parseInt(e.key) - 1;
        updateHotbar();
    }
});

// Prevent Browser Shortcuts (Ctrl+S, Ctrl+W)
// Prevent Browser Shortcuts (Ctrl+S, Ctrl+W, Ctrl+D)
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'w' || e.key === 'd' || e.key === 'S' || e.key === 'W' || e.key === 'D')) {
        e.preventDefault();
        e.stopPropagation();
    }
}, { passive: false });

// Prevent Tab Close (Ctrl+W safety)
window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = ''; // Required for some browsers
});

document.addEventListener('wheel', (e) => {
    if (e.deltaY > 0) selectedSlot = (selectedSlot + 1) % 9;
    else selectedSlot = (selectedSlot - 1 + 9) % 9;
    updateHotbar();
});

function updateHotbar() {
    slots.forEach((s, i) => {
        if (i === selectedSlot) s.classList.add('active');
        else s.classList.remove('active');
    });
}
// Init icons
// Init icons
// Init icons
const types = ['grass', 'stone', 'dirt', 'wood', 'water', 'cecabait', 'bohybait', 'kohoutekbait', 'ulrichbait'];
slots.forEach((s, i) => {
    if (types[i]) {
        // Default to transparent background color to show texture
        s.style.backgroundColor = 'rgba(0,0,0,0.3)';
        s.style.backgroundImage = 'none';

        if (types[i] === 'cecabait') {
            s.style.backgroundImage = `url('textures/cecabait.jpg')`;
        } else if (types[i] === 'bohybait') {
            s.style.backgroundImage = `url('textures/bohybait.jpg')`;
        } else if (types[i] === 'kohoutekbait') {
            s.style.backgroundImage = `url('textures/kohoutekbait.jpg')`;
        } else if (types[i] === 'ulrichbait') {
            s.style.backgroundImage = `url('textures/ulrichbait.png')`;
        } else if (types[i] === 'water') {
            s.style.backgroundColor = '#244F99'; // Keep color for water as no texture
        } else if (types[i] === 'grass') {
            s.style.backgroundImage = `url('textures/grass.png')`;
            s.style.backgroundColor = '#79C05A'; // Green tint
            s.style.backgroundBlendMode = 'multiply';
        } else {
            // Block textures
            s.style.backgroundImage = `url('textures/${types[i]}.png')`;
        }
    } else {
        s.style.backgroundColor = 'transparent';
    }
});


// Breaking/Placing
window.addEventListener('mousedown', (e) => {
    if (!player.controls.isLocked && !player.isMobile) return;

    // Use center of screen for raycasting (locked pointer)
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    if (e.button === 0) { // Left Click - Attack / Break
        // 1. Raycast Mobs
        const mobMeshes = mobs.map(m => m.group);
        const mobIntersects = raycaster.intersectObjects(mobMeshes, true);
        let hitMob = null;

        if (mobIntersects.length > 0 && mobIntersects[0].distance < 4) {
            let targetObj = mobIntersects[0].object;
            while (targetObj && !targetObj.userData.mob) {
                targetObj = targetObj.parent;
            }
            if (targetObj && targetObj.userData.mob) {
                hitMob = { mob: targetObj.userData.mob, distance: mobIntersects[0].distance };
            }
        }

        // 2. Raycast Blocks
        const blockIntersects = raycaster.intersectObjects(world.objects);
        let hitBlock = null;
        if (blockIntersects.length > 0 && blockIntersects[0].distance < 6) {
            hitBlock = blockIntersects[0];
        }

        // 3. Decide priority (Closest wins, with preference to Mobs if very close)
        if (hitMob && (!hitBlock || hitMob.distance < hitBlock.distance)) {
            // ATTACK MOB
            hitMob.mob.takeDamage(1, player.position);

            if (hitMob.mob.health <= 0) {
                if (typeof sendMobDeath === 'function') sendMobDeath({ id: hitMob.mob.id });
            }
        } else if (hitBlock) {
            // BREAK BLOCK
            if (hitBlock.object.isInstancedMesh) {
                world.removeBlock(hitBlock.object, hitBlock.instanceId);
            } else if (hitBlock.object.userData && hitBlock.object.userData.type) {
                // Fallback for non-instanced objects
                world.removeBlock(hitBlock.object);
            }
        }

    } else if (e.button === 2) { // Right Click - Place / Interact
        // For placement, we only care about blocks
        const intersects = raycaster.intersectObjects(world.objects);
        if (intersects.length > 0 && intersects[0].distance < 6) {
            const hit = intersects[0];

            // Calculate place position
            let pos;
            if (hit.object.isInstancedMesh) {
                const matrix = new THREE.Matrix4();
                hit.object.getMatrixAt(hit.instanceId, matrix);
                const instancePos = new THREE.Vector3().setFromMatrixPosition(matrix);
                pos = new THREE.Vector3(
                    Math.floor(instancePos.x),
                    Math.floor(instancePos.y),
                    Math.floor(instancePos.z)
                ).add(hit.face.normal);
            } else {
                const objPos = hit.object.position.clone();
                pos = new THREE.Vector3(
                    Math.floor(objPos.x),
                    Math.floor(objPos.y),
                    Math.floor(objPos.z)
                ).add(hit.face.normal);
            }

            // Don't place inside player (Box Collision)
            const blockBox = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5),
                new THREE.Vector3(0.9, 0.9, 0.9)
            );

            // Player Box (Approximate based on camera)
            const playerPos = camera.position.clone();
            const playerBox = new THREE.Box3();
            // Player is ~1.8 tall, camera is near top (eyes)
            playerBox.min.set(playerPos.x - 0.3, playerPos.y - 1.6, playerPos.z - 0.3);
            playerBox.max.set(playerPos.x + 0.3, playerPos.y + 0.1, playerPos.z + 0.3);

            if (blockBox.intersectsBox(playerBox)) return;

            // Check Mob Obstruction
            let bad = false;

            const placeBox = new THREE.Box3().setFromCenterAndSize(pos, new THREE.Vector3(0.9, 0.9, 0.9));
            for (let m of mobs) {
                const mobBox = new THREE.Box3().setFromObject(m.group);
                if (placeBox.intersectsBox(mobBox)) {
                    bad = true;
                    break;
                }
            }
            if (bad) return;

            // Determine Item
            const type = types[selectedSlot];
            if (!type) return;

            if (type.includes('bait')) {
                // Spawn Mob
                const mobType = type.replace('bait', '');
                spawnMob(mobType, pos.x, pos.y, pos.z); // Fixed typo and argument order
            } else {
                // Place Block
                world.placeBlock(pos.x, pos.y, pos.z, type);
            }

        }
    }
});



// --- GAME STATE ---
let gameStarted = false;
// --- INITIAL SPAWN (Must be after network actions) ---
// --- INITIAL SPAWN (Must be after network actions) ---
try {
    for (let i = 0; i < 6; i++) {
        const r = Math.random();
        let type = 'ceca';
        if (r < 0.33) type = 'bohy';
        else if (r < 0.66) type = 'kohoutek';
        else type = 'ulrich';

        // Safe spawn
        spawnMob(type, (Math.random() - 0.5) * 20, 20, (Math.random() - 0.5) * 20);
    }
} catch (err) {
    console.error("Initial mob spawn failed:", err);
}




// --- LOOP ---
let prevTime = performance.now();
let lastFpsTime = prevTime;
let frames = 0;

function animate() {
    if (!gameStarted) return; // Logic pause

    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.1);

    // FPS Counter
    frames++;
    if (time > lastFpsTime + 1000) {
        document.getElementById('fps-counter').innerText = `FPS: ${Math.round((frames * 1000) / (time - lastFpsTime))}`;
        lastFpsTime = time;
        frames = 0;
    }

    prevTime = time;


    player.update(delta);

    // Mob Updates
    const currentItem = types[selectedSlot];
    // Pass the item name directly so mob can check if it's the right bait
    mobs.forEach(m => m.update(delta, player.camera.position, currentItem));

    renderer.render(scene, camera);
}

// Lock pointer on click if game is running
document.addEventListener('click', () => {
    if (typeof gameStarted !== 'undefined' && gameStarted && typeof player !== 'undefined' && !player.isMobile && player.controls && !player.controls.isLocked) {
        player.controls.lock();
    }
});

function startGame() {
    gameStarted = true;
    prevTime = performance.now();
    animate();

    // Request pointer lock only if NOT on mobile
    if (!player.isMobile && player.controls) {
        player.controls.lock();
    }
}

// --- MENU HANDLERS ---
const menuScreen = document.getElementById('menu-screen');
const mainMenuContent = document.getElementById('main-menu-content');
const ui = document.getElementById('ui');

// Play Button
document.getElementById('btn-play').addEventListener('click', () => {
    menuScreen.style.display = 'none';
    ui.classList.remove('hidden');
    startGame();
});

// --- RESIZE ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
