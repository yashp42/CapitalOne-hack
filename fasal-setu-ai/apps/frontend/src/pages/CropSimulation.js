import React, { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import { cropAPI, authAPI, cropSimChatAPI, chatbotAPI } from '../services/api'; // Import API service
import { useAuth } from '../contexts/AuthContext'; // Import auth context
import SpeechToText from '../components/SpeechToText';
import TextToSpeech from '../components/TextToSpeech';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { 
  FaTemperatureHigh, 
  FaCloudRain, 
  FaSeedling, 
  FaTint, 
  FaCalendarAlt,
  FaChartLine,
  FaCloud,
  FaSun,
  FaBolt,
  FaRobot,
  FaPaperPlane,
  FaBug,
} from 'react-icons/fa';

// Loading Skeleton Component
const LoadingSkeleton = ({ className = "", height = "h-4" }) => (
  <div className={`animate-pulse bg-gray-300 rounded ${height} ${className}`}></div>
);

// Skeleton for metric cards
const MetricCardSkeleton = () => (
  <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl p-4 text-center animate-pulse">
    <div className="w-8 h-8 bg-gray-300 rounded-full mx-auto mb-2"></div>
    <LoadingSkeleton className="w-16 h-3 mx-auto mb-2" />
    <LoadingSkeleton className="w-12 h-5 mx-auto" />
  </div>
);

// Skeleton for harvest information
const HarvestInfoSkeleton = () => (
  <div className="space-y-4">
    <LoadingSkeleton className="w-32 h-5" />
    <div className="space-y-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-gray-300 rounded"></div>
              <LoadingSkeleton className="w-24 h-3" />
            </div>
            <LoadingSkeleton className="w-16 h-3" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Full page loading component
const LoadingScreen = () => (
  <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-yellow-50 pt-24 pb-8 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
      <p className="text-gray-600">Authenticating...</p>
    </div>
  </div>
);

// 3D Crop Plant Component - Optimized for performance
function CropPlant({ stage, farmData }) {
  // Field dimensions constants - defined at component level
  const fieldWidth = 40; // Reduced from 80
  const fieldDepth = 30; // Reduced from 60
  const maxGrassHeight = 2.0; // Slightly reduced
  const maxGrassWidth = 0.12;

  // Create stable positions for all random elements
  const [stablePositions] = useState(() => {
    const seededRandom = (seed) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };

    return {
      seeds: Array.from({ length: 80 }, (_, i) => [
        (seededRandom(i * 3.1) - 0.5) * fieldWidth * 0.8,
        -0.05,
        (seededRandom(i * 7.2) - 0.5) * fieldDepth * 0.8
      ]),
      sprouts: Array.from({ length: 120 }, (_, i) => [
        (seededRandom(i * 5.4) - 0.5) * fieldWidth * 0.9,
        0, // Will be calculated based on stage
        (seededRandom(i * 9.7) - 0.5) * fieldDepth * 0.9
      ]),
      heatEffects: Array.from({ length: 8 }, (_, i) => [
        (seededRandom(i * 11.3) - 0.5) * fieldWidth,
        0, // Will be calculated based on maxGrassHeight
        (seededRandom(i * 13.8) - 0.5) * fieldDepth
      ]),
      growthParticles: Array.from({ length: 12 }, (_, i) => [
        (seededRandom(i * 17.2) - 0.5) * fieldWidth,
        0, // Will be calculated based on maxGrassHeight
        (seededRandom(i * 19.5) - 0.5) * fieldDepth
      ])
    };
  });
  const grassFieldRef = useRef();
  const grassBlades = useRef([]);
  const [soilTextureReady, setSoilTextureReady] = useState(false);
  
  // Stable seed positions - only generated once
  const [seedPositions] = useState(() => {
    return Array.from({ length: 80 }, (_, i) => ({
      x: (Math.sin(i * 12.3456) * 0.5) * fieldWidth * 0.8,
      z: (Math.cos(i * 23.4567) * 0.5) * fieldDepth * 0.8,
      y: -0.05
    }));
  });

  // Stable sprout positions - only generated once  
  const [sproutPositions] = useState(() => {
    return Array.from({ length: 120 }, (_, i) => ({ // Max sprouts for stage 15
      x: (Math.sin(i * 34.5678) * 0.5) * fieldWidth * 0.9,
      z: (Math.cos(i * 45.6789) * 0.5) * fieldDepth * 0.9,
      y: 0.01
    }));
  });

  // Stable moisture particle positions - only generated once
  const [moistureParticlePositions] = useState(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      x: (Math.sin(i * 56.7890) * 0.5) * 50, // fieldWidth
      z: (Math.cos(i * 67.8901) * 0.5) * 50, // fieldDepth
      y: -0.05 + (Math.sin(i * 78.9012) * 0.1)
    }));
  });

  // Stable fertilizer particle positions - only generated once
  const [fertilizerParticlePositions] = useState(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      x: (Math.sin(i * 89.0123) * 0.5) * 50, // fieldWidth
      z: (Math.cos(i * 90.1234) * 0.5) * 50, // fieldDepth
      y: 0.05 + (Math.sin(i * 12.3456) * 0.1)
    }));
  });

  // Always load soil texture - this is safe to call unconditionally
  const soilTexture = useLoader(TextureLoader, '/assets/soil-texture.jpg');

  // Create separate texture instances for each soil layer to prevent UV distortion
  const soilTextures = useMemo(() => {
    if (!soilTexture) {
      return [];
    }
    
    const textures = [];
    const layerConfigs = [
      { repeat: [2, 2] },      // Main layer
      { repeat: [2.5, 2.5] },  // Secondary layer  
      { repeat: [3, 3] },      // Extended layer
      { repeat: [3.5, 3.5] },  // Fourth layer
      { repeat: [4, 4] }       // Fifth layer
    ];
    
    layerConfigs.forEach((config, index) => {
      // Create a completely independent texture clone
      const texture = soilTexture.clone();
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(config.repeat[0], config.repeat[1]);
      texture.offset.set(0, 0);
      texture.needsUpdate = true;
      
      textures.push(texture);
    });
    
    return textures;
  }, [soilTexture]);

  // Configure texture properties and mark as ready when loaded
  useEffect(() => {
    if (soilTexture) {
      // Configure main texture properties
      soilTexture.wrapS = soilTexture.wrapT = THREE.RepeatWrapping;
      soilTexture.repeat.set(2, 2);
      soilTexture.offset.set(0, 0);
      
      // Mark texture as ready immediately since useLoader ensures it's loaded
      setSoilTextureReady(true);
      console.log('Soil texture configured and ready');
    }

    // Cleanup function to dispose of cloned textures
    return () => {
      soilTextures.forEach(texture => {
        if (texture && texture.dispose) {
          texture.dispose();
        }
      });
    };
  }, [soilTexture, soilTextures]);  // Reduced animation frequency for better performance
  useFrame((state) => {
    // Simpler wind animation - only every 20 seconds instead of 10
    const windCycle = Math.sin(state.clock.elapsedTime * 0.05) * 0.5; // 20-second cycle
    const windStrength = (farmData.forecast[0]?.condition === 'Windy') ? 0.4 : 0.2; // Reduced strength
    
    // Simplified grass blade movement - only update every few frames for performance
    if (Math.floor(state.clock.elapsedTime * 60) % 3 === 0) { // Update every 3rd frame
      grassBlades.current.forEach((blade, i) => {
        if (blade && i % 2 === 0) { // Only animate every other blade for performance
          const windGust = Math.sin(state.clock.elapsedTime * 0.3 + i * 0.1) * windStrength * windCycle;
          const naturalSway = Math.sin(state.clock.elapsedTime * 0.2 + i * 0.05) * 0.04; // Reduced movement
          
          blade.rotation.z = windGust + naturalSway;
        }
      });
    }
  });

  // Generate fewer grass positions for better performance - STABLE POSITIONS
  const grassPositions = useMemo(() => {
    const positions = [];
    const seededRandom = (seed) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    
    // Reduced grass count from 1800 to 800 for better mobile performance
    for (let i = 0; i < 800; i++) {
      const x = (seededRandom(i * 2.1) - 0.5) * fieldWidth;
      const z = (seededRandom(i * 5.3) - 0.5) * fieldDepth;
      const baseHeight = maxGrassHeight * (0.6 + seededRandom(i * 11.2) * 0.4);
      const baseThickness = Math.max(0.04, maxGrassWidth * (0.7 + seededRandom(i * 13.4) * 0.3));
      
      positions.push({ x, z, baseHeight, baseThickness, id: i });
    }
    return positions;
  }, []); // Empty dependency array ensures this only runs once

  // Memoize grass colors to prevent recalculation on farmData changes
  const stableGrassColors = useMemo(() => {
    const colors = [];
    for (let i = 0; i < 800; i++) {
      // Use stable, default values for grass color calculation
      const moistureValue = 60; // Fixed moisture value
      const nitrogenValue = 70; // Fixed nitrogen value
      
      const grassColorOptions = [
        `hsl(${85 + Math.sin(i) * 10}, ${50 + nitrogenValue / 3}%, ${25 + moistureValue / 8}%)`,
        `hsl(${95 + Math.sin(i * 0.7) * 15}, ${55 + nitrogenValue / 4}%, ${30 + moistureValue / 6}%)`,
        `hsl(${78 + Math.sin(i * 1.2) * 12}, ${45 + nitrogenValue / 5}%, ${22 + moistureValue / 10}%)`
      ];
      
      colors.push(grassColorOptions[i % 3]);
    }
    return colors;
  }, []); // Empty dependency array ensures this only runs once

  // Calculate current visible grass based on growth stage
  const visibleGrassCount = Math.floor((stage / 100) * 800); // Reduced from 1800
  const currentGrassPositions = grassPositions.slice(0, visibleGrassCount);

  return (
    <group ref={grassFieldRef} position={[0, -2, 0]}>
      {/* Show subtle loading indicator while soil texture loads */}
      {!soilTextureReady && (
        <Text 
          position={[0, 2, 0]} 
          fontSize={0.3} 
          color="#8B7355"
          anchorX="center"
          anchorY="middle"
        >
          Preparing soil...
        </Text>
      )}
      
      {/* Realistic Soil Base - covers entire field with texture */}
      <group>
        {/* Main soil layer with realistic texture */}
        <Box args={[fieldWidth, 1, fieldDepth]} position={[0, -0.5, 0]}>
          <meshStandardMaterial 
            map={soilTextures[0] || soilTexture}
            color={"#D2B48C"} // Sandy brown tint with texture
            roughness={0.95}
            metalness={0.05}
          />
        </Box>
        
        {/* Secondary soil layer for depth with darker texture */}
        <Box args={[fieldWidth + 10, 0.3, fieldDepth + 8]} position={[0, -0.85, 0]}>
          <meshStandardMaterial 
            map={soilTextures[1] || soilTexture}
            color={"#B8906B"} // Darker sandy brown
            roughness={0.98}
            metalness={0.02}
          />
        </Box>

        {/* Extended soil border for seamless appearance */}
        <Box args={[fieldWidth + 20, 0.2, fieldDepth + 16]} position={[0, -1.1, 0]}>
          <meshStandardMaterial 
            map={soilTextures[2] || soilTexture}
            color={"#A0824B"} // Even darker sandy brown
            roughness={0.99}
            metalness={0.01}
          />
        </Box>

        {/* Fourth soil layer for massive field coverage */}
        <Box args={[fieldWidth + 30, 0.15, fieldDepth + 24]} position={[0, -1.3, 0]}>
          <meshStandardMaterial 
            map={soilTextures[3] || soilTexture}
            color={"#8B7355"} // Deep brown soil
            roughness={0.99}
            metalness={0.01}
          />
        </Box>

        {/* Fifth soil layer for ultra-massive coverage */}
        <Box args={[fieldWidth + 40, 0.1, fieldDepth + 32]} position={[0, -1.45, 0]}>
          <meshStandardMaterial 
            map={soilTextures[4] || soilTexture}
            color={"#6B5A3D"} // Deepest soil foundation
            roughness={0.99}
            metalness={0.01}
          />
        </Box>

        {/* Soil moisture indicators with stable positions */}
        {farmData.soilMoisture !== null && farmData.soilMoisture > 70 && moistureParticlePositions.map((particle, i) => (
          <Sphere 
            key={`moisture-${i}`}
            args={[0.015]} 
            position={[particle.x, particle.y, particle.z]}
          >
            <meshStandardMaterial 
              color="#4A90E2" 
              transparent 
              opacity={0.6}
              emissive="#4A90E2"
              emissiveIntensity={0.2}
            />
          </Sphere>
        ))}

        {/* Fertilizer particles with stable positions if recently fertilized */}
        {farmData.lastFertilized === 'Today' && fertilizerParticlePositions.map((particle, i) => (
          <Sphere 
            key={`fertilizer-${i}`}
            args={[0.01]} 
            position={[particle.x, particle.y, particle.z]}
          >
            <meshStandardMaterial 
              color="#E6E6FA" 
              transparent 
              opacity={0.7}
            />
          </Sphere>
        ))}
      </group>

      {/* Grass Field - starts with nothing, grows to full field */}
      {stage > 1 && (
        <group>
          {currentGrassPositions.map((grass, i) => {
            // Calculate current size based on growth stage (positions stay the same)
            const currentHeight = (stage / 100) * grass.baseHeight;
            const currentThickness = (stage / 100) * grass.baseThickness;
            
            // Use stable grass color to prevent re-rendering on farmData changes
            const grassColor = stableGrassColors[grass.id];
            
            return (
              <group key={`grass-${grass.id}`} position={[grass.x, 0, grass.z]}>
                {/* Main grass blade - realistic shape (fat bottom, pointy top) */}
                <group ref={(el) => (grassBlades.current[i] = el)}>
                  {/* Bottom section - thickest part */}
                  <Box
                    args={[currentThickness, currentHeight * 0.3, currentThickness * 0.9]}
                    position={[0, currentHeight * 0.15, 0]}
                  >
                    <meshStandardMaterial 
                      color={grassColor}
                      transparent
                      opacity={0.95}
                      roughness={0.7}
                    />
                  </Box>
                  
                  {/* Middle section - medium thickness */}
                  <Box
                    args={[currentThickness * 0.75, currentHeight * 0.4, currentThickness * 0.7]}
                    position={[0, currentHeight * 0.5, 0]}
                  >
                    <meshStandardMaterial 
                      color={grassColor}
                      transparent
                      opacity={0.9}
                      roughness={0.75}
                    />
                  </Box>
                  
                  {/* Top section - pointy tip */}
                  <Box
                    args={[currentThickness * 0.4, currentHeight * 0.3, currentThickness * 0.4]}
                    position={[0, currentHeight * 0.85, 0]}
                  >
                    <meshStandardMaterial 
                      color="hsl(88, 70%, 42%)"
                      transparent
                      opacity={0.85}
                      roughness={0.8}
                    />
                  </Box>
                </group>
                
                {/* Secondary grass blade for fuller look - also realistic shape */}
                <group rotation={[0, (grass.id * 0.1) % (Math.PI * 2), (grass.id * 0.05) % 0.2]}>
                  {/* Bottom part of secondary blade */}
                  <Box
                    args={[currentThickness * 0.7, currentHeight * 0.6, currentThickness * 0.6]}
                    position={[
                      Math.sin(grass.id * 0.5) * 0.03, 
                      currentHeight * 0.3, 
                      Math.cos(grass.id * 0.5) * 0.03
                    ]}
                  >
                    <meshStandardMaterial 
                      color={grassColor}
                      transparent
                      opacity={0.8}
                      roughness={0.75}
                    />
                  </Box>
                  
                  {/* Top part of secondary blade - pointy */}
                  <Box
                    args={[currentThickness * 0.35, currentHeight * 0.3, currentThickness * 0.35]}
                    position={[
                      Math.sin(grass.id * 0.5) * 0.04, 
                      currentHeight * 0.75, 
                      Math.cos(grass.id * 0.5) * 0.04
                    ]}
                  >
                    <meshStandardMaterial 
                      color={`hsl(${92}, 65%, 38%)`}
                      transparent
                      opacity={0.75}
                    />
                  </Box>
                </group>
                
                {/* Additional shoots for very dense areas - realistic tapered shape */}
                {stage > 25 && grass.id % 3 === 0 && (
                  <group rotation={[0, (grass.id * 0.3) % (Math.PI * 2), (grass.id * 0.02) % 0.2]}>
                    {/* Base of additional shoot */}
                    <Box
                      args={[currentThickness * 0.55, currentHeight * 0.5, currentThickness * 0.4]}
                      position={[
                        Math.sin(grass.id * 2.5) * 0.06, 
                        currentHeight * 0.25, 
                        Math.cos(grass.id * 2.5) * 0.06
                      ]}
                    >
                      <meshStandardMaterial 
                        color={`hsl(${90}, 70%, 40%)`}
                        transparent
                        opacity={0.8}
                      />
                    </Box>
                    
                    {/* Tip of additional shoot */}
                    <Box
                      args={[currentThickness * 0.25, currentHeight * 0.2, currentThickness * 0.25]}
                      position={[
                        Math.sin(grass.id * 2.5) * 0.08, 
                        currentHeight * 0.6, 
                        Math.cos(grass.id * 2.5) * 0.08
                      ]}
                    >
                      <meshStandardMaterial 
                        color={`hsl(${95}, 75%, 45%)`}
                        transparent
                        opacity={0.7}
                      />
                    </Box>
                  </group>
                )}
                
                {/* Micro grass for extra density - ultra-fine tips */}
                {stage > 40 && grass.id % 2 === 0 && (
                  <group rotation={[0, (grass.id * 0.7) % (Math.PI * 2), (grass.id * 0.03) % 0.15]}>
                    {/* Base of micro grass */}
                    <Box
                      args={[currentThickness * 0.35, currentHeight * 0.4, currentThickness * 0.3]}
                      position={[
                        Math.sin(grass.id * 3.7) * 0.05, 
                        currentHeight * 0.2, 
                        Math.cos(grass.id * 3.7) * 0.05
                      ]}
                    >
                      <meshStandardMaterial 
                        color={`hsl(${88 + Math.sin(grass.id * 2) * 20}, 75%, 43%)`}
                        transparent
                        opacity={0.75}
                      />
                    </Box>
                    
                    {/* Ultra-fine tip */}
                    <Box
                      args={[currentThickness * 0.15, currentHeight * 0.1, currentThickness * 0.15]}
                      position={[
                        Math.sin(grass.id * 3.7) * 0.06, 
                        currentHeight * 0.45, 
                        Math.cos(grass.id * 3.7) * 0.06
                      ]}
                    >
                      <meshStandardMaterial 
                        color={`hsl(${93}, 80%, 50%)`}
                        transparent
                        opacity={0.6}
                      />
                    </Box>
                  </group>
                )}
              </group>
            );
          })}
        </group>
      )}

      {/* Seed stage indicators - more seeds */}
      {stage <= 5 && stage > 0 && (
        <group>
          {stablePositions.seeds.map((position, i) => ( // Use stable positions
            <Sphere 
              key={`seed-${i}`}
              args={[0.025]} // Slightly larger seeds
              position={position}
            >
              <meshStandardMaterial 
                color="#8B4513" 
                roughness={0.9}
              />
            </Sphere>
          ))}
        </group>
      )}

      {/* Early sprouts - increased density */}
      {stage > 5 && stage <= 15 && (
        <group>
          {stablePositions.sprouts.slice(0, Math.floor(stage * 8)).map((position, i) => ( // Use stable positions, slice based on stage
            <Box
              key={`sprout-${i}`}
              args={[0.02, stage * 0.02, 0.015]} // Made sprouts thicker
              position={[
                position[0], // Use stable x position
                stage * 0.01, // Only y position changes with stage
                position[2]   // Use stable z position
              ]}
            >
              <meshStandardMaterial 
                color="#90EE90"
                transparent
                opacity={0.8}
              />
            </Box>
          ))}
        </group>
      )}

      {/* Environmental effects */}
      {farmData.currentTemp > 35 && (
        <group>
          {/* Heat stress effect */}
          {stablePositions.heatEffects.map((position, i) => (
            <Sphere key={`heat-${i}`} args={[0.02]} position={[
              position[0], // Use stable x position
              maxGrassHeight + 0.25, // Use fixed y position instead of random
              position[2]  // Use stable z position
            ]}>
              <meshStandardMaterial 
                color="#FF6B35" 
                emissive="#FF4500"
                emissiveIntensity={0.6}
                transparent
                opacity={0.4}
              />
            </Sphere>
          ))}
        </group>
      )}

      {/* Growth particles during active growth */}
      {stage > 10 && stage < 95 && (
        <group>
          {stablePositions.growthParticles.map((position, i) => (
            <Sphere key={`growth-${i}`} args={[0.015]} position={[
              position[0], // Use stable x position
              maxGrassHeight * 0.5 + 0.5, // Use fixed y position instead of random
              position[2]  // Use stable z position
            ]}>
              <meshStandardMaterial 
                color="#98FB98" 
                emissive="#98FB98"
                emissiveIntensity={0.4}
                transparent
                opacity={0.6}
              />
            </Sphere>
          ))}
        </group>
      )}
    </group>
  );
}

