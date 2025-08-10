self.importScripts('https://cdn.jsdelivr.net/gh/josephg/noisejs/perlin.js', 'src/WorldData/Water.js');

const chunkSize = 16;
const chunkHeight = 128;

const blockTypes = {
    air: 0, stone: 1, dirt: 2, grass: 3, sand: 4, snow: 5,
    trunk: 6, leaf: 7, water: 9, bedrock: 10
};

const materialMap = {
    [blockTypes.grass]: 'grass_side', 
    [blockTypes.stone]: 'stone', 
    [blockTypes.dirt]: 'dirt',
    [blockTypes.sand]: 'sand', 
    [blockTypes.snow]: 'snow',
    [blockTypes.trunk]: 'trunk',
    [blockTypes.leaf]: 'leaf', 
    [blockTypes.water]: 'water',
    [blockTypes.bedrock]: 'stone'
};

const transparentBlocks = new Set([blockTypes.air, blockTypes.water, blockTypes.leaf]);

const s = 0.5;
const faces = {
    // Up face (+Y)
    up: {
        dir: [0, 1, 0],
        corners: [
            [-s, s, s],  // 0: front-left-top
            [-s, s, -s], // 1: back-left-top
            [s, s, -s],  // 2: back-right-top
            [s, s, s]    // 3: front-right-top
        ],
        uvs: [0, 1, 0, 0, 1, 0, 1, 1] // UVs for these corners
    },
    // Down face (-Y)
    down: {
        dir: [0, -1, 0],
        corners: [
            [-s, -s, -s], // 0: back-left-bottom
            [-s, -s, s],  // 1: front-left-bottom
            [s, -s, s],   // 2: front-right-bottom
            [s, -s, -s]   // 3: back-right-bottom
        ],
        uvs: [0, 1, 0, 0, 1, 0, 1, 1] // UVs for these corners
    },
    // East face (+X)
    east: {
        dir: [1, 0, 0],
        corners: [
            [s, -s, s],  // 0: bottom-front-right
            [s, -s, -s], // 1: bottom-back-right
            [s, s, -s],  // 2: top-back-right
            [s, s, s]    // 3: top-front-right
        ],
        uvs: [0, 0, 1, 0, 1, 1, 0, 1] // UVs for these corners
    },
    // West face (-X)
    west: {
        dir: [-1, 0, 0],
        corners: [
            [-s, -s, -s], // 0: bottom-back-left
            [-s, -s, s],  // 1: bottom-front-left
            [-s, s, s],   // 2: top-front-left
            [-s, s, -s]   // 3: top-back-left
        ],
        uvs: [0, 0, 1, 0, 1, 1, 0, 1] // UVs for these corners
    },
    // North face (+Z)
    north: {
        dir: [0, 0, 1],
        corners: [
            [-s, -s, s], // 0: bottom-left-front
            [s, -s, s],  // 1: bottom-right-front
            [s, s, s],   // 2: top-right-front
            [-s, s, s]   // 3: top-left-front
        ],
        uvs: [0, 0, 1, 0, 1, 1, 0, 1] // UVs for these corners
    },
    // South face (-Z)
    south: {
        dir: [0, 0, -1],
        corners: [
            [s, -s, -s],  // 0: bottom-right-back
            [-s, -s, -s], // 1: bottom-left-back
            [-s, s, -s],  // 2: top-left-back
            [s, s, -s]    // 3: top-right-back
        ],
        uvs: [0, 0, 1, 0, 1, 1, 0, 1] // UVs for these corners
    }
};

function getHeight(wx, wz) {
    const continental = (noise.perlin2(wx / 1024, wz / 1024) + 1) / 2;
    const hills = (noise.perlin2(wx / 256, wz / 256) + 1) / 2;
    const detail = (noise.perlin2(wx / 64, wz / 64) + 1) / 2;
    const mountainRaw = (noise.perlin2(wx / 140, wz / 140) + 1) / 2;
    const mountain = Math.pow(mountainRaw, 3) * 100;
    const base = continental * 10;
    const hillHeight = hills * 40;
    const groundHeight = Math.max(1, Math.floor(base + (hillHeight * continental) + mountain + (detail * 8)));
    return groundHeight;
}

