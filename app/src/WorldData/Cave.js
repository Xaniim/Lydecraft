export const caveNoiseScale = 48;
export const caveThreshold = 0.72;

export function carveCaves(chunkData, x, z, wx, wz, groundHeight, setBlock, noise, chunkSize, chunkHeight) {
    for (let y = 1; y < groundHeight - 5; y++) {
        const caveValue = Math.abs(noise.perlin3(wx / caveNoiseScale, y / caveNoiseScale, wz / caveNoiseScale));
        if (caveValue > caveThreshold) {
            setBlock(x, y, z, 0 /* air */);
        }
    }
}
