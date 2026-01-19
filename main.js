import * as THREE from 'three';
import { World } from './World.js?v=5';
import { Player } from './Player.js';


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
const types = ['grass', 'stone', 'dirt', 'wood', 'water', null, null, null, null];
slots.forEach((s, i) => {
    if (types[i]) {
        // Simple color approximation for icon
        let color = '#fff';
        if (types[i] === 'grass') color = '#5C9E38';
        if (types[i] === 'stone') color = '#757575';
        if (types[i] === 'dirt') color = '#5D4037';
        if (types[i] === 'wood') color = '#4E342E';
        if (types[i] === 'leaves') color = '#388E3C';
        if (types[i] === 'sand') color = '#F4A460';
        if (types[i] === 'bedrock') color = '#1a1a1a';
        if (types[i] === 'water') color = '#244F99';
        s.style.backgroundColor = color;
    } else {
        s.style.backgroundColor = 'transparent';
    }
});


// Breaking/Placing
window.addEventListener('mousedown', (e) => {
    if (!player.controls.isLocked) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(world.objects);

    if (intersects.length > 0 && intersects[0].distance < 6) {
        const hit = intersects[0];

        if (e.button === 0) { // Left Click - Break
            if (hit.object.isInstancedMesh) {
                world.removeBlock(hit.object, hit.instanceId);

                // Recover coords from matrix for network
                const matrix = new THREE.Matrix4();
                hit.object.getMatrixAt(hit.instanceId, matrix);
                const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
                const x = Math.floor(pos.x);
                const y = Math.floor(pos.y);
                const z = Math.floor(pos.z);

                if (typeof sendBlock === 'function') sendBlock({ action: 'remove', x, y, z });

            } else if (hit.object.userData && hit.object.userData.type) {
                // Fallback for non-instanced objects (like old water meshes if clickable)
                const { x, y, z } = hit.object.userData;
                world.removeBlock(hit.object);
                if (typeof sendBlock === 'function') sendBlock({ action: 'remove', x, y, z });
            }
        } else if (e.button === 2) { // Right Click - Place / Spawn
            const norm = hit.face.normal;
            let pos;

            if (hit.object.isInstancedMesh) {
                const matrix = new THREE.Matrix4();
                hit.object.getMatrixAt(hit.instanceId, matrix);
                pos = new THREE.Vector3().setFromMatrixPosition(matrix).add(norm);
            } else {
                pos = hit.object.position.clone().add(norm);
            }

            // Don't place inside player
            const pPos = camera.position;
            const dx = Math.abs(pos.x - pPos.x);
            const dy = Math.abs(pos.y - pPos.y);
            const dz = Math.abs(pos.z - pPos.z);
            if (dx < 0.8 && dy < 1.8 && dz < 0.8) return;

            const type = types[selectedSlot];
            if (!type) return;

            const bx = Math.floor(pos.x);
            const by = Math.floor(pos.y);
            const bz = Math.floor(pos.z);

            world.placeBlock(bx, by, bz, type);
            if (typeof sendBlock === 'function') sendBlock({ action: 'place', x: bx, y: by, z: bz, type: type });
        }
        else if (e.button === 1) { // Middle Click - Attack Mob (Raycast separately or check objects)
            // Handled below for Mob Interaction
        }
    }


});


// --- NETWORK & MULTIPLAYER (P2P - MQTT) ---
import { joinRoom } from 'trystero';

// Config
const roomConfig = {
    appId: 'skalek-craft-v3-stun',
    rtcConfig: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    }
};
const room = joinRoom(roomConfig, 'main-lobby');

// Actions
const [sendMove, getMove] = room.makeAction('move');
const [sendBlock, getBlock] = room.makeAction('block');

const remotePlayers = {};

function updatePlayerCount(statusOverride) {
    const count = Object.keys(remotePlayers).length + 1;
    document.getElementById('player-count').innerText = `Players: ${count}`;
}

// 1. Peer Management
room.onPeerJoin(peerId => {
    console.log(`${peerId} joined`);
    addRemotePlayer(peerId);
    // Wait a split second to ensure connection is stable before sending
    setTimeout(() => {
        updatePlayerCount(); // Reset to normal count
        // Send my current position to the new peer immediately so they see me
        const p = player.camera.position;
        sendMove({ x: p.x, y: p.y, z: p.z, ry: player.camera.rotation.y }, peerId);
    }, 500);

});

room.onPeerLeave(peerId => {
    console.log(`${peerId} left`);
    removeRemotePlayer(peerId);
    updatePlayerCount();
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
const broadcastRate = 50; // ms (20 times/sec)
let lastBroadcast = 0;

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.1);
    prevTime = time;

    player.update(delta);

    // Broadcast Position
    if (time - lastBroadcast > broadcastRate) {
        // Only send if moved? For simplicity/smoothing, sending frequently is robust for P2P UDP
        const p = player.camera.position;
        // Optimization: Check distance moved before sending could save bandwidth
        sendMove({ x: p.x, y: p.y, z: p.z, ry: player.camera.rotation.y });
        lastBroadcast = time;
    }

    renderer.render(scene, camera);
}
animate();

// --- RESIZE ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
