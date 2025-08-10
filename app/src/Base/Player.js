// Importa o THREE se estiver usando módulos ES6. Se não, certifique-se que THREE.js já foi carregado.
// import * as THREE from 'three';

export class Player {
    constructor(world, scene) {
        this.world = world;
        this.scene = scene;

        // Player properties
        this.position = new THREE.Vector3(0, 10, 0);
        this.velocity = new THREE.Vector3();
        this.rotation = new THREE.Euler();
        this.playerHeight = 1.8;
        this.playerWidth = 0.6;
        this.stepHeight = 0.4; // Ajustado para ser um valor razoável
        this.onGround = false;
        this.speed = 5;
        this.jumpStrength = 8;
        this.gravity = 28;
        this.mouseSensitivity = 0.002;
        this.epsilon = 0.001; // Pequeno valor para evitar problemas de ponto flutuante
        this.moveVector = new THREE.Vector3();
        this.isSpawned = false;
        this.isFreeCam = false;
        this.rotX = 0;
        this.rotY = 0;

        // Mesh opcional para visualizar o jogador
        const geometry = new THREE.CylinderGeometry(this.playerWidth / 2, this.playerWidth / 2, this.playerHeight, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
    }

    spawn(x, y, z) {
        if (!this.isSpawned) {
            // Tenta encontrar uma posição segura para spawnar, caso o y fornecido seja inválido
            const groundY = this.world.getGroundHeight(x, z);
            const finalY = (y !== undefined ? y : groundY) + this.playerHeight / 2;
            this.position.set(x, finalY, z);
            this.isSpawned = true;
            console.log(`[Player] Spawned at: ${this.position.toArray()}`);
        } else {
            console.log(`[Player] Already spawned`);
        }
    }

    toggleFreeCam() {
        this.isFreeCam = !this.isFreeCam;
        if (this.isFreeCam) {
            this.velocity.y = 0;
        }
    }

    rotate(dx, dy) {
        this.rotY -= dx * this.mouseSensitivity;
        this.rotX -= dy * this.mouseSensitivity;
        this.rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotX));
    }

    jump() {
        if (!this.isFreeCam && this.onGround) {
            this.velocity.y = this.jumpStrength;
            this.onGround = false; // Importante para evitar pulos repetidos
        }
    }

    update(deltaTime, inputVector, freeCamVector, world) {
        if (!this.isSpawned) return;

        // --- Lógica de FreeCam ---
        if (this.isFreeCam) {
            const moveSpeed = this.speed * deltaTime;
            this.moveVector.copy(inputVector).multiplyScalar(moveSpeed * 1.5);
            this.moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotY);
            this.position.add(this.moveVector);
            this.position.y += freeCamVector.y * moveSpeed;
            this.mesh.position.copy(this.position);
            this.mesh.position.y += this.playerHeight / 2;
            return;
        }

        // --- Funções de Colisão (Helpers) ---
        const isSolidBlock = (blockType) =>
            blockType && blockType !== world.blockTypes.air && blockType !== world.blockTypes.water;

        const playerCylinder = {
            radius: this.playerWidth / 2,
            height: this.playerHeight,
        };

        const checkCollision = (checkPos) => {
            const minX = Math.floor(checkPos.x - playerCylinder.radius);
            const maxX = Math.ceil(checkPos.x + playerCylinder.radius);
            const minY = Math.floor(checkPos.y);
            const maxY = Math.ceil(checkPos.y + playerCylinder.height);
            const minZ = Math.floor(checkPos.z - playerCylinder.radius);
            const maxZ = Math.ceil(checkPos.z + playerCylinder.radius);

            for (let y = minY; y < maxY; y++) {
                for (let x = minX; x < maxX; x++) {
                    for (let z = minZ; z < maxZ; z++) {
                        if (isSolidBlock(world.getBlock(x, y, z))) {
                            const closestX = Math.max(x, Math.min(checkPos.x, x + 1));
                            const closestZ = Math.max(z, Math.min(checkPos.z, z + 1));
                            const distSq = (closestX - checkPos.x) ** 2 + (closestZ - checkPos.z) ** 2;
                            if (distSq < playerCylinder.radius ** 2) {
                                return true;
                            }
                        }
                    }
                }
            }
            return false;
        };

        // 1. APLICAR FORÇAS (GRAVIDADE)
        this.velocity.y -= this.gravity * deltaTime;

        // 2. RESOLVER MOVIMENTO E COLISÃO VERTICAL (EIXO Y)
        let moveY = this.velocity.y * deltaTime;
        let newPosY = this.position.y + moveY;

        if (checkCollision(new THREE.Vector3(this.position.x, newPosY, this.position.z))) {
            if (this.velocity.y < 0) { // Caindo e colidiu com o chão
                this.position.y = Math.floor(this.position.y);
                while (checkCollision(this.position)) {
                    this.position.y += this.epsilon;
                }
                this.position.y = Math.floor(this.position.y + this.epsilon); // Arredonda para baixo para garantir que está no topo
                this.onGround = true;
                this.velocity.y = 0;
            } else { // Subindo e colidiu com o teto
                this.velocity.y = 0;
            }
        } else {
            this.position.y = newPosY;
            this.onGround = false;
        }

        // 3. RESOLVER MOVIMENTO E COLISÃO HORIZONTAL (EIXOS X e Z)
        const moveSpeed = this.speed * deltaTime;
        this.moveVector.copy(inputVector).normalize().multiplyScalar(moveSpeed);
        this.moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotY);

        // --- Lógica de Auto-Jump ---
        if (this.onGround && inputVector.lengthSq() > 0.1) {
            const forwardCheckVec = new THREE.Vector3(0, 0, -1)
                .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotY)
                .multiplyScalar(playerCylinder.radius + 0.2);

            const headCheckPos = this.position.clone().add(forwardCheckVec);
            headCheckPos.y += 1;
            const feetCheckPos = this.position.clone().add(forwardCheckVec);

            if (checkCollision(feetCheckPos) && !checkCollision(headCheckPos)) {
                this.jump();
            }
        }

        // Tenta mover no eixo X
        let desiredMoveX = this.moveVector.x;
        let newPosX = this.position.x + desiredMoveX;
        if (checkCollision(new THREE.Vector3(newPosX, this.position.y, this.position.z))) {
            let stepY = this.position.y + this.stepHeight;
            if (this.onGround && !checkCollision(new THREE.Vector3(newPosX, stepY, this.position.z))) {
                this.position.y = stepY;
            } else {
                desiredMoveX = 0;
            }
        }
        this.position.x += desiredMoveX;

        // Tenta mover no eixo Z
        let desiredMoveZ = this.moveVector.z;
        let newPosZ = this.position.z + desiredMoveZ;
        if (checkCollision(new THREE.Vector3(this.position.x, this.position.y, newPosZ))) {
            let stepY = this.position.y + this.stepHeight;
            if (this.onGround && !checkCollision(new THREE.Vector3(this.position.x, stepY, newPosZ))) {
                this.position.y = stepY;
            } else {
                desiredMoveZ = 0;
            }
        }
        this.position.z += desiredMoveZ;

        // 4. ATUALIZAR MESH
        // A posição do jogador é a base (pés), então o mesh precisa ser deslocado para cima
        this.mesh.position.copy(this.position);
        this.mesh.position.y += this.playerHeight / 2;
    }
}
