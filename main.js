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

function spawnMob(type, x, y, z, id = null, isRemote = false) {
    try {
        // Generate ID if not provided (Local spawn)
        const mobId = id || generateUUID();

        // Create Mob
        const m = new Mob(scene, world, new THREE.Vector3(x, y, z), type, mobId, isRemote);
        mobs.push(m);

        // If local, broadcast spawn (only if network is ready)
        if (!isRemote && typeof sendMobSpawn === 'function') {
            sendMobSpawn({
                type: type,
                x: x,
                y: y,
                z: z,
                id: mobId
            });
        }
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

                // Recover coords for network
                const matrix = new THREE.Matrix4();
                hitBlock.object.getMatrixAt(hitBlock.instanceId, matrix);
                const pos = new THREE.Vector3().setFromMatrixPosition(matrix);

                if (typeof sendBlock === 'function') {
                    sendBlockUpdate({
                        x: Math.round(pos.x),
                        y: Math.round(pos.y),
                        z: Math.round(pos.z),
                        type: null
                    });
                }
            } else if (hitBlock.object.userData && hitBlock.object.userData.type) {
                // Fallback for non-instanced objects
                const { x, y, z } = hitBlock.object.userData;
                world.removeBlock(hitBlock.object);
                if (typeof sendBlockUpdate === 'function') {
                    sendBlockUpdate({ x, y, z, type: null });
                }
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
                pos = new THREE.Vector3().setFromMatrixPosition(matrix).add(hit.face.normal);
            } else {
                pos = hit.object.position.clone().add(hit.face.normal);
            }

            // Don't place inside player
            const pPos = camera.position;
            // Better: use player.position (feet) and check bounds
            // Simple distance check from camera (head)
            if (pos.distanceTo(camera.position) < 1.0) return;

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
                spawnMob(pos.x, pos.y, pos.z, mobType); // Spawn ON the block, so y is correct (pos is adjacent air block)
                // Actually spawnMob sets it at x,y,z. If pos is the air block above ground, that's perfect.
            } else {
                // Place Block
                world.placeBlock(pos.x, pos.y, pos.z, type);
                if (typeof sendBlockUpdate === 'function') {
                    sendBlockUpdate({ x: pos.x, y: pos.y, z: pos.z, type: type });
                }
            }

        }
    }
});



// --- GAME STATE ---
let isMultiplayer = false;
let gameStarted = false;
let myUsername = "Player";

// --- NETWORK & MULTIPLAYER (P2P - MQTT) ---
import { joinRoom } from 'trystero';

let room, sendMove, getMove, sendBlock, getBlock, sendMobSpawn, getMobSpawn, sendMobMove, getMobMove, sendMobDeath, getMobDeath;

function initMultiplayer(username) {
    if (room) return; // Already joined
    myUsername = username;

    const roomConfig = {
        appId: 'skalek-craft-v3-stun',
        rtcConfig: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    };
    room = joinRoom(roomConfig, 'main-lobby');

    // Actions
    [sendMove, getMove] = room.makeAction('move');
    [sendBlock, getBlock] = room.makeAction('block');
    [sendMobSpawn, getMobSpawn] = room.makeAction('mobSpawn');
    [sendMobMove, getMobMove] = room.makeAction('mobMove');
    [sendMobDeath, getMobDeath] = room.makeAction('mobDeath');

    // 1. Peer Management
    room.onPeerJoin(peerId => {
        console.log(`${peerId} joined`);
        addRemotePlayer(peerId);

        // MULTIPLAYER START CONDITION: Wait for at least one peer
        if (!gameStarted) {
            document.getElementById('waiting-message').classList.add('hidden');
            document.getElementById('lobby-content').classList.add('hidden');
            document.getElementById('menu-screen').style.display = 'none';
            document.getElementById('ui').classList.remove('hidden');
            startGame();
        }

        // Wait a split second to ensure connection is stable before sending
        setTimeout(() => {
            // updatePlayerCount(); // Removed UI

            // Send my current position to the new peer immediately so they see me
            const p = player.camera.position;
            sendMove({ x: p.x, y: p.y, z: p.z, ry: player.camera.rotation.y }, peerId);

            // Sync my existing mobs to the new peer
            mobs.forEach(m => {
                if (!m.isRemote && !m.isDead) {
                    sendMobSpawn({
                        type: m.type,
                        x: m.position.x,
                        y: m.position.y,
                        z: m.position.z,
                        id: m.id
                    }, peerId);
                }
            });
        }, 500);

    });

    room.onPeerLeave(peerId => {
        console.log(`${peerId} left`);
        removeRemotePlayer(peerId);
        // updatePlayerCount(); // Removed UI

    });

    // 2. Movement Updates
    getMove((data, peerId) => {
        // If we haven't seen this peer yet (e.g. we joined late), add them
        if (!remotePlayers[peerId]) addRemotePlayer(peerId);

        const p = remotePlayers[peerId];
        if (p) {
            p.position.set(data.x, data.y, data.z);
            p.rotation.y = data.ry;
        }
    });

    // 3. Block Updates
    getBlock((data, peerId) => {
        if (data.action === 'place') {
            world.placeBlock(data.x, data.y, data.z, data.type);
        } else if (data.action === 'remove') {
            world.removeBlockAt(data.x, data.y, data.z);
        }
    });

    // 4. Mob Updates
    getMobSpawn((data, peerId) => {
        // Check if mob already exists (deduplication)
        if (mobs.find(m => m.id === data.id)) return;
        spawnMob(data.type, data.x, data.y, data.z, data.id, true);
    });

    getMobMove((data, peerId) => {
        const m = mobs.find(m => m.id === data.id);
        if (m && m.isRemote) {
            m.updateRemote(data.x, data.y, data.z, data.ry);
        }
    });

    getMobDeath((data, peerId) => {
        const m = mobs.find(m => m.id === data.id);
        if (m) {
            m.die(); // Visual death
        }
    });
}
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

