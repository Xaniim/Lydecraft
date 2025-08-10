import { waterLevel } from '../Water.js';

// Helper function, since it's used by the main generator too
function computeTreeInfo(wx, wz, getHeight, noise) {
    const groundH = getHeight(wx, wz);
    const topIsSnow = groundH > 65;
    const topIsBeach = (groundH <= waterLevel + 3 && groundH > waterLevel);
    if (topIsSnow || topIsBeach || groundH <= waterLevel) return { has: false };

    const forestValue = (noise.perlin2(wx / 150, wz / 150) + 1) / 2;
    const placeNoise = (noise.perlin2(wx / 7, wz / 7) + 1) / 2;
    const threshold = forestValue > 0.6 ? 0.65 : 0.92;
    if (placeNoise <= threshold) return { has: false };

    const h = 4 + Math.floor(((noise.perlin2((wx + 1234) / 13, (wz + 1234) / 13) + 1) / 2) * 3);
    return { has: true, height: h, baseY: groundH };
}

// Main function to add trees to chunk data
export function addTrees(chunkData, cx, cz, lod, getBlock, setBlock, getHeight, noise, chunkSize, chunkHeight) {
    // We must check a slightly larger area to correctly place leaves on chunk borders
    for (let x = -2; x < chunkSize + 2; x++) {
        for (let z = -2; z < chunkSize + 2; z++) {
            const wx = cx * chunkSize + x;
            const wz = cz * chunkSize + z;
            const info = computeTreeInfo(wx, wz, getHeight, noise);
            if (!info.has) continue;

            const base = info.baseY;
            const th = info.height;
            const topY = base + th;

            // Place trunk
            for (let i = 1; i <= th; i++) {
                const by = base + i;
                setBlock(x, by, z, 6 /* trunk */);
            }

            // Place leaves
            const leafRadius = 2;
            for (let ly = -leafRadius; ly <= leafRadius; ly++) {
                for (let lx = -leafRadius; lx <= leafRadius; lx++) {
                    for (let lz = -leafRadius; lz <= leafRadius; lz++) {
                        if (lx * lx + ly * ly + lz * lz <= (leafRadius * leafRadius) + 0.5) {
                            const tx = x + lx;
                            const ty = topY + ly;
                            const tz = z + lz;
                            if (getBlock(tx, ty, tz) === 0 /* air */) {
                                setBlock(tx, ty, tz, 7 /* leaf */);
                            }
                        }
                    }
                }
            }
        }
    }
}
