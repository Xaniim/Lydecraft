

export class Chunk {
    constructor(scene, cx, cz, geometries, materials, globalUniforms) {
        this.scene = scene;
        this.cx = cx;
        this.cz = cz;
        this.group = new THREE.Group();
        this.group.position.set(cx * 16, 0, cz * 16);

        const generationTime = globalUniforms.u_time.value;

        // Adicione esta linha para depuração
        console.log(`Recebendo dados para o chunk ${cx},${cz}:`, geometries);

        for (const type in geometries) {
            const geoData = geometries[type];
            if (!geoData || !geoData.positions || geoData.positions.length === 0) {
                console.log(`Chunk ${cx},${cz}, tipo ${type}: Geometria vazia ou inválida, pulando.`);
                continue;
            }

            // --- DEPURACAO DETALHADA ---
            const numVertices = geoData.positions.length / 3;
            let maxIndex = 0;
            for (let i = 0; i < geoData.indices.length; i++) {
                if (geoData.indices[i] > maxIndex) {
                    maxIndex = geoData.indices[i];
                }
            }
            
            console.log(`Chunk ${cx},${cz}, tipo ${type}: Vértices=${numVertices}, Maior Índice=${maxIndex}`);

            // VERIFICAÇÃO CRÍTICA
            if (maxIndex >= numVertices) {
                console.error(`ERRO CRÍTICO NO CHUNK ${cx},${cz}, TIPO ${type}: Maior índice (${maxIndex}) é maior ou igual ao número de vértices (${numVertices}). ESTE É O PROBLEMA!`);
                // Não tente criar a geometria se ela for inválida.
                continue; 
            }
            // --- FIM DA DEPURACAO ---

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(geoData.positions, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(geoData.uvs, 2)); // Adicionado: Atributo UV para texturas
            geometry.setIndex(new THREE.BufferAttribute(geoData.indices, 1));
            geometry.computeVertexNormals();

            if (!materials[type]) {
                console.error(`Material do tipo "${type}" não encontrado!`);
                continue;
            }

            const material = materials[type].clone();
            material.u_time_generated = new THREE.Uniform(0);
            material.u_animation_duration = new THREE.Uniform(materials[type].u_animation_duration.value);

            material.onBeforeCompile = (shader) => {
                shader.uniforms.u_time = globalUniforms.u_time;
                shader.uniforms.u_time_generated = material.u_time_generated;
                shader.uniforms.u_animation_duration = material.u_animation_duration;

                shader.vertexShader = 'uniform float u_time;\nuniform float u_time_generated;\nuniform float u_animation_duration;\n' + shader.vertexShader;
                shader.vertexShader = shader.vertexShader.replace( '#include <begin_vertex>', ` #include <begin_vertex> float time_elapsed = u_time - u_time_generated; float anim_progress = smoothstep(0.0, u_animation_duration, time_elapsed); transformed.y += (1.0 - anim_progress) * -20.0; ` );
            };
            material.u_time_generated.value = generationTime;

            const mesh = new THREE.Mesh(geometry, material);
            this.group.add(mesh);
        }

        this.scene.add(this.group);
    }

    dispose() {
        this.scene.remove(this.group);
        this.group.children.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
    }
}
