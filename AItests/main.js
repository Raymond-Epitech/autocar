import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// === Q-Learning Agent ===
class QLearner {
    constructor(actions, alpha = 0.3, gamma = 0.9, epsilon = 0.2) {
        this.actions = actions;
        this.alpha = alpha;
        this.gamma = gamma;
        this.epsilon = epsilon;
        this.qTable = {};
        this.load();
    }

    getState(distances, velocity) {
        return [...distances.map(d => Math.floor(d * 2)), Math.floor(velocity * 10)].join("_");
    }

    chooseAction(state) {
        if (Math.random() < this.epsilon || !this.qTable[state]) {
            return Math.floor(Math.random() * this.actions.length);
        }
        return this.qTable[state].indexOf(Math.max(...this.qTable[state]));
    }

    update(state, actionIdx, reward, nextState) {
        this.qTable[state] = this.qTable[state] || new Array(this.actions.length).fill(0);
        this.qTable[nextState] = this.qTable[nextState] || new Array(this.actions.length).fill(0);
        this.qTable[state][actionIdx] += this.alpha * (reward + this.gamma * Math.max(...this.qTable[nextState]) - this.qTable[state][actionIdx]);
    }

    saveToIndexedDB() {
        const request = indexedDB.open('qlearning-db', 1);

        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('qtable')) {
                db.createObjectStore('qtable');
            }
        };

        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('qtable', 'readwrite');
            const store = tx.objectStore('qtable');
            store.put(this.qTable, 'data');
            tx.oncomplete = () => {
                console.log("Q-table saved to IndexedDB ✅");
                db.close();
            };
        };

        request.onerror = () => {
            console.error("Error saving Q-table to IndexedDB:", request.error);
        };
    }

    loadFromIndexedDB() {
        const request = indexedDB.open('qlearning-db', 1);

        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('qtable', 'readonly');
            const store = tx.objectStore('qtable');
            const getRequest = store.get('data');

            getRequest.onsuccess = () => {
                if (getRequest.result) {
                    this.qTable = getRequest.result;
                    console.log("Q-table loaded from IndexedDB ✅");
                }
                db.close();
            };

            getRequest.onerror = () => {
                console.error("Error loading Q-table:", getRequest.error);
                db.close();
            };
        };

        request.onerror = () => {
            console.error("Error opening IndexedDB:", request.error);
        };
    }

    save() {
        try {
            this.saveToIndexedDB();
        } catch (e) {
            console.error("Failed to export Q-table:", e);
        }
    }

    async importFromFile(file) {
        try {
            const text = await file.text();
            this.qTable = JSON.parse(text);
            console.log("Q-table imported ✅");
        } catch (e) {
            console.error("Failed to import Q-table:", e);
        }
    }

    load() {
        this.loadFromIndexedDB();
    }

    reset() {
        this.qTable = {};
        localStorage.removeItem('qTable');
        console.log("Q-table reset ❌");
    }
}

// === Vehicle Environment ===
class VehicleEnv {
    constructor(scene) {
        this.scene = scene;
        this.angle = 0;
        this.velocity = 0.1;
        this.maxSpeed = 0.3;
        this.acceleration = 0.01;
        this.raycaster = new THREE.Raycaster();
        this.sensorDirs = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0.5, 0, 1).normalize(),
            new THREE.Vector3(-0.5, 0, 1).normalize()
        ];
        this.sensorArrows = [];

        this.createWalls();
        this.createVehicle();
    }

    createWalls() {
        if (!this.scene) return;
        this.leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 100), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        this.leftWall.position.set(-10, 1, 0);
        this.rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 100), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
        this.rightWall.position.set(10, 1, 0);
        this.ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 100), new THREE.MeshBasicMaterial({ color: 0x444444 }));
        this.ground.rotation.x = -Math.PI / 2;
        this.scene.add(this.ground);
        this.scene.add(this.leftWall);
        this.scene.add(this.rightWall);
    }

    createVehicle() {
        this.vehicle = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 2), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        if (this.scene) this.scene.add(this.vehicle);
        this.reset();
    }

    getSensorDistances() {
        if (this.scene) {
            this.sensorLines.forEach(line => this.scene.remove(line));
            this.sensorArrows.forEach(arrow => this.scene.remove(arrow));
            this.sensorLines = [];
            this.sensorArrows = [];
        }

        return this.sensorDirs.map(dir => {
            const localDir = dir.clone().applyEuler(this.vehicle.rotation);
            this.raycaster.set(this.vehicle.position, localDir);

            if (this.scene) {
                const arrow = new THREE.ArrowHelper(localDir, this.vehicle.position, 2, 0x00ffff);
                this.scene.add(arrow);
                this.sensorArrows.push(arrow);
            }

            if (!this.scene) return 10;

            const intersects = this.raycaster.intersectObjects(this.scene.children, true);
            const distance = intersects[0] ? intersects[0].distance : 20;

            const endPoint = localDir.clone().multiplyScalar(distance).add(this.vehicle.position);
            const geometry = new THREE.BufferGeometry().setFromPoints([this.vehicle.position.clone(), endPoint]);
            const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffff00 }));
            this.scene.add(line);
            this.sensorLines.push(line);

            return distance;
        });
    }

    reset() {
        this.vehicle.position.set(0, 0.5, -45);
        this.angle = 0;
        this.vehicle.rotation.y = 0;
        this.velocity = 0.1;
        this.stepsSinceReset = 0;
    }

    step(action) {
        const steer = action[0];
        const accel = action[1];

        this.angle += steer;
        this.vehicle.rotation.y = this.angle;

        this.velocity += accel * this.acceleration;
        this.velocity = Math.max(0, Math.min(this.maxSpeed, this.velocity));

        const forward = new THREE.Vector3(0, 0, 1).applyEuler(this.vehicle.rotation);
        this.vehicle.position.add(forward.multiplyScalar(this.velocity));
        this.stepsSinceReset++;
    }

    getReward(distances) {
        const [r, l, f, fr, fl] = distances;
        const centered = Math.abs(r - l);
        const x = this.vehicle.position.x;
        const z = this.vehicle.position.z;

        if (z < -50 || z > 50 || Math.abs(x) > 9.5 || [r, l, f, fr, fl].some(d => d < 0.7)) {
            return -100;
        }

        if (z >= 45) {
            const maxSteps = 500;
            const speedBonus = 1 - Math.min(this.stepsSinceReset / maxSteps, 1);
            return 100 + speedBonus * 50;
        }

        return 1 - (centered * 0.1);
    }

    getVelocity() {
        return this.velocity;
    }
}