// 3D Scene Component with better lighting and environment
function CropScene({ stage, farmData }) {
  return (
    <>
      {/* Dynamic lighting based on time and weather */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 15, 5]} 
        intensity={farmData.weatherToday === 'Sunny' ? 1.2 : 0.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      
      {/* Additional lighting for realism */}
      <pointLight 
        position={[-5, 10, -5]} 
        intensity={0.3} 
        color="#FFE4B5" 
      />
      
      {/* Simulated sun position */}
      <directionalLight
        position={[0, 20, 0]}
        intensity={0.2}
        color="#FFF8DC"
      />
      
      <CropPlant stage={stage} farmData={farmData} />
      
      <OrbitControls 
        enablePan={false} 
        enableZoom={false} // Completely disabled zoom
        enableRotate={true}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 3} // Restrict vertical movement more
        autoRotate={false}
        dampingFactor={0.05}
        maxAzimuthAngle={Math.PI / 4.5} // Restrict horizontal rotation to ~40 degrees
        minAzimuthAngle={-Math.PI / 4.5} // Restrict horizontal rotation to ~-40 degrees
        target={[0, 0, 0]} // Keep focus on center of field
      />
      
      {/* Dynamic lighting based on weather data */}
      <ambientLight 
        intensity={
          farmData.weatherToday === 'Sunny' ? 0.6 :
          farmData.weatherToday === 'Cloudy' ? 0.4 :
          farmData.weatherToday === 'Rainy' ? 0.3 : 0.5
        } 
      />
      <directionalLight
        position={[10, 10, 5]}
        intensity={
          farmData.weatherToday === 'Sunny' ? 1.2 :
          farmData.weatherToday === 'Cloudy' ? 0.8 :
          farmData.weatherToday === 'Rainy' ? 0.5 : 1.0
        }
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[-10, 10, -10]} intensity={0.3} />
      
      {/* Dynamic sky background based on weather data */}
      <color 
        attach="background" 
        args={[
          farmData.weatherToday === 'Sunny' ? '#87CEEB' :    // Sky blue
          farmData.weatherToday === 'Cloudy' ? '#B0C4DE' :   // Light steel blue
          farmData.weatherToday === 'Rainy' ? '#708090' :    // Slate gray
          '#87CEEB'  // Default sky blue
        ]} 
      />
    </>
  );
}