const remotePlayers = {};

// function updatePlayerCount(statusOverride) {
//     const count = Object.keys(remotePlayers).length + 1;
//     document.getElementById('player-count').innerText = `Players: ${count}`;
// }



function addRemotePlayer(id) {
    if (remotePlayers[id]) return;

    // Simple Player Mesh
    const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red for now
    const mesh = new THREE.Mesh(geometry, material);

    // Face indicator
    const faceGeo = new THREE.BoxGeometry(0.5, 0.5, 0.2);
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, 0.5, -0.4);
    mesh.add(face);

    scene.add(mesh);
    remotePlayers[id] = mesh;
}

function removeRemotePlayer(id) {
    if (remotePlayers[id]) {
        scene.remove(remotePlayers[id]);
        delete remotePlayers[id];
    }
}


// --- LOOP ---
let prevTime = performance.now();
let lastFpsTime = prevTime;
let frames = 0;
const broadcastRate = 50; // ms (20 times/sec)
let lastBroadcast = 0;

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

    // Broadcast Position
    if (isMultiplayer && time - lastBroadcast > broadcastRate) {
        // Only send if moved? For simplicity/smoothing, sending frequently is robust for P2P UDP
        const p = player.camera.position;
        // Optimization: Check distance moved before sending could save bandwidth
        sendMove({ x: p.x, y: p.y, z: p.z, ry: player.camera.rotation.y });

        // Broadcast Local Mob Moves
        mobs.forEach(m => {
            if (!m.isRemote && !m.isDead) { // Only send my mobs
                sendMobMove({
                    id: m.id,
                    x: m.position.x,
                    y: m.position.y,
                    z: m.position.z,
                    ry: m.group.rotation.y
                });
            }
        });

        lastBroadcast = time;
    }

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
const lobbyContent = document.getElementById('lobby-content');
const waitingMessage = document.getElementById('waiting-message');
const ui = document.getElementById('ui');

// Singleplayer Button
document.getElementById('btn-singleplayer').addEventListener('click', () => {
    isMultiplayer = false;
    menuScreen.style.display = 'none';
    ui.classList.remove('hidden');
    startGame();
});

// Multiplayer Button
document.getElementById('btn-multiplayer').addEventListener('click', () => {
    isMultiplayer = true;
    mainMenuContent.classList.add('hidden');
    lobbyContent.classList.remove('hidden');
});

// Start (Connect) Button
document.getElementById('btn-connect').addEventListener('click', () => {
    const username = document.getElementById('username-input').value || "Player";
    document.getElementById('btn-connect').classList.add('hidden');
    document.getElementById('username-input').classList.add('hidden');
    waitingMessage.classList.remove('hidden');

    initMultiplayer(username);
});

// --- RESIZE ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