// === Setup ===
const actionSpace = [
    [-0.1, -1], [0, -1], [0.1, -1],
    [-0.1, 0],  [0, 0],  [0.1, 0],
    [-0.1, 1],  [0, 1],  [0.1, 1]
];

const agentTemplate = new QLearner(actionSpace);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const resetBtn = document.createElement('button');
resetBtn.innerText = "Reset Q-table";
resetBtn.style.position = 'absolute';
resetBtn.style.top = '10px';
resetBtn.style.left = '10px';
resetBtn.style.padding = '10px';
resetBtn.style.zIndex = '10';
document.body.appendChild(resetBtn);

const importInput = document.createElement('input');
importInput.type = 'file';
importInput.accept = 'application/json';
importInput.style.position = 'absolute';
importInput.style.top = '90px';
importInput.style.left = '10px';
importInput.style.zIndex = '10';
document.body.appendChild(importInput);

importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        await agentTemplate.importFromFile(file);
    }
});

// Drag and drop import
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', async e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
        await agentTemplate.importFromFile(file);
    }
});

const simulations = [];
const NUM_AGENTS = 1000;

resetBtn.addEventListener('click', () => agentTemplate.reset());

for (let i = 0; i < NUM_AGENTS; i++) {
    const simScene = i === 0 ? scene : null;
    const env = new VehicleEnv(simScene);
    const agent = agentTemplate;
    simulations.push({ env, agent });
}

camera.position.set(0, 15, -20);

let frameCount = 0;
let lastSave = 0;
const speedMultiplier = 10;
function animate() {
    requestAnimationFrame(animate);

    for (let step = 0; step < speedMultiplier; step++) {
        for (const { env, agent } of simulations) {
            const sensors = env.getSensorDistances();
            const state = agent.getState(sensors, env.getVelocity());
            const actionIdx = agent.chooseAction(state);
            const action = agent.actions[actionIdx];

            env.step(action);

            const newSensors = env.getSensorDistances();
            const nextState = agent.getState(newSensors, env.getVelocity());
            const reward = env.getReward(newSensors);
            agent.update(state, actionIdx, reward, nextState);

            if (reward === -100 || reward >= 100) {
                env.reset();
            }
        }

        frameCount++;
        lastSave++;
        if (lastSave > 500) {
            simulations[0].agent.save();
            lastSave = 0;
        }
    }

    const mainEnv = simulations[0].env;
    const camOffset = new THREE.Vector3(0, 10, -15).applyEuler(mainEnv.vehicle.rotation);
    camera.position.copy(mainEnv.vehicle.position).add(camOffset);
    camera.lookAt(mainEnv.vehicle.position);
    renderer.render(scene, camera);
}

animate();

// Auto-load from IndexedDB on startup
window.addEventListener('load', async () => {
    await agentTemplate.loadFromIndexedDB();
});

// Manual save to IndexedDB button
const saveBtn = document.createElement('button');
saveBtn.innerText = "Save Q-table";
saveBtn.style.position = 'absolute';
saveBtn.style.top = '130px';
saveBtn.style.left = '10px';
saveBtn.style.padding = '10px';
saveBtn.style.zIndex = '10';
document.body.appendChild(saveBtn);

saveBtn.addEventListener('click', async () => {
    await agentTemplate.saveToIndexedDB();
});

// Auto-save every 5 minutes
setInterval(async () => {
    await agentTemplate.saveToIndexedDB();
    console.log("Auto-saved Q-table to IndexedDB 🕒");
}, 5 * 60 * 1000);
