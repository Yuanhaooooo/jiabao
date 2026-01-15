
import React from 'react';
import * as THREE from 'three';
import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

const Effects: React.FC = () => {
  return (
    <EffectComposer>
      <Bloom 
        intensity={1.5} 
        luminanceThreshold={0.2} 
        luminanceSmoothing={0.9} 
        mipmapBlur 
      />
      <Noise opacity={0.05} />
      <Vignette eskil={false} offset={0.1} darkness={1.1} />
      <ChromaticAberration 
        blendFunction={BlendFunction.NORMAL} 
        offset={new THREE.Vector2(0.0005, 0.0005)} 
      />
    </EffectComposer>
  );
};

export default Effects;
