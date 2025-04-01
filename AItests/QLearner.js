// Refactor initial – rendu conservé pour un véhicule visible
// Structure prévue : VehicleEnv + QLearner + boucle d'animation

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

    getState(distances) {
        return distances.map(d => Math.floor(d * 2)).join("_");
    }

    chooseAction(state) {
        if (Math.random() < this.epsilon || !this.qTable[state]) {
            return Math.floor(Math.random() * this.actions.length);
        }
        return this.qTable[state].indexOf(Math.max(...this.qTable[state]));
    }

    update(state, actionIdx, reward, nextState) {
        this.qTable[state] = this.qTable[state] || [0, 0, 0];
        this.qTable[nextState] = this.qTable[nextState] || [0, 0, 0];
        this.qTable[state][actionIdx] += this.alpha * (reward + this.gamma * Math.max(...this.qTable[nextState]) - this.qTable[state][actionIdx]);
    }

    save() {
        localStorage.setItem('qTable', JSON.stringify(this.qTable));
    }

    load() {
        const saved = localStorage.getItem('qTable');
        if (saved) {
            this.qTable = JSON.parse(saved);
            console.log("Q-table loaded ✅");
        }
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
        this.raycaster = new THREE.Raycaster();
        this.sensorDirs = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0.5, 0, 1).normalize(),
            new THREE.Vector3(-0.5, 0, 1).normalize()
        ];

        this.createWalls();
        this.createVehicle();
    }

    createWalls() {
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
        this.scene.add(this.vehicle);
        this.reset();
    }

    getSensorDistances() {
        return this.sensorDirs.map(dir => {
            const localDir = dir.clone().applyEuler(this.vehicle.rotation);
            this.raycaster.set(this.vehicle.position, localDir);
            const intersects = this.raycaster.intersectObjects([this.leftWall, this.rightWall]);
            return intersects[0] ? intersects[0].distance : 20;
        });
    }

    reset() {
        this.vehicle.position.set(0, 0.5, -45);
        this.angle = 0;
        this.vehicle.rotation.y = 0;
    }

    step(steer) {
        this.angle += steer;
        this.vehicle.rotation.y = this.angle;
        const forward = new THREE.Vector3(0, 0, 1).applyEuler(this.vehicle.rotation);
        this.vehicle.position.add(forward.multiplyScalar(this.velocity));
    }

    getReward(distances) {
        const [r, l, f, fr, fl] = distances;
        const centered = Math.abs(r - l);
        const x = this.vehicle.position.x;
        const z = this.vehicle.position.z;

        if (z < -50 || z > 50 || Math.abs(x) > 9.5 || [r, l, f, fr, fl].some(d => d < 0.7)) {
            return -100;
        }
        if (z >= 45) return 100;
        return 1 - (centered * 0.1);
    }
}

// === Scene Setup & Main Loop ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const env = new VehicleEnv(scene);
const agent = new QLearner([-0.1, 0, 0.1]);

camera.position.set(0, 15, -20);

// Reset button
const resetBtn = document.createElement('button');
resetBtn.innerText = "Reset Q-table";
resetBtn.style.position = 'absolute';
resetBtn.style.top = '10px';
resetBtn.style.left = '10px';
resetBtn.style.padding = '10px';
resetBtn.style.zIndex = '10';
document.body.appendChild(resetBtn);
resetBtn.addEventListener('click', () => agent.reset());

let frameCount = 0;
function animate() {
    requestAnimationFrame(animate);

    const sensors = env.getSensorDistances();
    const state = agent.getState(sensors);
    const actionIdx = agent.chooseAction(state);
    const steer = agent.actions[actionIdx];

    env.step(steer);

    const newSensors = env.getSensorDistances();
    const nextState = agent.getState(newSensors);
    const reward = env.getReward(newSensors);
    agent.update(state, actionIdx, reward, nextState);

    if (reward === -100 || reward === 100) {
        env.reset();
    }

    frameCount++;
    if (frameCount % 500 === 0) {
        agent.save();
    }

    const camOffset = new THREE.Vector3(0, 10, -15).applyEuler(env.vehicle.rotation);
    camera.position.copy(env.vehicle.position).add(camOffset);
    camera.lookAt(env.vehicle.position);

    renderer.render(scene, camera);
}

animate();
