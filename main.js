import * as THREE from 'three';
import { World } from './World.js';
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
world.generateSimple(16); // 32x32 area

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
const types = ['grass', 'stone', 'dirt', 'wood', 'leaves', 'stone', 'grass', 'dirt', 'wood'];
slots.forEach((s, i) => {
    if (types[i]) {
        // Simple color approximation for icon
        let color = '#fff';
        if (types[i] === 'grass') color = '#5C9E38';
        if (types[i] === 'stone') color = '#757575';
        if (types[i] === 'dirt') color = '#5D4037';
        if (types[i] === 'wood') color = '#4E342E';
        if (types[i] === 'leaves') color = '#388E3C';
        s.style.backgroundColor = color;
    }
});


// Breaking/Placing
window.addEventListener('mousedown', (e) => {
    if (!player.controls.isLocked) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(world.objects); // Expensive optimization needed later

    if (intersects.length > 0 && intersects[0].distance < 6) {
        const hit = intersects[0];

        if (e.button === 0) { // Left Click - Break
            const obj = hit.object;
            if (obj.userData && obj.userData.type) {
                const { x, y, z } = obj.userData;
                world.removeBlock(obj);
                socket.emit('blockUpdate', { action: 'remove', x, y, z });
            }
        } else if (e.button === 2) { // Right Click - Place
            // Calculate new position
            const norm = hit.face.normal;
            const pos = hit.object.position.clone().add(norm);

            // Don't place inside player
            const pPos = camera.position;
            const dx = Math.abs(pos.x - pPos.x);
            const dy = Math.abs(pos.y - pPos.y);
            const dz = Math.abs(pos.z - pPos.z);
            if (dx < 0.8 && dy < 1.8 && dz < 0.8) return; // Simple safety check

            // Determine type from hotbar (mock)
            const type = types[selectedSlot] || 'stone';
            const bx = Math.floor(pos.x);
            const by = Math.floor(pos.y);
            const bz = Math.floor(pos.z);

            world.placeBlock(bx, by, bz, type);
            socket.emit('blockUpdate', { action: 'place', x: bx, y: by, z: bz, type: type });
        }
    }
});


// --- NETWORK & MULTIPLAYER ---
const socket = io();
const remotePlayers = {};

socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach((id) => {
        if (id === socket.id) return;
        addRemotePlayer(id, players[id]);
    });
});

socket.on('newPlayer', (data) => {
    addRemotePlayer(data.id, data.player);
});

socket.on('playerDisconnected', (id) => {
    removeRemotePlayer(id);
});

socket.on('playerMoved', (data) => {
    const p = remotePlayers[data.id];
    if (p) {
        // Simple interpolation could go here, for now direct snap
        p.position.set(data.x, data.y, data.z);
        p.rotation.y = data.ry;
        // Update name tag or head rotation if added later
    }
});

socket.on('blockUpdate', (data) => {
    if (data.action === 'place') {
        world.placeBlock(data.x, data.y, data.z, data.type);
    } else if (data.action === 'remove') {
        // We need a removeBlockAt or similar that doesn't rely on mesh reference if possible, 
        // or find the mesh at that location.
        // World.js has removeBlock(mesh), let's see if we can use that or need a helper.
        // For now, let's assume valid coordinates and use world internal logic.
        // Actually World.js has removeBlockAt(x,y,z) which is perfect.
        world.removeBlockAt(data.x, data.y, data.z);
    }
});

function addRemotePlayer(id, data) {
    // Simple Player Mesh
    const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red for enemies/others
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(data.x, data.y, data.z);

    // Add "face" to see direction
    const faceGeo = new THREE.BoxGeometry(0.5, 0.5, 0.2);
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, 0.5, -0.4); // slightly forward/up
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

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.1); // Cap delta to prevent huge jumps
    prevTime = time;

    player.update(delta);

    // Send visual updates to server if moved
    if (player.controls.isLocked) {
        const p = player.camera.position;
        const r = player.camera.rotation.y;
        // We should really only send if changed explicitly, doing it every frame is okay for localhost testing
        // but bad for bandwidth. Let's add a check in Player.js or here.
        // For simplicity, send every frame here for now, or throttle.
        socket.emit('playerMovement', { x: p.x, y: p.y, z: p.z, ry: player.camera.rotation.y });
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
