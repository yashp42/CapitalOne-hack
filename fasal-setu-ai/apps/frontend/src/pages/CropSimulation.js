import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, Text, Box, Sphere } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import { 
  FaTemperatureHigh, 
  FaCloudRain, 
  FaSeedling, 
  FaTint, 
  FaCalendarAlt,
  FaChartLine,
  FaCloud,
  FaSun,
  FaSnowflake,
  FaWind,
  FaRobot,
  FaPaperPlane,
  FaMicrophone,
  FaPlay,
  FaPause,
  FaFastForward
} from 'react-icons/fa';

// 3D Crop Plant Component - Realistic grass field simulation
function CropPlant({ stage, farmData }) {
  const grassFieldRef = useRef();
  const grassBlades = useRef([]);
  const soilParticles = useRef([]);

  // Load soil texture (hooks must be called unconditionally)
  const soilTexture = useLoader(TextureLoader, '/assets/soil-texture.jpg');
  
  // Configure texture properties for realism
  useEffect(() => {
    if (soilTexture) {
      soilTexture.wrapS = soilTexture.wrapT = THREE.RepeatWrapping;
      soilTexture.repeat.set(3, 3); // Repeat texture 3x3 times across the surface
      soilTexture.offset.set(0, 0);
    }
  }, [soilTexture]);

  useFrame((state) => {
    // Wind sway every 10 seconds - more pronounced and realistic
    const windCycle = Math.sin(state.clock.elapsedTime * 0.1) * 0.8; // 10-second cycle (2π/0.628 ≈ 10s)
    const windStrength = farmData.forecast[0].condition === 'Windy' ? 0.6 : 0.3;
    const windSpeed = farmData.forecast[0].condition === 'Windy' ? 1.5 : 1.0;
    
    // Individual grass blade movement with 10-second wind gusts
    grassBlades.current.forEach((blade, i) => {
      if (blade) {
        // Main wind sway every 10 seconds
        const windGust = Math.sin(state.clock.elapsedTime * 0.628 + i * 0.2) * windStrength * windCycle;
        // Subtle natural movement
        const naturalSway = Math.sin(state.clock.elapsedTime * 0.5 + i * 0.1) * 0.08;
        // Micro movements for realism
        const microSway = Math.sin(state.clock.elapsedTime * 2 + i * 0.05) * 0.02;
        
        blade.rotation.z = windGust + naturalSway + microSway;
        blade.rotation.x = Math.sin(state.clock.elapsedTime * 0.3 + i * 0.2) * 0.03;
      }
    });

    // Subtle soil particle movement
    soilParticles.current.forEach((particle, i) => {
      if (particle && farmData.lastIrrigated === 'Today') {
        particle.position.y = Math.sin(state.clock.elapsedTime * 2 + i) * 0.02 - 0.3;
      }
    });
  });

  // Calculate grass field parameters based on growth stage
  const fieldWidth = 80; // Massively expanded horizontally for huge field
  const fieldDepth = 60; // Significantly expanded depth for massive coverage
  const maxGrassHeight = 2.5;
  const maxGrassWidth = 0.15;

  // Generate stable grass positions that NEVER change on re-renders
  const grassPositions = useMemo(() => {
    const positions = [];
    
    // Use seeded random-like function for consistent results
    const seededRandom = (seed) => {
      const x = Math.sin(seed * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    
    for (let i = 0; i < 1800; i++) { // Max possible grass blades
      const x = (seededRandom(i * 2.1) - 0.5) * fieldWidth + (seededRandom(i * 3.7) - 0.5) * 0.3;
      const z = (seededRandom(i * 5.3) - 0.5) * fieldDepth + (seededRandom(i * 7.1) - 0.5) * 0.3;
      const baseHeight = maxGrassHeight * (0.6 + seededRandom(i * 11.2) * 0.8); // Base height variation
      const baseThickness = Math.max(0.04, maxGrassWidth * (0.7 + seededRandom(i * 13.4) * 0.6)); // Base thickness variation
      
      positions.push({ x, z, baseHeight, baseThickness, id: i });
    }
    return positions;
  }, []); // Empty dependency array - positions NEVER change

  // Calculate current visible grass based on growth stage
  const visibleGrassCount = Math.floor((stage / 100) * 1800);
  const currentGrassPositions = grassPositions.slice(0, visibleGrassCount);

  return (
    <group ref={grassFieldRef} position={[0, -2, 0]}>
      {/* Realistic Soil Base - covers entire field with texture */}
      <group>
        {/* Main soil layer with realistic texture */}
        <Box args={[fieldWidth, 1, fieldDepth]} position={[0, -0.5, 0]}>
          <meshStandardMaterial 
            map={soilTexture}
            color={soilTexture ? "#FFFFFF" : "#6B4423"} // Use white with texture, fallback to brown
            roughness={0.95}
            metalness={0.05}
            normalScale={soilTexture ? [0.8, 0.8] : [0, 0]}
          />
        </Box>
        
        {/* Secondary soil layer for depth with darker texture */}
        <Box args={[fieldWidth + 10, 0.3, fieldDepth + 8]} position={[0, -0.85, 0]}>
          <meshStandardMaterial 
            map={soilTexture}
            color={soilTexture ? "#8B7355" : "#5A3A1F"} // Darker tint for depth or fallback
            roughness={0.98}
            metalness={0.02}
            normalScale={soilTexture ? [0.6, 0.6] : [0, 0]}
          />
        </Box>

        {/* Extended soil border for seamless appearance */}
        <Box args={[fieldWidth + 20, 0.2, fieldDepth + 16]} position={[0, -1.1, 0]}>
          <meshStandardMaterial 
            map={soilTexture}
            color={soilTexture ? "#7A6B55" : "#4A3A1F"} // Even darker for deep soil
            roughness={0.99}
            metalness={0.01}
          />
        </Box>

        {/* Fourth soil layer for massive field coverage */}
        <Box args={[fieldWidth + 30, 0.15, fieldDepth + 24]} position={[0, -1.3, 0]}>
          <meshStandardMaterial 
            map={soilTexture}
            color={soilTexture ? "#6A5B45" : "#3A2A1F"} // Deepest soil layer
            roughness={0.99}
            metalness={0.01}
          />
        </Box>

        {/* Fifth soil layer for ultra-massive coverage */}
        <Box args={[fieldWidth + 40, 0.1, fieldDepth + 32]} position={[0, -1.45, 0]}>
          <meshStandardMaterial 
            map={soilTexture}
            color={soilTexture ? "#5A4B35" : "#2A1A0F"} // Ultra-deep soil foundation
            roughness={0.99}
            metalness={0.01}
          />
        </Box>

        {/* Soil texture - dirt clumps and stones with texture variety */}
        {Array.from({ length: 160 }, (_, i) => { // Increased from 120 to 160 for massive field
          const size = 0.03 + Math.random() * 0.08;
          const x = (Math.random() - 0.5) * fieldWidth;
          const z = (Math.random() - 0.5) * fieldDepth;
          const y = -0.1 + Math.random() * 0.2;
          
          return (
            <Sphere
              key={`soil-${i}`}
              ref={(el) => (soilParticles.current[i] = el)}
              args={[size]}
              position={[x, y, z]}
            >
              <meshStandardMaterial 
                map={i % 4 === 0 ? soilTexture : null} // Some particles use texture, others use solid color
                color={i % 3 === 0 ? "#8B7355" : i % 3 === 1 ? "#654321" : "#4A4A4A"} 
                roughness={0.9}
              />
            </Sphere>
          );
        })}

        {/* Soil moisture indicators */}
        {farmData.soilMoisture > 70 && Array.from({ length: 15 }, (_, i) => (
          <Sphere 
            key={`moisture-${i}`}
            args={[0.015]} 
            position={[
              (Math.random() - 0.5) * fieldWidth,
              -0.05 + Math.random() * 0.1,
              (Math.random() - 0.5) * fieldDepth
            ]}
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

        {/* Fertilizer particles if recently fertilized */}
        {farmData.lastFertilized === 'Today' && Array.from({ length: 20 }, (_, i) => (
          <Sphere 
            key={`fertilizer-${i}`}
            args={[0.01]} 
            position={[
              (Math.random() - 0.5) * fieldWidth,
              0.05 + Math.random() * 0.1,
              (Math.random() - 0.5) * fieldDepth
            ]}
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
            
            // Different grass colors for realism
            const grassColors = [
              `hsl(${85 + Math.sin(grass.id) * 10}, ${50 + farmData.nutrients.nitrogen / 3}%, ${25 + farmData.soilMoisture / 8}%)`,
              `hsl(${95 + Math.sin(grass.id * 0.7) * 15}, ${55 + farmData.nutrients.nitrogen / 4}%, ${30 + farmData.soilMoisture / 6}%)`,
              `hsl(${78 + Math.sin(grass.id * 1.2) * 12}, ${45 + farmData.nutrients.nitrogen / 5}%, ${22 + farmData.soilMoisture / 10}%)`
            ];
            
            const grassColor = grassColors[grass.id % 3];
            
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
                      color={`hsl(${88 + Math.sin(grass.id) * 25}, 70%, 42%)`}
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
          {Array.from({ length: 80 }, (_, i) => ( // Increased from 60 to 80 seeds for massive field
            <Sphere 
              key={`seed-${i}`}
              args={[0.025]} // Slightly larger seeds
              position={[
                (Math.random() - 0.5) * fieldWidth * 0.8,
                -0.05,
                (Math.random() - 0.5) * fieldDepth * 0.8
              ]}
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
          {Array.from({ length: Math.floor(stage * 8) }, (_, i) => ( // Increased from stage * 6 to stage * 8 for massive field coverage
            <Box
              key={`sprout-${i}`}
              args={[0.02, stage * 0.02, 0.015]} // Made sprouts thicker
              position={[
                (Math.random() - 0.5) * fieldWidth * 0.9,
                stage * 0.01,
                (Math.random() - 0.5) * fieldDepth * 0.9
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
          {Array.from({ length: 8 }, (_, i) => (
            <Sphere key={`heat-${i}`} args={[0.02]} position={[
              (Math.random() - 0.5) * fieldWidth,
              maxGrassHeight + Math.random() * 0.5,
              (Math.random() - 0.5) * fieldDepth
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
          {Array.from({ length: 12 }, (_, i) => (
            <Sphere key={`growth-${i}`} args={[0.015]} position={[
              (Math.random() - 0.5) * fieldWidth,
              Math.random() * maxGrassHeight + 0.5,
              (Math.random() - 0.5) * fieldDepth
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
      
      {/* Dynamic environment based on weather */}
      <Environment 
        preset={
          farmData.weatherToday === 'Sunny' ? 'sunset' :
          farmData.weatherToday === 'Cloudy' ? 'dawn' :
          farmData.weatherToday === 'Rainy' ? 'storm' : 'park'
        } 
      />
    </>
  );
}

const CropSimulation = () => {
  // Real crop simulation state - grows based on user interactions
  const [cropStage, setCropStage] = useState(0); // 0-100% (starts from 0)
  const [daysSincePlanting, setDaysSincePlanting] = useState(0);
  const [lastActivity, setLastActivity] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      text: "Welcome to your Virtual Farm! 🌱 I see you've just planted your seeds. I'll help you take care of your crop as it grows. Ask me about watering, fertilizing, or any farming questions!",
      isBot: true,
      timestamp: new Date()
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [dailyActivities, setDailyActivities] = useState([]);

  // Realistic farm data that updates based on user activities
  const [farmData, setFarmData] = useState({
    lastIrrigated: 'Never',
    lastFertilized: 'Never',
    lastSowed: 'Today',
    currentTemp: 28,
    humidity: 65,
    soilMoisture: 45, // Starts lower, needs irrigation
    cropStage: 'Just Planted',
    expectedHarvest: '90-120 days',
    weatherToday: 'Sunny',
    forecast: [
      { day: 'Today', icon: FaSun, temp: 28, condition: 'Sunny' },
      { day: 'Tomorrow', icon: FaCloud, temp: 26, condition: 'Cloudy' },
      { day: 'Day 3', icon: FaCloudRain, temp: 24, condition: 'Rainy' },
      { day: 'Day 4', icon: FaSun, temp: 29, condition: 'Sunny' },
      { day: 'Day 5', icon: FaWind, temp: 27, condition: 'Windy' }
    ],
    nutrients: {
      nitrogen: 60, // Starts moderate, needs fertilizing
      phosphorus: 55,
      potassium: 65
    },
    pests: {
      detected: false,
      risk: 'Low',
      lastChecked: 'Never'
    },
    irrigation: {
      nextScheduled: 'Needs scheduling',
      totalWaterUsed: '0 L',
      efficiency: '0%'
    },
    plantHealth: 'Newly Planted',
    growthRate: 'Awaiting Care'
  });

  // Simulate realistic crop growth based on activities and care
  const simulateCropGrowth = (activity) => {
    let growthBoost = 0;
    let updatedFarmData = { ...farmData };
    
    switch (activity) {
      case 'irrigation':
        growthBoost = farmData.soilMoisture < 50 ? 3 : 1;
        updatedFarmData.soilMoisture = Math.min(100, farmData.soilMoisture + 25);
        updatedFarmData.lastIrrigated = 'Today';
        updatedFarmData.totalWaterUsed = (parseInt(farmData.irrigation.totalWaterUsed) + 50) + ' L';
        break;
      case 'fertilization':
        growthBoost = 4;
        updatedFarmData.nutrients.nitrogen = Math.min(100, farmData.nutrients.nitrogen + 20);
        updatedFarmData.nutrients.phosphorus = Math.min(100, farmData.nutrients.phosphorus + 15);
        updatedFarmData.nutrients.potassium = Math.min(100, farmData.nutrients.potassium + 10);
        updatedFarmData.lastFertilized = 'Today';
        break;
      case 'pest_check':
        growthBoost = 1;
        updatedFarmData.pests.lastChecked = 'Today';
        break;
      case 'daily_care':
        growthBoost = 2;
        break;
      default:
        growthBoost = 0.5; // Natural growth from interaction
    }
    
    // Update crop stage with realistic growth
    const newStage = Math.min(100, cropStage + growthBoost);
    setCropStage(newStage);
    
    // Update farm stage description
    if (newStage < 10) {
      updatedFarmData.cropStage = 'Germination';
      updatedFarmData.expectedHarvest = '85-110 days';
    } else if (newStage < 25) {
      updatedFarmData.cropStage = 'Seedling';
      updatedFarmData.expectedHarvest = '70-95 days';
    } else if (newStage < 45) {
      updatedFarmData.cropStage = 'Vegetative Growth';
      updatedFarmData.expectedHarvest = '50-75 days';
    } else if (newStage < 65) {
      updatedFarmData.cropStage = 'Tillering';
      updatedFarmData.expectedHarvest = '30-55 days';
    } else if (newStage < 85) {
      updatedFarmData.cropStage = 'Flowering';
      updatedFarmData.expectedHarvest = '15-30 days';
    } else if (newStage < 100) {
      updatedFarmData.cropStage = 'Grain Filling';
      updatedFarmData.expectedHarvest = '5-15 days';
    } else {
      updatedFarmData.cropStage = 'Ready for Harvest!';
      updatedFarmData.expectedHarvest = 'Now!';
    }
    
    // Natural degradation over time
    updatedFarmData.soilMoisture = Math.max(30, updatedFarmData.soilMoisture - 2);
    updatedFarmData.nutrients.nitrogen = Math.max(40, updatedFarmData.nutrients.nitrogen - 1);
    
    setFarmData(updatedFarmData);
    return growthBoost;
  };

  // Remove the old animation logic and replace with realistic growth
  useEffect(() => {
    // Natural daily progression (very slow)
    const interval = setInterval(() => {
      if (cropStage < 100) {
        setCropStage(prev => Math.min(100, prev + 0.1)); // Very slow natural growth
        setDaysSincePlanting(prev => prev + 1);
      }
    }, 30000); // Every 30 seconds represents a day

    return () => clearInterval(interval);
  }, [cropStage]);

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

    // Process user activities and generate contextual responses
    setTimeout(() => {
      let botResponse = "I'm here to help with your farming needs!";
      let activity = null;
      let growthBoost = 0;
      
      const message = currentMessage.toLowerCase();
      
      // Detect farming activities
      if (message.includes('water') || message.includes('irrigat')) {
        activity = 'irrigation';
        growthBoost = simulateCropGrowth(activity);
        botResponse = `Great! I've helped you water your crops. 💧 Your soil moisture increased to ${farmData.soilMoisture + 25}%. This boosted growth by ${growthBoost}%! Your crops are looking healthier now.`;
        setLastActivity('Watered crops');
      } else if (message.includes('fertiliz') || message.includes('nutrient') || message.includes('feed')) {
        activity = 'fertilization';
        growthBoost = simulateCropGrowth(activity);
        botResponse = `Excellent! I've applied fertilizer to your crops. 🌱 Nutrient levels have improved significantly. This gave your crops a big growth boost of ${growthBoost}%! Remember to fertilize regularly for optimal growth.`;
        setLastActivity('Applied fertilizer');
      } else if (message.includes('pest') || message.includes('check') || message.includes('inspect')) {
        activity = 'pest_check';
        growthBoost = simulateCropGrowth(activity);
        botResponse = `Good farming practice! 🔍 I've helped you check for pests and diseases. Everything looks healthy! Regular inspection is key to preventing problems. Growth boost: ${growthBoost}%.`;
        setLastActivity('Pest inspection');
      } else if (message.includes('care') || message.includes('tend') || message.includes('maintain')) {
        activity = 'daily_care';
        growthBoost = simulateCropGrowth(activity);
        botResponse = `Wonderful! Daily care makes all the difference. 🚜 Your attentive farming has boosted growth by ${growthBoost}%. Keep up the great work!`;
        setLastActivity('General crop care');
      } else if (message.includes('health') || message.includes('how') || message.includes('doing')) {
        growthBoost = simulateCropGrowth('interaction');
        if (cropStage < 10) {
          botResponse = `Your crops are in early germination (${Math.round(cropStage)}% grown). They need consistent moisture and patience. Consider watering if soil moisture is below 60%.`;
        } else if (cropStage < 25) {
          botResponse = `Seedling stage looks promising! ${Math.round(cropStage)}% growth. Your young plants are establishing roots. Keep soil moist but not waterlogged.`;
        } else if (cropStage < 45) {
          botResponse = `Vegetative growth is excellent! ${Math.round(cropStage)}% complete. This is when nitrogen is crucial for leaf development. Consider fertilizing soon.`;
        } else if (cropStage < 65) {
          botResponse = `Tillering stage - your crops are branching out! ${Math.round(cropStage)}% grown. Balanced nutrients and consistent water are key now.`;
        } else if (cropStage < 85) {
          botResponse = `Flowering stage! ${Math.round(cropStage)}% complete. This is critical - maintain consistent moisture and protect from pests. Phosphorus is especially important now.`;
        } else if (cropStage < 100) {
          botResponse = `Grain filling stage - almost there! ${Math.round(cropStage)}% grown. Monitor moisture carefully and prepare for harvest planning.`;
        } else {
          botResponse = `🎉 Congratulations! Your crops are fully mature and ready for harvest! This has been an excellent growing season.`;
        }
      } else if (message.includes('weather') || message.includes('forecast')) {
        botResponse = `Current conditions: ${farmData.weatherToday} at ${Math.round(farmData.currentTemp)}°C. Tomorrow will be ${farmData.forecast[1].condition}. ${farmData.forecast[1].condition === 'Rainy' ? 'You might not need to water tomorrow!' : 'Plan your watering schedule accordingly.'}`;
      } else {
        // Default encouraging response that still provides growth
        growthBoost = simulateCropGrowth('interaction');
        const responses = [
          `Every question helps you become a better farmer! Your engagement boosted growth by ${growthBoost}%. Current stage: ${farmData.cropStage} (${Math.round(cropStage)}%).`,
          `Your attention to your crops is wonderful! Growth increased by ${growthBoost}%. Soil moisture: ${farmData.soilMoisture}%, Temperature: ${Math.round(farmData.currentTemp)}°C.`,
          `Keep asking questions - it shows you care about your crops! +${growthBoost}% growth. Your ${farmData.cropStage.toLowerCase()} stage plants appreciate the attention.`,
          `Great farming mindset! Your crops grew ${growthBoost}% from your care and attention. Days since planting: ${daysSincePlanting}.`
        ];
        botResponse = responses[Math.floor(Math.random() * responses.length)];
      }

      // Add activity to daily log
      if (activity && lastActivity) {
        setDailyActivities(prev => [...prev, {
          activity: lastActivity,
          timestamp: new Date(),
          growthImpact: growthBoost
        }]);
      }

      const botMessage = {
        id: Date.now() + 1,
        text: botResponse,
        isBot: true,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, botMessage]);
      setIsChatTyping(false);
    }, 1500);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.25, 0.25, 0.75]
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-yellow-50 pt-24 pb-8">
      <div className="container mx-auto px-4 h-full">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full"
        >
          {/* Main Simulation Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header */}
            <motion.div variants={itemVariants} className="text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
                Virtual Crop Simulation
              </h1>
              <p className="text-gray-600">
                Watch your crops grow in real-time with AI-powered farming insights
              </p>
            </motion.div>

            {/* Real Crop Growth Visualization */}
            <motion.div
              variants={itemVariants}
              className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-6 h-96"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Your Virtual Wheat Field</h2>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 px-3 py-2 bg-blue-100 rounded-xl">
                    <FaCalendarAlt className="text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Day {daysSincePlanting}</span>
                  </div>
                  <div className="flex items-center space-x-2 px-3 py-2 bg-green-100 rounded-xl">
                    <FaSeedling className="text-green-600" />
                    <span className="text-sm font-medium text-green-800">{farmData.cropStage}</span>
                  </div>
                </div>
              </div>
              
              <div className="w-full h-64 rounded-xl overflow-hidden bg-gradient-to-b from-sky-200 to-green-100">
                <Canvas
                  camera={{ position: [0, 3, 7], fov: 60 }}
                  shadows
                  className="w-full h-full"
                >
                  <Suspense fallback={
                    <Text position={[0, 0, 0]} fontSize={0.5} color="green">
                      Growing Your Farm...
                    </Text>
                  }>
                    <CropScene stage={cropStage} farmData={farmData} />
                  </Suspense>
                </Canvas>
              </div>
              
              <div className="mt-4 bg-gray-100 rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">Growth Progress</span>
                  <span className="text-sm font-bold text-green-600">{Math.round(cropStage)}%</span>
                </div>
                <div className="w-full bg-gray-300 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${cropStage}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  {cropStage < 10 && "🌱 Seeds are germinating..."}
                  {cropStage >= 10 && cropStage < 25 && "🌿 Young seedlings emerging"}
                  {cropStage >= 25 && cropStage < 45 && "� Vegetative growth phase"}
                  {cropStage >= 45 && cropStage < 65 && "� Tillering and branching"}
                  {cropStage >= 65 && cropStage < 85 && "🌸 Flowering beautifully"}
                  {cropStage >= 85 && cropStage < 100 && "🌾 Grains are filling"}
                  {cropStage >= 100 && "🎉 Ready for harvest!"}
                </div>
                {lastActivity && (
                  <div className="mt-2 text-xs text-blue-600 text-center">
                    Last activity: {lastActivity}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Dashboard */}
            <motion.div
              variants={itemVariants}
              className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-6"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-6">Farm Dashboard</h2>
              
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl p-4 text-center">
                  <FaTemperatureHigh className="text-2xl text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Temperature</p>
                  <p className="text-xl font-bold text-blue-800">{Math.round(farmData.currentTemp)}°C</p>
                </div>
                
                <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-xl p-4 text-center">
                  <FaTint className="text-2xl text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Soil Moisture</p>
                  <p className="text-xl font-bold text-green-800">{farmData.soilMoisture}%</p>
                </div>
                
                <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-xl p-4 text-center">
                  <FaSeedling className="text-2xl text-yellow-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Days Old</p>
                  <p className="text-xl font-bold text-yellow-800">{daysSincePlanting}</p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl p-4 text-center">
                  <FaCalendarAlt className="text-2xl text-purple-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Harvest In</p>
                  <p className="text-sm font-bold text-purple-800">{farmData.expectedHarvest}</p>
                </div>

                <div className="bg-gradient-to-br from-red-100 to-red-200 rounded-xl p-4 text-center">
                  <FaChartLine className="text-2xl text-red-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Growth</p>
                  <p className="text-xl font-bold text-red-800">{Math.round(cropStage)}%</p>
                </div>

                <div className="bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl p-4 text-center">
                  <FaRobot className="text-2xl text-indigo-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Health</p>
                  <p className="text-xs font-bold text-indigo-800">{farmData.plantHealth}</p>
                </div>
              </div>

              {/* Detailed Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Farm Activities */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Recent Activities</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center space-x-3">
                        <FaTint className="text-blue-500" />
                        <span className="text-sm">Last Irrigated</span>
                      </div>
                      <span className="text-sm font-medium text-gray-600">{farmData.lastIrrigated}</span>
                    </div>
                    
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center space-x-3">
                        <FaSeedling className="text-green-500" />
                        <span className="text-sm">Last Fertilized</span>
                      </div>
                      <span className="text-sm font-medium text-gray-600">{farmData.lastFertilized}</span>
                    </div>

                    <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center space-x-3">
                        <FaChartLine className="text-purple-500" />
                        <span className="text-sm">Growth Rate</span>
                      </div>
                      <span className="text-sm font-medium text-green-600">{farmData.growthRate}</span>
                    </div>
                  </div>
                </div>

                {/* Weather Forecast */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">5-Day Forecast</h3>
                  <div className="space-y-2">
                    {farmData.forecast.map((day, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center space-x-3">
                          <day.icon className="text-yellow-500" />
                          <span className="text-sm">{day.day}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{day.temp}°C</p>
                          <p className="text-xs text-gray-500">{day.condition}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Irrigation & Alerts */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">System Status</h3>
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-green-800">Irrigation System</span>
                      </div>
                      <p className="text-xs text-green-600">Next: {farmData.irrigation.nextScheduled}</p>
                    </div>

                    <div className={`${farmData.pests.detected ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border rounded-xl p-3`}>
                      <div className="flex items-center space-x-2 mb-2">
                        <div className={`w-3 h-3 ${farmData.pests.detected ? 'bg-red-500' : 'bg-blue-500'} rounded-full`}></div>
                        <span className={`text-sm font-medium ${farmData.pests.detected ? 'text-red-800' : 'text-blue-800'}`}>
                          Pest Detection
                        </span>
                      </div>
                      <p className={`text-xs ${farmData.pests.detected ? 'text-red-600' : 'text-blue-600'}`}>
                        Risk: {farmData.pests.risk} | Checked: {farmData.pests.lastChecked}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>Total Water Used: {farmData.irrigation.totalWaterUsed}</p>
                        <p>AI Recommendations: Active</p>
                        <p>Sensor Status: Online</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nutrient Levels */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Soil Nutrients</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(farmData.nutrients).map(([nutrient, level]) => (
                    <div key={nutrient} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-600 capitalize">{nutrient}</span>
                        <span className="text-sm font-bold text-green-600">{level}%</span>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full"
                          style={{ width: `${level}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Chatbot Sidebar */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-1 bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-4 h-fit lg:sticky lg:top-24"
          >
            <div className="flex items-center space-x-3 mb-4 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                <FaRobot className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Farm AI Assistant</h3>
                <p className="text-xs text-green-600">Online</p>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="h-64 overflow-y-auto mb-4 space-y-3">
              <AnimatePresence>
                {chatMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-xl text-sm ${
                        message.isBot
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-green-500 text-white'
                      }`}
                    >
                      {message.text}
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
                  <div className="bg-gray-100 p-3 rounded-xl">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about your crops..."
                className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
              <button
                onClick={handleSendMessage}
                className="p-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors duration-300"
              >
                <FaPaperPlane />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-500 mb-2">Farm Actions:</p>
              {[
                "Water my crops",
                "Apply fertilizer", 
                "Check for pests",
                "How are my crops doing?",
                "Check weather forecast",
                "Give daily care"
              ].map((question, index) => (
                <button
                  key={index}
                  onClick={() => setNewMessage(question)}
                  className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-gray-600 transition-colors duration-300"
                >
                  {question}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default CropSimulation;
