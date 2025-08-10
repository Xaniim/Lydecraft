export class VoxelCamera extends THREE.PerspectiveCamera {
    constructor() {
        super(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    }

    update(player) {
        this.position.copy(player.position);
        this.position.y += player.playerHeight - 0.2; // Lower camera slightly
        this.rotation.set(player.rotX, player.rotY, 0, 'YXZ');
    }
}
