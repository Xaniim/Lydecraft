import { Chunk } from './Chunk.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.chunkSize = 16;
        this.renderDistance = 5;
        this.worldSeed = Math.floor(Date.now() * Math.random());
        this.chunks = {};
        this.worldHeightMaps = {};
        this.onPlayerSpawn = null;
        this.waterLevel = 30; // Synced with worker

        // --- Materials & Uniforms ---
        this.animationDuration = 1.0; 
        this.globalUniforms = { u_time: { value: 0 } };
        this.materials = {};

        const textureLoader = new THREE.TextureLoader();

        const texturePaths = {
            'grass_top': 'src/Assets/World/grassblock/v1/up.png',
            'grass_side': 'src/Assets/World/grassblock/v1/side.png',
            'dirt': 'src/Assets/World/grassblock/v1/down.png',
            'sand': 'src/Assets/World/sand/sand.png',
            'stone': 'src/Assets/World/stone/stone.png',
            'leaves': 'src/Assets/World/leaves/leaves.png',
            'trunk_side': 'src/Assets/World/trunk/trunk_sides.png',
            'trunk_top': 'src/Assets/World/trunk/trunk_up_down.png'
        };

        for (const name in texturePaths) {
            const texture = textureLoader.load(texturePaths[name]);
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            this.materials[name] = new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide });
        }

        const materialColors = {
            snow: 0xffffff,
            cactus: 0x006400,
            water: 0x4488ff
        };

        for (const name in materialColors) {
            const mat = new THREE.MeshLambertMaterial({
                color: materialColors[name],
                transparent: name === 'water',
                opacity: name === 'water' ? 0.7 : 1.0,
                side: THREE.DoubleSide
            });
            mat.u_time_generated = new THREE.Uniform(0);
            mat.u_animation_duration = new THREE.Uniform(this.animationDuration);

            mat.onBeforeCompile = shader => {
                shader.uniforms.u_time = this.globalUniforms.u_time;
                shader.uniforms.u_time_generated = mat.u_time_generated;
                shader.uniforms.u_animation_duration = mat.u_animation_duration;
                shader.vertexShader = 'uniform float u_time;\nuniform float u_time_generated;\nuniform float u_animation_duration;\n' + shader.vertexShader;
                shader.vertexShader = shader.vertexShader.replace( '#include <begin_vertex>', ` #include <begin_vertex> float time_elapsed = u_time - u_time_generated; float anim_progress = smoothstep(0.0, u_animation_duration, time_elapsed); transformed.y += (1.0 - anim_progress) * -20.0; ` );
            };
            this.materials[name] = mat;
        }
        
        // --- Worker Setup ---
        this.worker = new Worker('worker.js');
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
    }

    handleWorkerMessage(event) {
        const { cx, cz, geometries, heightMap, chunkData, blockTypes } = event.data;
        const chunkKey = `${cx},${cz}`;

        console.log(`[World] Received message for chunk ${chunkKey}. Geometries:`, geometries); // Added this line

        if (this.chunks[chunkKey] && this.chunks[chunkKey].state === 'pending') {
            const chunk = new Chunk(this.scene, cx, cz, geometries, this.materials, this.globalUniforms);
            this.chunks[chunkKey] = { chunk, state: 'loaded', chunkData: new Uint8Array(chunkData) };
            console.log(`[World] Stored chunkData for ${chunkKey}:`, this.chunks[chunkKey].chunkData);
            this.worldHeightMaps[chunkKey] = heightMap;
            
            // Store blockTypes if not already stored (assuming it's consistent across chunks)
            if (!this.blockTypes) {
                this.blockTypes = blockTypes;
            }

            // Check for initial player spawn
            if (this.onPlayerSpawn && cx === 0 && cz === 0) {
                const spawnX = this.chunkSize / 2;
                const spawnZ = this.chunkSize / 2;
                const groundHeight = this.getGroundHeight(spawnX, spawnZ);
                console.log(`[World] Spawning player at: ${spawnX}, ${groundHeight}, ${spawnZ}`); // Added this line
                this.onPlayerSpawn(spawnX, spawnZ, groundHeight);
            }
        }
    }

    update(playerPosition) {
        const pcx = Math.floor(playerPosition.x / this.chunkSize);
        const pcz = Math.floor(playerPosition.z / this.chunkSize);

        // Load new chunks
        for (let i = -this.renderDistance; i <= this.renderDistance; i++) {
            for (let j = -this.renderDistance; j <= this.renderDistance; j++) {
                const chunkKey = `${pcx + i},${pcz + j}`;
                if (!this.chunks[chunkKey]) {
                    this.chunks[chunkKey] = { state: 'pending' };
                    this.worker.postMessage({
                        type: 'generate',
                        cx: pcx + i,
                        cz: pcz + j,
                        seed: this.worldSeed
                    });
                }
            }
        }

        // Unload distant chunks
        for (const key in this.chunks) {
            const [cx, cz] = key.split(',').map(Number);
            if (Math.abs(cx - pcx) > this.renderDistance || Math.abs(cz - pcz) > this.renderDistance) {
                if (this.chunks[key].chunk) {
                    this.chunks[key].chunk.dispose();
                }
                delete this.chunks[key];
                delete this.worldHeightMaps[key];
            }
        }
    }

    updateUniforms(elapsedTime) {
        this.globalUniforms.u_time.value = elapsedTime;
    }

    getGroundHeight(x, z) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        const heightMap = this.worldHeightMaps[`${cx},${cz}`];
        if (heightMap) {
            const localX = Math.floor(THREE.MathUtils.euclideanModulo(x, this.chunkSize));
            const localZ = Math.floor(THREE.MathUtils.euclideanModulo(z, this.chunkSize));
            let height = heightMap[`${localX},${localZ}`];
            if (isNaN(height)) { // Check for NaN
                console.warn(`[World] getGroundHeight: Detected NaN height for ${x},${z}. Returning 0.`);
                return 0; // Return a safe default
            }
            return height || 0;
        }
        return 0;
    }

    getBiomeAt(x, z) {
        const y = this.getGroundHeight(x, z);
        if (y > 65) return "Neve";
        if (y <= this.waterLevel + 3 && y > this.waterLevel) return "Praia";
        if (y <= this.waterLevel) return "Oceano";
        return "Planície/Floresta";
    }

    getBlock(x, y, z) {
        const cx = Math.floor(x / this.chunkSize);
        const cz = Math.floor(z / this.chunkSize);
        const chunkKey = `${cx},${cz}`;

        const chunk = this.chunks[chunkKey];
        if (!chunk || chunk.state !== 'loaded' || !chunk.chunkData) {
            return 0; // Assuming 0 is air or unknown block type
        }

        const lx = Math.floor(THREE.MathUtils.euclideanModulo(x, this.chunkSize));
        const ly = Math.floor(y);
        const lz = Math.floor(THREE.MathUtils.euclideanModulo(z, this.chunkSize));

        if (ly < 0 || ly >= 128) { // Assuming chunkHeight is 128
            return 0; // Out of vertical bounds
        }

        // Calculate index in the 1D array
        const index = ly * this.chunkSize * this.chunkSize + lx * this.chunkSize + lz;
        const blockType = chunk.chunkData[index];
        console.log(`World: getBlock(${x},${y},${z}) -> blockType: ${blockType}`);
        return blockType;
    }
}