function computeTreeInfo(wx, wz) {
    const groundH = getHeight(wx, wz);
    if (groundH > 65 || (groundH <= waterLevel + 3 && groundH > waterLevel) || groundH <= waterLevel) return { has: false };
    const forestValue = (noise.perlin2(wx / 150, wz / 150) + 1) / 2;
    const placeNoise = (noise.perlin2(wx / 7, wz / 7) + 1) / 2;
    const threshold = forestValue > 0.6 ? 0.65 : 0.92;
    if (placeNoise <= threshold) return { has: false };
    const h = 4 + Math.floor(((noise.perlin2((wx + 1234) / 13, (wz + 1234) / 13) + 1) / 2) * 3);
    return { has: true, height: h, baseY: groundH };
}

function generateChunkData(cx, cz) {
    console.log(`[Worker] Gerando chunk ${cx},${cz}...`);

    const chunkData = new Uint8Array(chunkSize * chunkHeight * chunkSize).fill(blockTypes.air);
    const heightMap = {};

    const setBlock = (x, y, z, type) => {
        if (x < 0 || x >= chunkSize || y < 0 || y >= chunkHeight || z < 0 || z >= chunkSize) return;
        chunkData[y * chunkSize * chunkSize + x * chunkSize + z] = type;
    };

    const getBlock = (x, y, z) => {
        if (x < 0 || x >= chunkSize || y < 0 || y >= chunkHeight || z < 0 || z >= chunkSize) return blockTypes.air;
        return chunkData[y * chunkSize * chunkSize + x * chunkSize + z];
    };

    // Terreno
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            const wx = cx * chunkSize + x;
            const wz = cz * chunkSize + z;
            const groundHeight = getHeight(wx, wz);
            heightMap[`${x},${z}`] = groundHeight;
            for (let y = 0; y <= groundHeight; y++) {
                if (y === 0) { setBlock(x, y, z, blockTypes.bedrock); continue; }
                let blockType = (y === groundHeight)
                    ? (y > 65 ? blockTypes.snow : (y <= waterLevel + 3 && y > waterLevel ? blockTypes.sand : blockTypes.grass))
                    : (y >= groundHeight - 3 ? blockTypes.dirt : blockTypes.stone);
                setBlock(x, y, z, blockType);
            }
        }
    }

    // Água
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            const groundHeight = heightMap[`${x},${z}`];
            addWater(chunkData, x, z, groundHeight, getBlock, setBlock, chunkSize, chunkHeight);
        }
    }

    // Árvores
    for (let x = -2; x < chunkSize + 2; x++)
        for (let z = -2; z < chunkSize + 2; z++) {
            const wx = cx * chunkSize + x;
            const wz = cz * chunkSize + z;
            const info = computeTreeInfo(wx, wz);
            if (!info.has) continue;
            for (let i = 1; i <= info.height; i++) setBlock(x, info.baseY + i, z, blockTypes.trunk);
            const topY = info.baseY + info.height;
            const leafRadius = 2;
            for (let ly = -leafRadius; ly <= leafRadius; ly++)
                for (let lx = -leafRadius; lx <= leafRadius; lx++)
                    for (let lz = -leafRadius; lz <= leafRadius; lz++)
                        if (lx * lx + ly * ly + lz * lz <= (leafRadius * leafRadius) + 0.5)
                            if (getBlock(x + lx, topY + ly, z + lz) === blockTypes.air)
                                setBlock(x + lx, topY + ly, z + lz, blockTypes.leaf);
        }

    // Mesh
    const geometries = {};
    console.log('[Worker] Starting mesh generation loop.'); // Added
    for (let y = 0; y < chunkHeight; y++) {
        for (let x = 0; x < chunkSize; x++) {
            for (let z = 0; z < chunkSize; z++) {
                const blockType = getBlock(x, y, z);
                if (blockType === blockTypes.air) continue;

                if (blockType === blockTypes.grass) {
                    for (const faceName in faces) {
                        const face = faces[faceName];
                        const neighborType = getBlock(x + face.dir[0], y + face.dir[1], z + face.dir[2]);

                        const currentIsTransparent = transparentBlocks.has(blockType);
                        const neighborIsTransparent = transparentBlocks.has(neighborType);
                        let showFace = false;

                        if (currentIsTransparent !== neighborIsTransparent) {
                            showFace = true;
                        } else if (currentIsTransparent && neighborIsTransparent && blockType !== neighborType) {
                            showFace = true;
                        }

                        if (!showFace) continue;

                        let materialNameToUse = 'grass_side'; // Default for sides
                        if (faceName === 'up') {
                            materialNameToUse = 'grass_top';
                        }
                        else if (faceName === 'down') {
                            materialNameToUse = 'dirt';
                        }

                        if (!geometries[materialNameToUse]) geometries[materialNameToUse] = { positions: [], indices: [], uvs: [] };
                        const geo = geometries[materialNameToUse];
                        const baseIndex = geo.positions.length / 3;
                        for (const corner of face.corners) geo.positions.push(x + corner[0], y + corner[1], z + corner[2]);
                        geo.indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
                        geo.uvs.push(...face.uvs);
                    }
                } else if (blockType === blockTypes.water) {
                    if (y < chunkHeight - 1 && getBlock(x, y + 1, z) === blockTypes.air) {
                        if (!geometries[materialMap[blockType]]) geometries[materialMap[blockType]] = { positions: [], indices: [], uvs: [] };
                        const geo = geometries[materialMap[blockType]];
                        const baseIndex = geo.positions.length / 3;
                        const face = faces.up;
                        for (const corner of face.corners) geo.positions.push(x + corner[0], y + corner[1], z + corner[2]);
                        geo.indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
                        geo.uvs.push(...face.uvs);
                    }
                } else {
                    const materialName = materialMap[blockType];
                    if (!materialName) continue;

                    if (!geometries[materialName]) geometries[materialName] = { positions: [], indices: [], uvs: [] };
                    for (const faceName in faces) {
                        const face = faces[faceName];
                        const neighborType = getBlock(x + face.dir[0], y + face.dir[1], z + face.dir[2]);

                        const currentIsTransparent = transparentBlocks.has(blockType);
                        const neighborIsTransparent = transparentBlocks.has(neighborType);
                        let showFace = false;

                        if (currentIsTransparent !== neighborIsTransparent) {
                            showFace = true;
                        } else if (currentIsTransparent && neighborIsTransparent && blockType !== neighborType) {
                            showFace = true;
                        }

                        if (!showFace) continue;

                        const geo = geometries[materialName];
                        const baseIndex = geo.positions.length / 3;
                        for (const corner of face.corners) geo.positions.push(x + corner[0], y + corner[1], z + corner[2]);
                        geo.indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
                        geo.uvs.push(...face.uvs);
                    }
                }
            }
        }
    }
    console.log('[Worker] Geometries after mesh generation:', geometries); // Added

    // Preparar envio
    const finalGeometries = {};
    const transferable = [];
    for (const type in geometries) {
        const geo = geometries[type];
        if (geo.positions.length > 0 && geo.indices.length > 0) {
            const positions = new Float32Array(geo.positions);
            const vertexCount = positions.length / 3;
            let indices;

            let maxIndex = 0;
            for (let i = 0; i < geo.indices.length; i++) {
                if (geo.indices[i] > maxIndex) {
                    maxIndex = geo.indices[i];
                }
            }

            if (maxIndex < 65536) {
                indices = new Uint16Array(geo.indices);
            } else {
                indices = new Uint32Array(geo.indices);
            }

            if (maxIndex < vertexCount) {
                finalGeometries[type] = { positions, indices, uvs: new Float32Array(geo.uvs) };
                transferable.push(positions.buffer, indices.buffer, finalGeometries[type].uvs.buffer);
            }
        }
    }

    console.log('HeightMap before sending:', heightMap); // Added this line
    console.log(`[Worker] Chunk ${cx},${cz} enviado com`, Object.keys(finalGeometries).length, "materiais");
    console.log("Final Geometries:", finalGeometries);
    self.postMessage({ cx, cz, geometries: finalGeometries, heightMap, chunkData: chunkData.buffer, blockTypes: blockTypes }, transferable);
}

self.onmessage = function (event) {
    if (event.data.type === 'generate') {
        if (typeof event.data.seed !== 'undefined') noise.seed(event.data.seed);
        generateChunkData(event.data.cx, event.data.cz);
    }
};