const CropSimulation = () => {
  // Authentication check
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  
  // Get crop ID from URL parameters
  const { cropId } = useParams();
  
  // Get initial growth percentage from URL search params (if provided)
  const urlParams = new URLSearchParams(window.location.search);
  const initialGrowthPercent = parseInt(urlParams.get('growth')) || 0;

  // Optimized reduced animation variants for better mobile performance
  const reducedMotionVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  }), []);

  const fastTransition = useMemo(() => ({ duration: 0.2 }), []);
  const mediumTransition = useMemo(() => ({ duration: 0.3 }), []);
  
  // Debug: Log the received parameters
  useEffect(() => {

  }, [cropId, initialGrowthPercent]);
  
  // Real crop simulation state - grows based on user interactions
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [cropStage, setCropStage] = useState(initialGrowthPercent); // Set from URL parameter or default to 0
  const [daysSincePlanting, setDaysSincePlanting] = useState(0);
  const [lastActivity, setLastActivity] = useState(null);
  const [harvestData, setHarvestData] = useState(null); // New state for harvest estimation
  const [isLoadingHarvest, setIsLoadingHarvest] = useState(false); // Loading state
  const [weatherData, setWeatherData] = useState(null); // Weather data from API
  const [isLoadingWeather, setIsLoadingWeather] = useState(false); // Weather loading state
  const [weatherError, setWeatherError] = useState(null); // Weather error state
  const [chatMessages, setChatMessages] = useState([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState({}); // Track recently updated fields
  const [growthUpdated, setGrowthUpdated] = useState(false); // Track when growth is updated
  // Crop simulation is always in 'my_farm' mode since it works with specific crop data
  const chatMode = 'my_farm';
  const [userProfile, setUserProfile] = useState(null); // Store user profile for personalization
  const welcomeMessageAdded = useRef(false); // Track if welcome message has been added

  // Add welcome message when component loads (only once)
  useEffect(() => {
    if (cropId && harvestData && !welcomeMessageAdded.current) {
      const welcomeMessage = {
        id: Date.now(), // Use timestamp for unique ID
        text: `Hi! I'm here to help with your ${harvestData.crop_name || 'crop'} farming. Ask me anything!`,
        isBot: true,
        timestamp: new Date()
      };
      

      setChatMessages([welcomeMessage]);
      welcomeMessageAdded.current = true;
    }
  }, [cropId, harvestData, cropStage]); // Removed chatMode dependency
  const [newMessage, setNewMessage] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [dailyActivities, setDailyActivities] = useState([]);
  const [currentCrop, setCurrentCrop] = useState(null); // Store full crop data for next event display
  const [quickActionsExpanded, setQuickActionsExpanded] = useState(true); // Control quick actions collapse
  const messagesEndRef = useRef(null); // For auto-scroll functionality
  const chatContainerRef = useRef(null); // Reference to chat container

  // Auto-scroll functionality - scroll only the chat container, not the whole page
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current && messagesEndRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, scrollToBottom]);

  // Also scroll when typing indicator appears/disappears
  useEffect(() => {
    if (isChatTyping) {
      // Small delay to allow the typing indicator to render before scrolling
      setTimeout(scrollToBottom, 100);
    }
  }, [isChatTyping, scrollToBottom]);

  // Custom markdown components for crop simulation chat
  const cropMarkdownComponents = {
    // Headings - consistent readable sizes for chat context
    h1: ({ children }) => <h1 className="text-sm font-bold text-gray-900 mb-1">{children}</h1>,
    h2: ({ children }) => <h2 className="text-sm font-semibold text-gray-900 mb-1">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-medium text-gray-800 mb-1">{children}</h3>,
    
    // Paragraphs - consistent base size for chat
    p: ({ children }) => <p className="text-sm mb-1 leading-tight">{children}</p>,
    
    // Lists - same size as paragraphs for consistency
    ul: ({ children }) => <ul className="list-disc list-inside mb-1 space-y-0.5 text-sm">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal list-inside mb-1 space-y-0.5 text-sm">{children}</ol>,
    li: ({ children }) => <li className="text-sm leading-tight">{children}</li>,
    
    // Strong/Bold - using primary colors, same size
    strong: ({ children }) => <strong className="font-bold text-primary-700 text-sm">{children}</strong>,
    
    // Tables - readable size for mobile chat
    table: ({ children }) => (
      <table className="w-full border-collapse border border-gray-300 mb-1 text-sm">
        {children}
      </table>
    ),
    thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr className="border-b">{children}</tr>,
    th: ({ children }) => (
      <th className="border border-gray-300 px-2 py-1 text-left font-semibold text-sm">{children}</th>
    ),
    td: ({ children }) => <td className="border border-gray-300 px-2 py-1 text-sm">{children}</td>,
    
    // Blockquotes - for warnings/tips, same size
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-orange-400 bg-orange-50 pl-2 py-1 mb-1 text-sm">
        {children}
      </blockquote>
    ),
    
    // Code - inline code formatting, same size
    code: ({ children }) => (
      <code className="bg-gray-100 px-1 rounded text-sm font-mono">{children}</code>
    ),
  };

  // Farm data state - will be populated by LLM integration
  const [farmData, setFarmData] = useState({
    lastIrrigated: 'Loading...',
    lastFertilized: 'Loading...',
    lastPestCheck: 'Loading...',
    lastSowed: null,
    currentTemp: null,
    soilTemp: null,
    humidity: null,
    soilMoisture: null,
    cropStage: null,
    expectedHarvest: null,
    weatherToday: null,
    forecast: [],
    nutrients: {
      nitrogen: null,
      phosphorus: null,
      potassium: null
    },
    pests: {
      detected: null,
      risk: null,
      lastChecked: null
    },
    irrigation: {
      nextScheduled: null,
      totalWaterUsed: null,
      efficiency: null
    }
  });

  // Growth simulation will be handled by LLM integration
  const simulateCropGrowth = useCallback((activity) => {
    // This will be replaced with LLM-powered growth simulation

    return 0; // Placeholder return value
  }, []);

  // Optimized animation variants for better performance
  const containerVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05, // Reduced from 0.1
        delayChildren: 0.1 // Reduced from 0.2
      }
    }
  }), []);

  const itemVariants = useMemo(() => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3, // Reduced from 0.6
        ease: "easeOut"
      }
    }
  }), []);

  // WMO Weather code mapping
  const WMO = {
    0: { label: "Sunny", icon: "sun" },
    1: { label: "Sunny", icon: "sun" },
    2: { label: "Cloudy", icon: "cloud" },
    3: { label: "Cloudy", icon: "cloud" },
    45: { label: "Fog", icon: "fog" },
    48: { label: "Fog", icon: "fog" },
    51: { label: "Drizzle", icon: "rain" },
    53: { label: "Drizzle", icon: "rain" },
    55: { label: "Drizzle", icon: "rain" },
    61: { label: "Rainy", icon: "rain" },
    63: { label: "Rainy", icon: "rain" },
    65: { label: "Heavy Rain", icon: "rain" },
    80: { label: "Showers", icon: "rain" },
    81: { label: "Showers", icon: "rain" },
    82: { label: "Heavy Showers", icon: "rain" },
    95: { label: "Thunderstorm", icon: "storm" },
    96: { label: "Thunder + Hail", icon: "storm" },
    99: { label: "Thunder + Hail", icon: "storm" }
  };

  // Function to get icon component from icon string
  const getIconComponent = (iconType) => {
    switch (iconType) {
      case 'sun': return FaSun;
      case 'cloud': return FaCloud;
      case 'rain': return FaCloudRain;
      case 'storm': return FaBolt;
      case 'fog': return FaCloud;
      default: return FaSun;
    }
  };

  // Function to fetch weather data
  const fetchWeatherData = async (lat, lon) => {
    setIsLoadingWeather(true);
    setWeatherError(null);
    
    try {
      // Fetch weather forecast data (daily)
      const responseWeather = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,wind_speed_10m_max,precipitation_sum&forecast_days=5&timezone=auto&temperature_unit=celsius&windspeed_unit=kmh`
      );
      
      if (!responseWeather.ok) {
        throw new Error('Weather forecast fetch failed');
      }
      
      const weatherData = await responseWeather.json();
      
      // Fetch soil data (hourly)
      const responseSoil = await fetch(
        `https://api.open-meteo.com/v1/ecmwf?latitude=${lat}&longitude=${lon}&hourly=soil_moisture_0_to_7cm,soil_temperature_0cm&forecast_days=5&timezone=auto`
      );
      
      if (!responseSoil.ok) {
        throw new Error('Soil data fetch failed');
      }
      
      const soilData = await responseSoil.json();
      
      // Merge weather and soil data
      const mergedData = {
        daily: weatherData.daily,
        hourly: soilData.hourly,
        timezone: weatherData.timezone
      };
      
      setWeatherData(mergedData);
    } catch (error) {
      console.error('Weather/Soil data fetch error:', error);
      setWeatherError('Failed to load weather and soil data');
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // Process weather data for display
  const processWeatherData = (data) => {
    if (!data || !data.daily) return [];
    
    const { daily } = data;
    const forecast = [];
    
    for (let i = 0; i < 5; i++) {
      const date = new Date(daily.time[i]);
      const wmoCode = daily.weathercode[i];
      const tempC = Math.round(daily.temperature_2m_max[i]);
      const windSpeed = daily.wind_speed_10m_max[i];
      
      // Get label based on index
      let label;
      if (i === 0) label = 'Today';
      else if (i === 1) label = 'Tomorrow';
      else label = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      // Get weather info from WMO code
      const weather = WMO[wmoCode] || { label: 'Unknown', icon: 'sun' };
      let condition = weather.label;
      
      // Override with windy if wind speed >= 30 km/h
      if (windSpeed >= 30) {
        condition = 'Windy';
      }
      
      forecast.push({
        day: label,
        icon: getIconComponent(weather.icon),
        temp: tempC,
        condition: condition
      });
    }
    
    return forecast;
  };

  // Fetch harvest estimation data
  useEffect(() => {
    const fetchCropData = async () => {
      if (!cropId) return;
      
      setIsLoadingHarvest(true);
      try {
        // Fetch both harvest estimate and crop details
        const [harvestResponse, cropResponse] = await Promise.all([
          cropAPI.getHarvestEstimate(cropId),
          cropAPI.getCropDetails(cropId)
        ]);

        if (harvestResponse.success) {
          setHarvestData(harvestResponse.data);
          // Update days since planting from API data
          setDaysSincePlanting(harvestResponse.data.days_since_sowing);
          // Only update crop stage from API if URL parameter wasn't provided
          if (!urlParams.get('growth')) {
            setCropStage(harvestResponse.data.growth_percentage);
          }

        }

        // Update farm data with actual crop irrigation/fertilization dates
        if (cropResponse.success && cropResponse.data.derived) {
          const crop = cropResponse.data;
          setCurrentCrop(crop); // Store full crop data
          setFarmData(prev => ({
            ...prev,
            lastIrrigated: crop.derived.last_irrigation_at ? 
              new Date(crop.derived.last_irrigation_at).toLocaleDateString() : 'Never',
            lastFertilized: crop.derived.last_fertilization_at ? 
              new Date(crop.derived.last_fertilization_at).toLocaleDateString() : 'Never',
            lastPestCheck: crop.derived.last_pest_check_at ?
              new Date(crop.derived.last_pest_check_at).toLocaleDateString() : 'Never'
          }));

        } else {
          // Set default values if crop data not available
          setCurrentCrop(null);
          setFarmData(prev => ({
            ...prev,
            lastIrrigated: 'Never',
            lastFertilized: 'Never',
            lastPestCheck: 'Never'
          }));
        }

      } catch (error) {
        console.error('Failed to fetch crop data:', error);
        // Set fallback data based on crop growth stage
        const estimatedDays = Math.max(1, Math.round((100 - initialGrowthPercent) * 1.2));
        setHarvestData({
          days_remaining: estimatedDays,
          estimated_harvest_date: new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          growth_percentage: initialGrowthPercent,
          status: 'growing',
          crop_name: 'Unknown'
        });
        
        // Set default farm values
        setFarmData(prev => ({
          ...prev,
          lastIrrigated: 'Never',
          lastFertilized: 'Never',
          lastPestCheck: 'Never'
        }));
      } finally {
        setIsLoadingHarvest(false);
      }
    };

    fetchCropData();
  }, [cropId, initialGrowthPercent]);

  // Fetch user profile for personalized mode
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user && isAuthenticated) {
        try {
          const profileResponse = await authAPI.getProfile();
          if (profileResponse.success && profileResponse.data) {
            setUserProfile(profileResponse.data);
            console.log('User profile loaded for crop simulation:', profileResponse.data);
          }
        } catch (error) {
          console.log('Profile not available for crop simulation:', error);
        }
      }
    };

    fetchUserProfile();
  }, [user, isAuthenticated]);

  // Harvest data processing will be handled by LLM integration
  useEffect(() => {
    // Harvest data processing will be handled by LLM integration

  }, [harvestData]);

  // Natural daily progression will be handled by LLM integration
  // useEffect for natural growth removed - will be replaced with LLM updates

  // Fetch weather data based on location
  useEffect(() => {
    const fetchUserLocationAndWeather = async () => {
      try {
        // First, get user profile to access location data
        const profileResponse = await authAPI.getProfile();
        if (profileResponse.success && profileResponse.data.location) {
          const { lat, lon } = profileResponse.data.location;
          
          if (lat && lon) {
            // Use user's stored location from database
            fetchWeatherData(lat, lon);
          } else {
            // Fallback to Bangalore coordinates if user location is incomplete
            fetchWeatherData(12.9716, 77.5946);
          }
        } else {
          // Fallback to Bangalore coordinates if profile fetch fails
          fetchWeatherData(12.9716, 77.5946);
        }
      } catch (error) {
        console.error('Failed to fetch user profile for location:', error);
        // Fallback to Bangalore coordinates
        fetchWeatherData(12.9716, 77.5946);
      }
    };

    if (user) {
      fetchUserLocationAndWeather();
    }
  }, [user]);

  // Fetch weather data based on location
  useEffect(() => {
    const fetchUserLocationAndWeather = async () => {
      try {
        // First, get user profile to access location data
        const profileResponse = await authAPI.getProfile();
        if (profileResponse.success && profileResponse.data.location) {
          const { lat, lon } = profileResponse.data.location;
          
          if (lat && lon) {
            // Use user's stored location from database
            fetchWeatherData(lat, lon);
          } else {
            // Fallback to Bangalore coordinates if user location is incomplete
            fetchWeatherData(12.9716, 77.5946);
          }
        } else {
          // Fallback to Bangalore coordinates if profile fetch fails
          fetchWeatherData(12.9716, 77.5946);
        }
      } catch (error) {
        console.error('Failed to fetch user profile for location:', error);
        // Fallback to Bangalore coordinates
        fetchWeatherData(12.9716, 77.5946);
      }
    };

    if (user) {
      fetchUserLocationAndWeather();
    }
  }, [user]);

  // Update farmData when weather data changes
  useEffect(() => {
    if (weatherData && weatherData.daily) {
      const newForecast = processWeatherData(weatherData);
      const todayTemp = Math.round(weatherData.daily.temperature_2m_max[0]);
      const todayWeather = WMO[weatherData.daily.weathercode[0]]?.label || 'Sunny';
      
      // Process soil data from hourly - get current hour's data or average of today
      let todaySoilMoisture = null;
      let todaySoilTemp = null;
      
      if (weatherData.hourly && weatherData.hourly.soil_moisture_0_to_7cm && weatherData.hourly.soil_temperature_0cm) {
        // Get current hour index (first 24 hours represent today)
        const currentHourIndex = new Date().getHours();
        const safeHourIndex = Math.min(currentHourIndex, weatherData.hourly.soil_moisture_0_to_7cm.length - 1);
        
        // Use current hour's data
        todaySoilMoisture = weatherData.hourly.soil_moisture_0_to_7cm[safeHourIndex] 
          ? Math.round(weatherData.hourly.soil_moisture_0_to_7cm[safeHourIndex] * 100) 
          : null;
        
        todaySoilTemp = weatherData.hourly.soil_temperature_0cm[safeHourIndex] 
          ? Math.round(weatherData.hourly.soil_temperature_0cm[safeHourIndex]) 
          : null;
      }
      
      setFarmData(prev => ({
        ...prev,
        currentTemp: todayTemp,
        soilTemp: todaySoilTemp,
        soilMoisture: todaySoilMoisture,
        weatherToday: todayWeather,
        forecast: newForecast
      }));
    }
  }, [weatherData]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);



  // Authentication check - redirect if not authenticated
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please log in to access the crop simulation.</p>
          <button
            onClick={() => navigate('/login')}
            className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;



    const userMessage = {
      id: Date.now(),
      text: newMessage,
      isBot: false,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    
    const currentMessage = newMessage;
    setNewMessage('');
    setIsChatTyping(true);

    console.log('About to call API with message:', currentMessage);

    try {
      console.log('Sending message:', currentMessage);
      console.log('Chat mode:', chatMode);
      console.log('Crop ID:', cropId);
      
      // Prepare farm context with real weather and soil data
      const farmContext = {
        weather: weatherData ? {
          // Use real weather forecast data from Open-Meteo API
          forecast: weatherData.daily,
          timezone: weatherData.timezone,
          // Legacy fields for backward compatibility
          current: farmData.weatherToday || 'Clear',
          temperature: farmData.currentTemp || 25
        } : {
          // Fallback to basic data if weather API hasn't loaded yet
          current: farmData.weatherToday || 'Clear',
          temperature: farmData.currentTemp || 25,
          forecast: farmData.forecast || []
        },
        soil: weatherData ? {
          // Use real soil data from Open-Meteo API
          hourly_data: weatherData.hourly,
          // Legacy fields for backward compatibility
          moisture: farmData.soilMoisture || 60,
          temperature: farmData.soilTemp || 22
        } : {
          // Fallback to basic data if weather API hasn't loaded yet
          moisture: farmData.soilMoisture || 60,
          temperature: farmData.soilTemp || 22
        },
        location: {
          // Include detailed location information
          text: user?.location || "India",
          coordinates: user?.location || { lat: 12.9716, lon: 77.5946 }, // Bangalore fallback
          timezone: weatherData?.timezone || "Asia/Kolkata"
        }
      };

      let response;
      
      // Crop simulation always uses my_farm mode with crop-specific context
      console.log('Using crop simulation API in my_farm mode');
      console.log('Sending farm context with real weather/soil data:', JSON.stringify(farmContext, null, 2));
      // Build conversation history for context
      const conversationHistory = chatMessages.map(msg => ({
        sender: msg.isBot ? 'assistant' : 'user',
        text: msg.text
      }));

      response = await cropSimChatAPI.sendMessage({
        message: currentMessage,
        cropId: cropId,
        farmContext: farmContext,
        conversationHistory: conversationHistory,
        mode: 'my_farm' // Crop simulation always uses my_farm mode
      });

      console.log('API Response:', response);

      if (response.success) {
        let botResponseText = '';
        let updatedCropData = null;

        if (response.data && response.data.crop) {
          // Handle crop simulation response with crop updates
          const oldStage = cropStage;
          const newStage = response.data.crop.growth_percent;
          console.log('Frontend: Updating crop stage from', oldStage, 'to', newStage);
          console.log('Frontend: Received crop data:', response.data.crop);
          setCropStage(newStage);
          setCurrentCrop(response.data.crop);
          updatedCropData = response.data.crop;
          
          // Trigger growth animation if growth increased
          if (newStage > oldStage) {
            setGrowthUpdated(true);
            setTimeout(() => setGrowthUpdated(false), 2000);
          }
          
          // Update farm data with new irrigation/fertilization dates
          if (response.data.detection && response.data.detection.hasEvent) {
            const eventType = response.data.detection.eventType;
            
            setFarmData(prev => ({
              ...prev,
              lastIrrigated: response.data.crop.derived?.last_irrigation_at ? 
                new Date(response.data.crop.derived.last_irrigation_at).toLocaleDateString() : prev.lastIrrigated,
              lastFertilized: response.data.crop.derived?.last_fertilization_at ? 
                new Date(response.data.crop.derived.last_fertilization_at).toLocaleDateString() : prev.lastFertilized,
              lastPestCheck: response.data.crop.derived?.last_pest_check_at ?
                new Date(response.data.crop.derived.last_pest_check_at).toLocaleDateString() : prev.lastPestCheck
            }));

            // Mark field as recently updated for visual feedback
            const fieldMap = {
              irrigation: 'lastIrrigated',
              fertilization: 'lastFertilized',
              pest_check: 'lastPestCheck'
            };
            
            if (fieldMap[eventType]) {
              setRecentlyUpdated(prev => ({
                ...prev,
                [fieldMap[eventType]]: true
              }));
              
              // Remove the highlight after 3 seconds
              setTimeout(() => {
                setRecentlyUpdated(prev => ({
                  ...prev,
                  [fieldMap[eventType]]: false
                }));
              }, 3000);
            }
            
            // Add activity to daily log if it was an event
            if (response.data.detection.eventType) {
              const activityNames = {
                irrigation: 'Irrigated crops',
                fertilization: 'Applied fertilizer',
                pest_check: 'Checked for pests'
              };
              
              setDailyActivities(prev => [...prev, {
                activity: activityNames[response.data.detection.eventType] || 'Farm activity',
                timestamp: new Date(),
                growthImpact: response.data.crop.growth_percent - cropStage
              }]);
            }
          }
          
          botResponseText = response.data.response;
        } else {
          // Handle general chatbot response
          botResponseText = response.data?.answer || response.data?.response || response.message || "I'm here to help with your farming needs!";
        }

        // Add bot response
        const botMessage = {
          id: Date.now() + 1,
          text: botResponseText,
          isBot: true,
          timestamp: new Date()
        };

        console.log('Adding bot response:', botMessage);
        setChatMessages(prev => {
          console.log('Previous messages before bot response:', prev.length);
          const newMessages = [...prev, botMessage];
          console.log('New messages after adding bot response:', newMessages.length);
          return newMessages;
        });
        console.log('Bot response added:', botResponseText);
      } else {
        throw new Error(response.message || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chat API error:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        text: "I'm experiencing some technical difficulties. Please try again later.",
        isBot: true,
        timestamp: new Date()
      };

      console.log('Adding error message:', errorMessage);
      setChatMessages(prev => {
        console.log('Previous messages before error:', prev.length);
        const newMessages = [...prev, errorMessage];
        console.log('New messages after adding error:', newMessages.length);
        return newMessages;
      });
    } finally {
      setIsChatTyping(false);
      console.log('handleSendMessage completed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-200 via-white to-primary-200 pt-20 sm:pt-24 pb-8 sm:pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 sm:max-w-[75vw]">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="space-y-8 lg:grid lg:grid-cols-5 lg:gap-8 lg:space-y-0 items-start"
        >
          {/* Main Content Area - Reordered for mobile */}
          <div className="relative lg:col-span-3 lg:col-start-1 space-y-4 sm:space-y-6 lg:order-1 rounded-lg mx-auto w-full" style={{ overflow: 'visible' }}>
            {/* Agricultural Robot - Behind the entire main content area (hidden on mobile) */}
            <div className="hidden lg:block absolute -left-52 bottom-24 transform z-0 pointer-events-none">
              <img 
                src="/assets/Gemini_Generated_Image_31w3xn31w3xn31w3-removebg-preview.png" 
                alt="Agricultural Robot" 
                className="w-96 h-auto duration-300"
                style={{ 
                  transform: 'rotate(-3deg) scale(1.1)',
                  filter: 'drop-shadow(8px 10px 20px rgba(0,0,0,0.25))'
                }}
              />
            </div>
            
            {/* Real Crop Growth Visualization */}
            <motion.div
              variants={itemVariants}
              className="relative bg-white shadow-sm p-6 mb-8 rounded-lg z-10 border-2 border-primary-300/60"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-black mb-4 sm:mb-0">{harvestData && `Your ${harvestData.crop_name.charAt(0).toUpperCase() + harvestData.crop_name.slice(1) || 'Crop'} Field Visualization`}</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200/50">
                    <FaCalendarAlt className="text-primary-600 text-sm" />
                    <span className="text-sm font-medium text-primary-800">Day {daysSincePlanting}</span>
                  </div>
                  <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-secondary-50 to-secondary-100 rounded-lg border border-secondary-200/50">
                    <FaSeedling className="text-secondary-700 text-sm" />
                    <span className="text-sm font-medium text-secondary-800">{Math.round(cropStage)}%</span>
                  </div>
                </div>
              </div>
              
              <div className="w-full h-[402.5px] rounded-lg overflow-hidden bg-gradient-to-b from-sky-100 to-emerald-50 border border-gray-200 mb-6">
                <Canvas
                  camera={{ position: [0, 3, 7], fov: 60 }}
                  shadows
                  className="w-full h-full"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                  gl={{ 
                    antialias: true,
                    alpha: true,
                    preserveDrawingBuffer: false
                  }}
                >
                  <Suspense fallback={
                    <Text position={[0, 0, 0]} fontSize={0.3} color="green">
                      Growing Your Farm...
                    </Text>
                  }>
                    <CropScene stage={cropStage} farmData={farmData} />
                  </Suspense>
                </Canvas>
              </div>
              
              <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 transition-all duration-500 ${
                growthUpdated ? 'border-emerald-300 bg-emerald-50' : ''
              }`}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-medium text-black">Growth Progress</h3>
                  <span className={`text-lg font-semibold transition-all duration-300 ${
                    growthUpdated ? 'text-emerald-600' : 'text-gray-900'
                  }`}>{Math.round(cropStage)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-1000 ${
                      growthUpdated ? 'bg-emerald-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${cropStage}%` }}
                  />
                </div>
                <div className="mt-3 text-center">
                  <p className="text-sm text-gray-600">
                    {cropStage < 10 && "Seeds are germinating"}
                    {cropStage >= 10 && cropStage < 25 && "Young seedlings emerging"}
                    {cropStage >= 25 && cropStage < 45 && "Vegetative growth phase"}
                    {cropStage >= 45 && cropStage < 65 && "Tillering and branching"}
                    {cropStage >= 65 && cropStage < 85 && "Flowering stage"}
                    {cropStage >= 85 && cropStage < 100 && "Grain filling"}
                    {cropStage >= 100 && "Ready for harvest"}
                  </p>
                </div>
                {lastActivity && (
                  <div className="mt-2 text-xs text-blue-600 text-center">
                    Last activity: {lastActivity}
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Chatbot Sidebar */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-2 lg:col-start-4 lg:order-2 w-full max-w-full bg-gradient-to-br from-white to-primary-400/30 rounded-lg border-2 border-primary-300/60 shadow-sm p-4 sm:p-6 h-fit max-h-[calc(100vh-45px)] lg:sticky lg:top-[120px] overflow-hidden"
          >
            <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-200/50">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex items-center justify-center border border-primary-300/50">
                <FaRobot className="text-primary-700 text-lg" />
              </div>
              <div>
                <h3 className="font-semibold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">AI Assistant</h3>
                <p className="text-sm text-gray-600">Farm-specific insights</p>
              </div>
            </div>

            {/* Chat Messages */}
            <div 
              ref={chatContainerRef}
              className={`overflow-y-auto mb-4 space-y-3 pr-2 scrollbar-emerald transition-all duration-300 ease-in-out ${
                quickActionsExpanded ? 'h-64' : 'h-80'
              }`} 
              id="chat-container"
            >
              <AnimatePresence mode="popLayout">
                {chatMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className="flex items-start gap-2 max-w-[85%]">
                      <div
                        className={`relative flex-1 p-3 rounded-lg text-sm break-words leading-relaxed ${
                          message.isBot
                            ? message.isSystemMessage 
                              ? 'bg-amber-50 border border-amber-200 text-amber-800'
                              : 'bg-gray-50 border border-gray-200 text-gray-800'
                            : 'bg-emerald-500 text-white border border-emerald-500'
                        }`}
                      >
                        {message.isBot ? (
                          <div className="space-y-1">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={cropMarkdownComponents}
                            >
                              {message.text}
                            </ReactMarkdown>
                            
                            {/* TTS Button - Only show for bot messages */}
                            {message.text && message.text.trim().length > 0 && (
                              <TextToSpeech 
                                text={message.text}
                                className=""
                              />
                            )}
                          </div>
                        ) : (
                          message.text
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isChatTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </motion.div>
              )}
              
              {/* Auto-scroll target */}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="flex items-center space-x-2 sm:space-x-3 w-full">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about your crops..."
                className="flex-1 min-w-0 px-2 sm:px-3 py-2 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
              <button
                onClick={handleSendMessage}
                className="p-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all duration-200 shadow-sm flex-shrink-0"
              >
                <FaPaperPlane className="text-sm" />
              </button>
              
              {/* Speech-to-Text Component */}
              <SpeechToText
                onTranscript={(transcript, isInterim = false) => {
                  if (isInterim) {
                    // For interim results, replace only the voice input part
                    setNewMessage(transcript);
                  } else {
                    // For final results, set the final text (interim is replaced, not appended)
                    setNewMessage(transcript);
                  }
                }}
                userPreferredLanguage={userProfile?.preferred_language || 'en'}
                size="small"
                className="flex-shrink-0"
              />
            </div>

            {/* Quick Actions */}
            <div className="mt-4 space-y-2 w-full">
              <button 
                onClick={() => setQuickActionsExpanded(!quickActionsExpanded)}
                className="w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors duration-200 p-2 rounded-lg hover:bg-gray-50"
              >
                <span>Quick Actions</span>
                <svg 
                  className={`w-4 h-4 transform transition-transform duration-200 ${
                    quickActionsExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Fixed height container to maintain chat size when collapsed */}
              <div className={`transition-all duration-300 ease-in-out w-full ${
                quickActionsExpanded ? 'h-40' : 'h-0'
              } overflow-hidden`}>
                <div className="h-full overflow-y-auto space-y-2 pt-1 w-full scrollbar-elegant">
                  {[
                    "Irrigated my crops",
                    "Applied fertilizer", 
                    "Checked for pests",
                    "How are my crops doing?",
                    "When will harvest be ready?",
                    "Check weather forecast"
                  ].map((question, index) => (
                    <button
                      key={index}
                      onClick={() => setNewMessage(question)}
                      className="w-full text-left px-2 sm:px-3 py-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 rounded-lg text-xs sm:text-sm text-gray-700 transition-colors duration-200 break-words"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Detailed Dashboard - Mobile-optimized */}
          <div className="lg:col-span-3 lg:order-3">
            {/* Dashboard */}
            <motion.div
              variants={itemVariants}
              className="bg-white rounded-lg border-2 border-primary-200/70 shadow-md p-8 w-full"
            >
              <div className="mb-8">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">Farm Analytics</h2>
                <p className="text-gray-600">Real-time monitoring and insights for your crop</p>
              </div>
              
              {/* Key Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50 rounded-lg p-4 text-center shadow-sm">
                  <FaTemperatureHigh className="text-xl text-primary-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-600 mb-1">Temperature</p>
                  {farmData.currentTemp !== null ? (
                    <p className="text-lg font-bold text-gray-900">{Math.round(farmData.currentTemp)}°C</p>
                  ) : (
                    <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                  )}
                </div>
                
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50 rounded-lg p-4 text-center shadow-sm">
                  <FaTint className="text-xl text-secondary-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-600 mb-1">Soil Moisture</p>
                  {farmData.soilMoisture !== null ? (
                    <p className="text-lg font-bold text-gray-900">{farmData.soilMoisture}%</p>
                  ) : (
                    <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                  )}
                </div>
                
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50 rounded-lg p-4 text-center shadow-sm">
                  <FaTemperatureHigh className="text-xl text-gray-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-600 mb-1">Soil Temp</p>
                  {farmData.soilTemp !== null ? (
                    <p className="text-lg font-bold text-gray-900">{farmData.soilTemp}°C</p>
                  ) : (
                    <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                  )}
                </div>
                
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50 rounded-lg p-4 text-center shadow-sm">
                  <FaSeedling className="text-xl text-secondary-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-600 mb-1">Days Old</p>
                  <p className="text-lg font-bold text-gray-900">
                    {isLoadingHarvest ? (
                      <LoadingSkeleton className="w-8 h-6 mx-auto" />
                    ) : (
                      daysSincePlanting
                    )}
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50 rounded-lg p-4 text-center shadow-sm">
                  <FaCalendarAlt className="text-xl text-primary-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-600 mb-1">Harvest In</p>
                  {isLoadingHarvest ? (
                    <LoadingSkeleton className="w-16 h-4 mx-auto" />
                  ) : (
                    <>
                      <p className="text-lg font-bold text-gray-900">
                        {farmData.expectedHarvest}
                      </p>
                      {harvestData && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(harvestData.estimated_harvest_date).toLocaleDateString()}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50 rounded-lg p-4 text-center shadow-sm">
                  <FaChartLine className="text-xl text-secondary-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-600 mb-1">Growth</p>
                  <p className="text-lg font-bold text-gray-900">{Math.round(cropStage)}%</p>
                </div>
              </div>

              {/* Detailed Info Grid */}
              <div className="flex flex-wrap gap-6 w-full justify-center">
                {/* Harvest Information */}
                {isLoadingHarvest ? (
                  <HarvestInfoSkeleton />
                ) : harvestData ? (
                  <div className="space-y-4 flex-1 min-w-[280px] max-w-[350px]">
                    <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Harvest Information</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[3.5rem]">
                        <div className="flex items-center space-x-3 flex-shrink-0">
                          <FaCalendarAlt className="text-gray-500 text-sm" />
                          <span className="text-sm text-gray-700">Estimated Date</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 text-right ml-2 flex-shrink-0">
                          {new Date(harvestData.estimated_harvest_date).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[3.5rem]">
                        <div className="flex items-center space-x-3 flex-shrink-0">
                          <FaChartLine className="text-gray-500 text-sm" />
                          <span className="text-sm text-gray-700">Days Remaining</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 text-right ml-2 flex-shrink-0">
                          {harvestData.days_remaining} days
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[3.5rem]">
                        <div className="flex items-center space-x-3 flex-shrink-0">
                          <FaSeedling className="text-gray-500 text-sm" />
                          <span className="text-sm text-gray-700">Growth Progress</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 text-right ml-2 flex-shrink-0">
                          {Math.round(harvestData.growth_percentage)}%
                        </span>
                      </div>

                      <div className={`flex items-center justify-between border rounded-lg p-3 min-h-[3.5rem] ${
                        harvestData.status === 'ready_for_harvest' 
                          ? 'bg-amber-50 border-amber-200' 
                          : 'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-center space-x-3 flex-shrink-0">
                          <div className={`w-2 h-2 rounded-full ${
                            harvestData.status === 'ready_for_harvest' ? 'bg-amber-500' : 'bg-gray-400'
                          }`}></div>
                          <span className="text-sm text-gray-700">Status</span>
                        </div>
                        <span className={`text-sm font-medium text-right ml-2 flex-shrink-0 ${
                          harvestData.status === 'ready_for_harvest' 
                            ? 'text-amber-700' 
                            : 'text-gray-900'
                        }`}>
                          {harvestData.status === 'ready_for_harvest' ? 'Ready for Harvest!' : 'Growing'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Farm Activities */}
                <div className="space-y-4 flex-1 min-w-[280px] max-w-[350px]">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
                  <div className="space-y-3">
                    <div className={`flex items-center justify-between rounded-lg p-3 min-h-[3.5rem] transition-all duration-300 ${
                      recentlyUpdated.lastIrrigated ? 'bg-blue-50 border-2 border-blue-300' : 'bg-gray-50 border border-gray-200'
                    }`}>
                      <div className="flex items-center space-x-3 flex-shrink-0">
                        <FaTint className="text-blue-500 text-sm" />
                        <span className="text-sm text-gray-700">Last Irrigated</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 ml-2 flex-shrink-0">{farmData.lastIrrigated}</span>
                    </div>
                    
                    <div className={`flex items-center justify-between rounded-lg p-3 min-h-[3.5rem] transition-all duration-300 ${
                      recentlyUpdated.lastFertilized ? 'bg-emerald-50 border-2 border-emerald-300' : 'bg-gray-50 border border-gray-200'
                    }`}>
                      <div className="flex items-center space-x-3 flex-shrink-0">
                        <FaSeedling className="text-emerald-500 text-sm" />
                        <span className="text-sm text-gray-700">Last Fertilized</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 ml-2 flex-shrink-0">{farmData.lastFertilized}</span>
                    </div>

                    <div className={`flex items-center justify-between rounded-lg p-3 min-h-[3.5rem] transition-all duration-300 ${
                      recentlyUpdated.lastPestCheck ? 'bg-orange-50 border-2 border-orange-300' : 'bg-gray-50 border border-gray-200'
                    }`}>
                      <div className="flex items-center space-x-3 flex-shrink-0">
                        <FaBug className="text-orange-500 text-sm" />
                        <span className="text-sm text-gray-700">Last Pest Check</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 ml-2 flex-shrink-0">{farmData.lastPestCheck}</span>
                    </div>

                    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[3.5rem]">
                      <div className="flex items-center space-x-3 flex-shrink-0">
                        <FaChartLine className="text-purple-500 text-sm" />
                        <span className="text-sm text-gray-700">Growth Rate</span>
                      </div>
                      <span className="text-sm font-medium text-emerald-600 ml-2 flex-shrink-0">{farmData.growthRate}</span>
                    </div>
                  </div>
                </div>

                {/* Next Event Section */}
                {currentCrop?.derived && (
                  <div className="space-y-4 flex-1 min-w-[280px] max-w-[350px]">
                    <h3 className="text-lg font-semibold text-gray-900">Scheduled Activity</h3>
                    <div className="space-y-2">
                      {/* Collapsible Event Card */}
                      <div className={`border-2 rounded-lg transition-all duration-300 ${
                        (() => {
                          // If there's an active restriction, calculate days until restriction ends
                          if (currentCrop.derived.event_restriction_active && currentCrop.derived.event_restriction_until) {
                            const restrictionEndDate = new Date(currentCrop.derived.event_restriction_until);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            restrictionEndDate.setHours(0, 0, 0, 0);
                            const daysUntilRestrictionEnds = Math.ceil((restrictionEndDate - today) / (1000 * 60 * 60 * 24));
                            
                            if (daysUntilRestrictionEnds === 0) return 'border-green-300 bg-green-50';
                            if (daysUntilRestrictionEnds < 0) return 'border-red-300 bg-red-50';
                            return 'border-yellow-300 bg-yellow-50';
                          }
                          
                          // Otherwise use the regular next event timing
                          if (currentCrop.derived.next_event_days_until === 0) return 'border-green-300 bg-green-50';
                          if (currentCrop.derived.next_event_days_until < 0) return 'border-red-300 bg-red-50';
                          return 'border-yellow-300 bg-yellow-50';
                        })()
                      }`}>
                        {/* Collapsed Header - Always Visible */}
                        <button 
                          className="w-full p-4 text-left focus:outline-none rounded-lg"
                          onClick={() => setActivityExpanded(!activityExpanded)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1">
                              {/* Icon */}
                              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
                                {currentCrop.derived.next_event === 'irrigation' && <FaTint className="text-blue-500 text-xs" />}
                                {currentCrop.derived.next_event === 'fertilization' && <FaSeedling className="text-emerald-500 text-xs" />}
                                {currentCrop.derived.next_event === 'pest_check' && <FaBug className="text-orange-500 text-xs" />}
                                {currentCrop.derived.next_event === 'harvesting' && <FaCalendarAlt className="text-purple-500 text-xs" />}
                                {!['irrigation', 'fertilization', 'pest_check', 'harvesting'].includes(currentCrop.derived.next_event) && 
                                <FaCalendarAlt className="text-gray-500 text-xs" />}
                              </div>
                              
                              {/* Title and Status */}
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h4 className="text-sm font-semibold text-gray-900 capitalize">
                                    {currentCrop.derived.next_event?.replace('_', ' ') || 'No Activity'}
                                  </h4>
                                  
                                  
                                </div>
                                
                                {/* Key Date */}
                                <p className="text-xs text-gray-500">
                                  {currentCrop.derived.event_restriction_active && currentCrop.derived.event_restriction_until
                                    ? `Restricted until ${new Date(currentCrop.derived.event_restriction_until).toLocaleDateString()}`
                                    : currentCrop.derived.next_event_due_date 
                                      ? `Due ${new Date(currentCrop.derived.next_event_due_date).toLocaleDateString()}`
                                      : 'No scheduled date'
                                  }
                                </p>
                              </div>
                            </div>
                            
                            {/* Dropdown Arrow */}
                            <div className="flex-shrink-0 ml-2">
                              <svg 
                                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${activityExpanded ? 'rotate-180' : ''}`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </button>
                        
                        {/* Expanded Content */}
                        {activityExpanded && (
                          <div className="px-4 pb-4 border-t border-gray-200 space-y-3">
                            {/* Description - Only show when NOT restricted */}
                            {!currentCrop.derived.event_restriction_active && (
                              <div className="mt-3">
                                <p className="text-sm text-gray-600">
                                  {currentCrop.derived.next_event_description || 'No description available'}
                                </p>
                              </div>
                            )}
                            
                            {/* Detailed Status */}
                            {currentCrop.derived.event_restriction_active && currentCrop.derived.event_restriction_until ? (
                              <div className={`rounded-lg p-3 ${
                                (() => {
                                  const restrictionEndDate = new Date(currentCrop.derived.event_restriction_until);
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  restrictionEndDate.setHours(0, 0, 0, 0);
                                  const daysUntilRestrictionEnds = Math.ceil((restrictionEndDate - today) / (1000 * 60 * 60 * 24));
                                  
                                  if (daysUntilRestrictionEnds === 0) return 'bg-green-100 border border-green-200';
                                  if (daysUntilRestrictionEnds < 0) return 'bg-red-100 border border-red-200';
                                  return 'bg-yellow-100 border border-yellow-200';
                                })()
                              }`}>
                                <div className="flex items-center space-x-2 mb-2">
                                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                                    (() => {
                                      const restrictionEndDate = new Date(currentCrop.derived.event_restriction_until);
                                      const today = new Date();
                                      today.setHours(0, 0, 0, 0);
                                      restrictionEndDate.setHours(0, 0, 0, 0);
                                      const daysUntilRestrictionEnds = Math.ceil((restrictionEndDate - today) / (1000 * 60 * 60 * 24));
                                      
                                      if (daysUntilRestrictionEnds === 0) return 'bg-green-500';
                                      if (daysUntilRestrictionEnds < 0) return 'bg-red-500';
                                      return 'bg-yellow-500';
                                    })()
                                  }`}></div>
                                  <span className={`text-sm font-medium ${
                                    (() => {
                                      const restrictionEndDate = new Date(currentCrop.derived.event_restriction_until);
                                      const today = new Date();
                                      today.setHours(0, 0, 0, 0);
                                      restrictionEndDate.setHours(0, 0, 0, 0);
                                      const daysUntilRestrictionEnds = Math.ceil((restrictionEndDate - today) / (1000 * 60 * 60 * 24));
                                      
                                      if (daysUntilRestrictionEnds === 0) return 'text-green-700';
                                      if (daysUntilRestrictionEnds < 0) return 'text-red-700';
                                      return 'text-yellow-700';
                                    })()
                                  }`}>Activity Restricted</span>
                                </div>
                                <p className={`text-sm ${
                                  (() => {
                                    const restrictionEndDate = new Date(currentCrop.derived.event_restriction_until);
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    restrictionEndDate.setHours(0, 0, 0, 0);
                                    const daysUntilRestrictionEnds = Math.ceil((restrictionEndDate - today) / (1000 * 60 * 60 * 24));
                                    
                                    if (daysUntilRestrictionEnds === 0) return 'text-green-600';
                                    if (daysUntilRestrictionEnds < 0) return 'text-red-600';
                                    return 'text-yellow-600';
                                  })()
                                }`}>
                                  Watering during flowering can cause flower drop and reduce yield by up to 30%.
                                </p>
                              </div>
                            ) : currentCrop.derived.next_event_due_date && (
                              <div className={`border rounded-lg p-3 ${
                                currentCrop.derived.next_event_days_until === 0
                                  ? 'bg-red-100 border-red-200'
                                  : currentCrop.derived.next_event_days_until <= 1
                                    ? 'bg-orange-100 border-orange-200'
                                    : currentCrop.derived.next_event_days_until <= 3
                                      ? 'bg-yellow-100 border-yellow-200'
                                      : 'bg-blue-100 border-blue-200'
                              }`}>
                                <div className="flex items-center space-x-2 mb-2">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    currentCrop.derived.next_event_days_until === 0
                                      ? 'bg-red-500 animate-pulse'
                                      : currentCrop.derived.next_event_days_until <= 1
                                        ? 'bg-orange-500 animate-pulse'
                                        : currentCrop.derived.next_event_days_until <= 3
                                          ? 'bg-yellow-500'
                                          : 'bg-blue-500'
                                  }`}></div>
                                  <span className={`text-sm font-medium ${
                                    currentCrop.derived.next_event_days_until === 0
                                      ? 'text-red-700'
                                      : currentCrop.derived.next_event_days_until <= 1
                                        ? 'text-orange-700'
                                        : currentCrop.derived.next_event_days_until <= 3
                                          ? 'text-yellow-700'
                                          : 'text-blue-700'
                                  }`}>
                                    {currentCrop.derived.next_event_days_until === 0
                                      ? 'Due Now - Action Required!'
                                      : currentCrop.derived.next_event_days_until === 1
                                        ? 'Due Tomorrow'
                                        : `Due in ${currentCrop.derived.next_event_days_until} days`
                                    }
                                  </span>
                                </div>
                                
                                <div className="text-xs text-gray-600">
                                  <strong>Scheduled:</strong> {new Date(currentCrop.derived.next_event_due_date).toLocaleDateString()}
                                </div>
                                
                                
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
  

                {/* Weather Forecast */}
                <div className="space-y-4 flex-1 min-w-[280px] max-w-[350px]">
                  <h3 className="text-lg font-semibold text-gray-900">5-Day Forecast</h3>
                  <div className="space-y-3">
                    {isLoadingWeather ? (
                      // Loading state
                      [...Array(5)].map((_, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-5 h-5 bg-gray-200 rounded-full animate-pulse"></div>
                            <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="h-4 bg-gray-200 rounded w-8 animate-pulse"></div>
                            <div className="h-3 bg-gray-200 rounded w-12 animate-pulse"></div>
                          </div>
                        </div>
                      ))
                    ) : weatherError ? (
                      // Error state
                      <div className="flex items-center justify-center bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-sm text-red-600">{weatherError}</div>
                      </div>
                    ) : farmData.forecast.length > 0 ? (
                      // Weather data
                      farmData.forecast.map((day, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[3.5rem]">
                          <div className="flex items-center space-x-3 flex-shrink-0">
                            <day.icon className="text-amber-500 text-sm" />
                            <span className="text-sm text-gray-700">{day.day}</span>
                          </div>
                          <div className="text-right ml-2 flex-shrink-0">
                            <p className="text-sm font-medium text-gray-900">{day.temp}°C</p>
                            <p className="text-xs text-gray-500" title={day.condition}>{day.condition.length > 12 ? day.condition.substring(0, 12) + '...' : day.condition}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      // No data fallback
                      <div className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-6">
                        <div className="text-sm text-gray-600">Weather data unavailable</div>
                      </div>
                    )}
                  </div>
                </div>


              </div>


            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CropSimulation;
