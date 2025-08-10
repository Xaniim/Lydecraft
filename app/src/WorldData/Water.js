const waterLevel = 30;

function addWater(chunkData, x, z, groundHeight, getBlock, setBlock, chunkSize, chunkHeight) {
    if (groundHeight < waterLevel) {
        for (let y = groundHeight + 1; y <= waterLevel; y++) {
            if (getBlock(x, y, z) === 0 /* air */) {
                setBlock(x, y, z, 9 /* water */);
            }
        }
    }
}
