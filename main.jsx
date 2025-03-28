// main.jsx
document.addEventListener('DOMContentLoaded', () => {
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    scene.add(directionalLight);
    
    // Ground - road and grass
    const roadWidth = 10;
    const roadLength = 100;
    const grassWidth = 50;
    
    // Road
    const roadGeometry = new THREE.PlaneGeometry(roadWidth, roadLength);
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    scene.add(road);
    
    // Grass
    const grassGeometry = new THREE.PlaneGeometry(grassWidth, roadLength);
    const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x3a5f0b });
    const grassLeft = new THREE.Mesh(grassGeometry, grassMaterial);
    grassLeft.rotation.x = -Math.PI / 2;
    grassLeft.position.x = -(roadWidth / 2 + grassWidth / 2);
    grassLeft.receiveShadow = true;
    scene.add(grassLeft);
    
    const grassRight = new THREE.Mesh(grassGeometry, grassMaterial);
    grassRight.rotation.x = -Math.PI / 2;
    grassRight.position.x = roadWidth / 2 + grassWidth / 2;
    grassRight.receiveShadow = true;
    scene.add(grassRight);

    // Vehicle Class
    class Vehicle {
        constructor(model, scene) {
            this.model = model;
            this.scene = scene;
            this.container = new THREE.Group();
            this.speed = 0;
            this.maxSpeed = 0.5;
            this.rotationSpeed = 0.05;
            this.sensorData = {
                front: 0,
                left: 0,
                right: 0,
                frontLeft: 0,
                frontRight: 0
            };
            
            // Initialize vehicle
            this.init();
        }
        
        init() {
            // Adjust car rotation to face forward
            this.model.rotation.y = -Math.PI / 2;
            this.model.scale.set(1, 1, 1);
            
            // Add car to container
            this.container.add(this.model);
            this.container.position.set(0, 0.5, 0);
            this.scene.add(this.container);
            
            // Create sensor helpers (visible rays)
            this.createSensorHelpers();
        }
        
        createSensorHelpers() {
            // Visual representation of sensors (for debugging)
            this.sensorHelpers = new THREE.Group();
            
            const frontSensor = new THREE.ArrowHelper(
                new THREE.Vector3(0, 0, -1),
                new THREE.Vector3(),
                5,
                0xff0000
            );
            
            const leftSensor = new THREE.ArrowHelper(
                new THREE.Vector3(-1, 0, 0),
                new THREE.Vector3(),
                3,
                0x00ff00
            );
            
            const rightSensor = new THREE.ArrowHelper(
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(),
                3,
                0x00ff00
            );
            
            const frontLeftSensor = new THREE.ArrowHelper(
                new THREE.Vector3(-0.7, 0, -0.7),
                new THREE.Vector3(),
                4,
                0x0000ff
            );
            
            const frontRightSensor = new THREE.ArrowHelper(
                new THREE.Vector3(0.7, 0, -0.7),
                new THREE.Vector3(),
                4,
                0x0000ff
            );
            
            this.sensorHelpers.add(frontSensor);
            this.sensorHelpers.add(leftSensor);
            this.sensorHelpers.add(rightSensor);
            this.sensorHelpers.add(frontLeftSensor);
            this.sensorHelpers.add(frontRightSensor);
            this.container.add(this.sensorHelpers);
        }
        
        updateSensors() {
            const origin = this.container.position.clone();
            origin.y += 0.5; // Adjust sensor height
            
            const frontDirection = new THREE.Vector3(0, 0, -1);
            frontDirection.applyQuaternion(this.container.quaternion);
            
            const leftDirection = new THREE.Vector3(-1, 0, 0);
            leftDirection.applyQuaternion(this.container.quaternion);
            
            const rightDirection = new THREE.Vector3(1, 0, 0);
            rightDirection.applyQuaternion(this.container.quaternion);
            
            const frontLeftDirection = new THREE.Vector3(-0.7, 0, -0.7).normalize();
            frontLeftDirection.applyQuaternion(this.container.quaternion);
            
            const frontRightDirection = new THREE.Vector3(0.7, 0, -0.7).normalize();
            frontRightDirection.applyQuaternion(this.container.quaternion);
            
            // Raycast for each sensor
            const raycaster = new THREE.Raycaster();
            const maxDistance = 10;
            
            // Front sensor
            raycaster.set(origin, frontDirection);
            const frontIntersects = raycaster.intersectObjects(this.scene.children);
            this.sensorData.front = frontIntersects.length ? frontIntersects[0].distance : maxDistance;
            
            // Left sensor
            raycaster.set(origin, leftDirection);
            const leftIntersects = raycaster.intersectObjects(this.scene.children);
            this.sensorData.left = leftIntersects.length ? leftIntersects[0].distance : maxDistance;
            
            // Right sensor
            raycaster.set(origin, rightDirection);
            const rightIntersects = raycaster.intersectObjects(this.scene.children);
            this.sensorData.right = rightIntersects.length ? rightIntersects[0].distance : maxDistance;
            
            // Front-left sensor
            raycaster.set(origin, frontLeftDirection);
            const frontLeftIntersects = raycaster.intersectObjects(this.scene.children);
            this.sensorData.frontLeft = frontLeftIntersects.length ? frontLeftIntersects[0].distance : maxDistance;
            
            // Front-right sensor
            raycaster.set(origin, frontRightDirection);
            const frontRightIntersects = raycaster.intersectObjects(this.scene.children);
            this.sensorData.frontRight = frontRightIntersects.length ? frontRightIntersects[0].distance : maxDistance;
        }
        
        update(deltaTime) {
            this.updateSensors();
            
            // Basic AI control based on sensors
            this.aiControl();
            
            // Apply movement
            if (Math.abs(this.speed) > 0.01) {
                const direction = new THREE.Vector3(0, 0, -1);
                direction.applyQuaternion(this.container.quaternion);
                this.container.position.add(direction.multiplyScalar(this.speed * deltaTime));
            }
        }
        
        aiControl() {
            // Simple obstacle avoidance algorithm
            const { front, left, right, frontLeft, frontRight } = this.sensorData;
            
            // Slow down if something in front
            if (front < 5) {
                this.speed = Math.min(this.speed, this.maxSpeed * (front / 5));
            } else {
                this.speed = this.maxSpeed;
            }
            
            // Turn away from obstacles
            if (frontLeft < frontRight && frontLeft < 4) {
                this.container.rotation.y += this.rotationSpeed * (1 - frontLeft / 4);
            } else if (frontRight < frontLeft && frontRight < 4) {
                this.container.rotation.y -= this.rotationSpeed * (1 - frontRight / 4);
            }
            
            // Avoid walls
            if (left < 3) {
                this.container.rotation.y -= this.rotationSpeed * (1 - left / 3);
            } else if (right < 3) {
                this.container.rotation.y += this.rotationSpeed * (1 - right / 3);
            }
        }
        
        getPosition() {
            return this.container.position.clone();
        }
        
        getRotation() {
            return this.container.rotation.clone();
        }
        
        getSensorData() {
            return {...this.sensorData};
        }
    }

    // Main variables
    let vehicle = null;
    const keys = {
        z: false,
        q: false,
        s: false,
        d: false
    };
    
    // Load car model and create vehicle
    const objLoader = new THREE.OBJLoader();
    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load('green_car/Green_Bubble_Car_0328165252_texture.png', (texture) => {
        objLoader.load('green_car/Green_Bubble_Car_0328165252_texture.obj', (object) => {
            // Apply texture to all children
            object.traverse((child) => {
                if (child.isMesh) {
                    child.material.map = texture;
                    child.material.needsUpdate = true;
                    child.castShadow = true;
                }
            });
            
            // Create vehicle instance
            vehicle = new Vehicle(object, scene);
        });
    });
    
    // Event listeners for keyboard controls (ZQSD)
    document.addEventListener('keydown', (event) => {
        switch (event.key.toLowerCase()) {
            case 'z': keys.z = true; break;
            case 'q': keys.q = true; break;
            case 's': keys.s = true; break;
            case 'd': keys.d = true; break;
        }
    });
    
    document.addEventListener('keyup', (event) => {
        switch (event.key.toLowerCase()) {
            case 'z': keys.z = false; break;
            case 'q': keys.q = false; break;
            case 's': keys.s = false; break;
            case 'd': keys.d = false; break;
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Animation loop
    let lastTime = 0;
    function animate(currentTime) {
        requestAnimationFrame(animate);
        
        const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
        lastTime = currentTime;
        
        if (vehicle) {
            // Manual control override
            if (keys.z) vehicle.speed = vehicle.maxSpeed;
            if (keys.s) vehicle.speed = -vehicle.maxSpeed * 0.5;
            if (keys.q) vehicle.container.rotation.y += vehicle.rotationSpeed;
            if (keys.d) vehicle.container.rotation.y -= vehicle.rotationSpeed;
            
            // Update vehicle
            vehicle.update(deltaTime);
            
            // Update camera to follow vehicle
            const cameraOffset = new THREE.Vector3(0, 5, 10);
            cameraOffset.applyQuaternion(vehicle.container.quaternion);
            camera.position.copy(vehicle.getPosition()).add(cameraOffset);
            camera.lookAt(vehicle.getPosition());
        }
        
        renderer.render(scene, camera);
    }
    
    animate();
});
