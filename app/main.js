import { World } from './src/Base/World.js';
import { Player } from './src/Base/Player.js';
import { VoxelCamera } from './src/Base/Camera.js';

// --- BASIC SETUP ---
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });
const clock = new THREE.Clock();
document.body.appendChild(renderer.domElement);

// --- LIGHTS AND FOG ---
scene.fog = new THREE.Fog(0x87ceeb, 0, 700);
scene.background = new THREE.Color(0x87ceeb);
const ambientLight = new THREE.AmbientLight(0xcccccc, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
scene.add(directionalLight);

// --- GAME OBJECTS ---
const world = new World(scene);
const player = new Player(world, scene); // Pass 'scene' here
const camera = new VoxelCamera();

world.onPlayerSpawn = (spawnX, spawnZ, groundHeight) => {
    console.log(`[Main] world.onPlayerSpawn triggered with: ${spawnX}, ${groundHeight}, ${spawnZ}`);
    try {
        player.spawn(spawnX, groundHeight, spawnZ);
        console.log(`[Main] Player spawn call successful.`);
    } catch (error) {
        console.error(`[Main] Error during player spawn:`, error);
    }
};

// --- CONTROLS & UI ---
const touchState = { 
    joy: { id: -1, dir: {x:0, z:0} }, 
    look: { id: -1, start: {x:0, y:0} },
    jump: { id: -1, held: false },
    down: { id: -1, held: false }
};

const joystickEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');
const jumpButtonEl = document.getElementById('jump-button');
const goDownButtonEl = document.getElementById('godown-button');
const freeCamButtonEl = document.getElementById('freecam-button');
const debugPanel = document.getElementById('debug-panel');

freeCamButtonEl.addEventListener('click', toggleFreeCam);
freeCamButtonEl.addEventListener('touchstart', toggleFreeCam);

function toggleFreeCam(e) {
    e.preventDefault();
    e.stopPropagation();
    player.toggleFreeCam();
    freeCamButtonEl.classList.toggle('active', player.isFreeCam);
}

function handleTouchStart(e) { /* ... (Touch handling logic from original code) ... */ }
function handleTouchMove(e) { /* ... (Touch handling logic from original code) ... */ }
function handleTouchEnd(e) { /* ... (Touch handling logic from original code) ... */ }

// (Paste the original handleTouchStart, handleTouchMove, and handleTouchEnd functions here,
// but modify them to call player methods, e.g., `player.jump()`)

// Example modification for jump:
// inside handleTouchStart -> if (jumpButtonEl.contains(touch.target)) -> player.jump();

window.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
        if (touchState.look.id === -1 && !joystickEl.contains(touch.target) && !jumpButtonEl.contains(touch.target) && !goDownButtonEl.contains(touch.target) && !freeCamButtonEl.contains(touch.target)) {
             touchState.look.id = touch.identifier;
             touchState.look.start = { x: touch.clientX, y: touch.clientY };
        } else if (jumpButtonEl.contains(touch.target)) {
            touchState.jump.id = touch.identifier;
            touchState.jump.held = true;
            player.jump();
        } else if (goDownButtonEl.contains(touch.target)) {
            touchState.down.id = touch.identifier;
            touchState.down.held = true;
        } else if (joystickEl.contains(touch.target) && touchState.joy.id === -1) {
            touchState.joy.id = touch.identifier;
        }
    }
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
        if (touch.identifier === touchState.joy.id) {
            const joyRect = joystickEl.getBoundingClientRect();
            const dx = touch.clientX - joyRect.left - joyRect.width / 2;
            const dy = touch.clientY - joyRect.top - joyRect.height / 2;
            const distance = Math.min(joyRect.width / 2, Math.sqrt(dx * dx + dy * dy));
            const angle = Math.atan2(dy, dx);
            touchState.joy.dir.x = (distance / (joyRect.width / 2)) * Math.cos(angle);
            touchState.joy.dir.z = (distance / (joyRect.width / 2)) * Math.sin(angle);
            stickEl.style.transform = `translate(${distance * Math.cos(angle)}px, ${distance * Math.sin(angle)}px)`;
        } else if (touch.identifier === touchState.look.id) {
            const dx = touch.clientX - touchState.look.start.x;
            const dy = touch.clientY - touchState.look.start.y;
            touchState.look.start = { x: touch.clientX, y: touch.clientY };
            player.rotate(dx, dy);
        }
    }
}, { passive: false });

window.addEventListener('touchend', (e) => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
        if (touch.identifier === touchState.joy.id) {
            touchState.joy.id = -1;
            touchState.joy.dir.x = 0;
            touchState.joy.dir.z = 0;
            stickEl.style.transform = `translate(0px, 0px)`;
        } else if (touch.identifier === touchState.look.id) {
            touchState.look.id = -1;
        } else if (touch.identifier === touchState.jump.id) {
            touchState.jump.id = -1;
            touchState.jump.held = false;
        } else if (touch.identifier === touchState.down.id) {
            touchState.down.id = -1;
            touchState.down.held = false;
        }
    }
}, { passive: false });
window.addEventListener('touchcancel', (e) => {/*... same as touchend ...*/}, {passive:false});

// --- DEBUG & RESIZE ---
let frameCount = 0, fps = 0, lastFPSTime = 0;
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.setSize(window.innerWidth, window.innerHeight); // Initial size

// --- MAIN LOOP ---
function animate(time) {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(0.05, clock.getDelta());
    const elapsedTime = clock.getElapsedTime();

    world.updateUniforms(elapsedTime);
    
    const inputVector = new THREE.Vector3(touchState.joy.dir.x, 0, touchState.joy.dir.z);
    
    const freeCamVector = new THREE.Vector3(0,0,0);
    if(touchState.jump.held) freeCamVector.y = 1;
    if(touchState.down.held) freeCamVector.y = -1;

    player.update(deltaTime, inputVector, freeCamVector, world);

    camera.update(player);

    world.update(player.position);
    
    // Sun cycle
    const sunAngle = (elapsedTime / 120) * Math.PI;
    directionalLight.position.set(Math.cos(sunAngle) * 300, Math.sin(sunAngle) * 300, 150);
    
    // FPS and Debug Panel
    frameCount++;
    if (time >= lastFPSTime + 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFPSTime = time;
        let mode = player.isFreeCam ? "Free Cam" : (player.isSpawned ? "Normal" : "Carregando");
        let debugText = `FPS: ${fps} | Modo: ${mode}<br>`;
        if (player.isSpawned || player.isFreeCam) {
            const pos = player.position;
            const cycle = Math.sin(sunAngle) > 0 ? "Dia" : "Noite";
            const biome = world.getBiomeAt(pos.x, pos.z);
            debugText += `Pos: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}<br>Bioma: ${biome} | Ciclo: ${cycle}`;
        } else {
            debugText += "Carregando mundo...";
        }
        debugPanel.innerHTML = debugText;
    }

    renderer.render(scene, camera);
}

animate(0);