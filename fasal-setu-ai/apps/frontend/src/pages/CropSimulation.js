import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import { cropAPI, authAPI } from '../services/api'; // Import API service
import { useAuth } from '../contexts/AuthContext'; // Import auth context
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
    const windStrength = (farmData.forecast[0]?.condition === 'Windy') ? 0.6 : 0.3;
    const windSpeed = (farmData.forecast[0]?.condition === 'Windy') ? 1.5 : 1.0;
    
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
        {farmData.soilMoisture !== null && farmData.soilMoisture > 70 && Array.from({ length: 15 }, (_, i) => (
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
            const moistureValue = farmData.soilMoisture || 50; // Use default value of 50 if null
            const grassColors = [
              `hsl(${85 + Math.sin(grass.id) * 10}, ${50 + farmData.nutrients.nitrogen / 3}%, ${25 + moistureValue / 8}%)`,
              `hsl(${95 + Math.sin(grass.id * 0.7) * 15}, ${55 + farmData.nutrients.nitrogen / 4}%, ${30 + moistureValue / 6}%)`,
              `hsl(${78 + Math.sin(grass.id * 1.2) * 12}, ${45 + farmData.nutrients.nitrogen / 5}%, ${22 + moistureValue / 10}%)`
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
      
      {/* Dynamic lighting based on weather */}
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
      {/* Additional point light for better illumination */}
      <pointLight position={[-10, 10, -10]} intensity={0.3} />
      
      {/* Simple sky gradient background */}
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
  
  // Debug: Log the received parameters
  useEffect(() => {
    console.log('CropSimulation - Crop ID:', cropId);
    console.log('CropSimulation - Initial Growth:', initialGrowthPercent);
  }, [cropId, initialGrowthPercent]);
  
  // Real crop simulation state - grows based on user interactions
  const [cropStage, setCropStage] = useState(initialGrowthPercent); // Set from URL parameter or default to 0
  const [daysSincePlanting, setDaysSincePlanting] = useState(0);
  const [lastActivity, setLastActivity] = useState(null);
  const [harvestData, setHarvestData] = useState(null); // New state for harvest estimation
  const [isLoadingHarvest, setIsLoadingHarvest] = useState(false); // Loading state
  const [weatherData, setWeatherData] = useState(null); // Weather data from API
  const [isLoadingWeather, setIsLoadingWeather] = useState(false); // Weather loading state
  const [weatherError, setWeatherError] = useState(null); // Weather error state
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

  // Function to process weather data into forecast array
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

  // Realistic farm data that updates based on user activities
  const [farmData, setFarmData] = useState({
    lastIrrigated: 'Never',
    lastFertilized: 'Never',
    lastSowed: 'Today',
    currentTemp: null, // Will be populated by weather API
    soilTemp: null, // Will be populated by weather API  
    humidity: 65,
    soilMoisture: null, // Will be populated by weather API
    cropStage: 'Just Planted',
    expectedHarvest: isLoadingHarvest ? 'Loading...' : (harvestData ? `${harvestData.days_remaining} days` : 'Calculating...'),
    weatherToday: 'Loading...',
    forecast: [
      { condition: 'Sunny', temp: 25, day: 'Loading...', icon: FaSun },
      { condition: 'Sunny', temp: 25, day: 'Loading...', icon: FaSun }
    ], // Start with default data to prevent errors
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

  // Fetch harvest estimation data
  useEffect(() => {
    const fetchHarvestData = async () => {
      if (!cropId) return;
      
      setIsLoadingHarvest(true);
      try {
        const response = await cropAPI.getHarvestEstimate(cropId);
        if (response.success) {
          setHarvestData(response.data);
          // Update days since planting from API data
          setDaysSincePlanting(response.data.days_since_sowing);
          // Update crop stage from API if different
          setCropStage(response.data.growth_percentage);
          console.log('Harvest data loaded:', response.data);
        }
      } catch (error) {
        console.error('Failed to fetch harvest data:', error);
        // Set fallback data based on crop growth stage
        const estimatedDays = Math.max(1, Math.round((100 - initialGrowthPercent) * 1.2));
        setHarvestData({
          days_remaining: estimatedDays,
          estimated_harvest_date: new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          growth_percentage: initialGrowthPercent,
          status: 'growing',
          crop_name: 'Unknown'
        });
      } finally {
        setIsLoadingHarvest(false);
      }
    };

    fetchHarvestData();
  }, [cropId, initialGrowthPercent]);

  // Update farm data when harvest data is loaded
  useEffect(() => {
    if (harvestData) {
      setFarmData(prev => ({
        ...prev,
        expectedHarvest: harvestData.status === 'ready_for_harvest' ? 'Ready Now!' : `${harvestData.days_remaining} days`,
        cropStage: harvestData.status === 'ready_for_harvest' ? 'Ready for Harvest!' : 
                  harvestData.growth_percentage < 10 ? 'Germination' :
                  harvestData.growth_percentage < 25 ? 'Seedling' :
                  harvestData.growth_percentage < 45 ? 'Vegetative Growth' :
                  harvestData.growth_percentage < 65 ? 'Tillering' :
                  harvestData.growth_percentage < 85 ? 'Flowering' :
                  harvestData.growth_percentage < 100 ? 'Grain Filling' : 'Ready for Harvest!'
      }));
    }
  }, [harvestData]);

  // Natural daily progression (very slow)
  useEffect(() => {
    const interval = setInterval(() => {
      if (cropStage < 100) {
        setCropStage(prev => Math.min(100, prev + 0.1)); // Very slow natural growth
        setDaysSincePlanting(prev => prev + 1);
      }
    }, 30000); // Every 30 seconds represents a day

    return () => clearInterval(interval);
  }, [cropStage]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

  // Simulate realistic crop growth based on activities and care
  const simulateCropGrowth = (activity) => {
    let growthBoost = 0;
    let updatedFarmData = { ...farmData };
    
    switch (activity) {
      case 'irrigation':
        const currentMoisture = farmData.soilMoisture || 50; // Use API value or default
        growthBoost = currentMoisture < 50 ? 3 : 1;
        updatedFarmData.soilMoisture = Math.min(100, currentMoisture + 25);
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
    
    // Update farm stage description with real data
    const daysRemaining = harvestData ? harvestData.days_remaining : Math.max(1, Math.round((100 - newStage) * 1.2));
    if (newStage < 10) {
      updatedFarmData.cropStage = 'Germination';
      updatedFarmData.expectedHarvest = harvestData ? `${daysRemaining} days` : `${daysRemaining} days (estimated)`;
    } else if (newStage < 25) {
      updatedFarmData.cropStage = 'Seedling';
      updatedFarmData.expectedHarvest = harvestData ? `${daysRemaining} days` : `${daysRemaining} days (estimated)`;
    } else if (newStage < 45) {
      updatedFarmData.cropStage = 'Vegetative Growth';
      updatedFarmData.expectedHarvest = harvestData ? `${daysRemaining} days` : `${daysRemaining} days (estimated)`;
    } else if (newStage < 65) {
      updatedFarmData.cropStage = 'Tillering';
      updatedFarmData.expectedHarvest = harvestData ? `${daysRemaining} days` : `${daysRemaining} days (estimated)`;
    } else if (newStage < 85) {
      updatedFarmData.cropStage = 'Flowering';
      updatedFarmData.expectedHarvest = harvestData ? `${daysRemaining} days` : `${daysRemaining} days (estimated)`;
    } else if (newStage < 100) {
      updatedFarmData.cropStage = 'Grain Filling';
      updatedFarmData.expectedHarvest = harvestData ? `${daysRemaining} days` : `${daysRemaining} days (estimated)`;
    } else {
      updatedFarmData.cropStage = 'Ready for Harvest!';
      updatedFarmData.expectedHarvest = harvestData?.status === 'ready_for_harvest' ? 'Now!' : 'Now!';
    }
    
    // Natural degradation over time - only if soil moisture is available from API
    if (updatedFarmData.soilMoisture !== null) {
      updatedFarmData.soilMoisture = Math.max(30, updatedFarmData.soilMoisture - 2);
    }
    updatedFarmData.nutrients.nitrogen = Math.max(40, updatedFarmData.nutrients.nitrogen - 1);
    
    setFarmData(updatedFarmData);
    return growthBoost;
  };

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
        const newMoisture = (farmData.soilMoisture || 50) + 25;
        botResponse = `Great! I've helped you water your crops. 💧 Your soil moisture increased to ${newMoisture}%. This boosted growth by ${growthBoost}%! Your crops are looking healthier now.`;
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
        const daysLeft = harvestData ? harvestData.days_remaining : Math.max(0, 100 - cropStage);
        const harvestDate = harvestData ? new Date(harvestData.estimated_harvest_date).toLocaleDateString() : 'Soon';
        
        if (cropStage < 10) {
          botResponse = `Your crops are in early germination (${Math.round(cropStage)}% grown). Expected harvest in ${daysLeft} days (${harvestDate}). They need consistent moisture and patience. Consider watering if soil moisture is below 60%.`;
        } else if (cropStage < 25) {
          botResponse = `Seedling stage looks promising! ${Math.round(cropStage)}% growth. Harvest expected in ${daysLeft} days (${harvestDate}). Your young plants are establishing roots. Keep soil moist but not waterlogged.`;
        } else if (cropStage < 45) {
          botResponse = `Vegetative growth is excellent! ${Math.round(cropStage)}% complete. Expected harvest: ${daysLeft} days (${harvestDate}). This is when nitrogen is crucial for leaf development. Consider fertilizing soon.`;
        } else if (cropStage < 65) {
          botResponse = `Tillering stage - your crops are branching out! ${Math.round(cropStage)}% grown. Harvest in ${daysLeft} days (${harvestDate}). Balanced nutrients and consistent water are key now.`;
        } else if (cropStage < 85) {
          botResponse = `Flowering stage! ${Math.round(cropStage)}% complete. Expected harvest: ${daysLeft} days (${harvestDate}). This is critical - maintain consistent moisture and protect from pests. Phosphorus is especially important now.`;
        } else if (cropStage < 100) {
          botResponse = `Grain filling stage - almost there! ${Math.round(cropStage)}% grown. Harvest in just ${daysLeft} days (${harvestDate})! Monitor moisture carefully and prepare for harvest planning.`;
        } else {
          botResponse = `🎉 Congratulations! Your crops are fully mature and ${harvestData?.status === 'ready_for_harvest' ? 'ready for harvest NOW' : 'ready for harvest'}! This has been an excellent growing season.`;
        }
      } else if (message.includes('harvest') || message.includes('when') || message.includes('ready')) {
        growthBoost = simulateCropGrowth('interaction');
        if (harvestData) {
          if (harvestData.status === 'ready_for_harvest') {
            botResponse = `🎉 Great news! Your crops are ready for harvest RIGHT NOW! You've reached 100% maturity. Time to reap what you've sown!`;
          } else {
            const harvestDate = new Date(harvestData.estimated_harvest_date).toLocaleDateString();
            botResponse = `🗓️ Based on your crop's progress, harvest is expected in ${harvestData.days_remaining} days (${harvestDate}). Your crop is currently ${Math.round(harvestData.growth_percentage)}% mature. Keep up the good care!`;
          }
        } else {
          botResponse = `📊 Your crops are ${Math.round(cropStage)}% mature. ${harvestData ? `Expected harvest in ${harvestData.days_remaining} days` : 'Harvest timing will be calculated once crop data is loaded'}. Keep watering and fertilizing for optimal results!`;
        }
      } else if (message.includes('weather') || message.includes('forecast')) {
        const tomorrowCondition = farmData.forecast[1]?.condition || 'unknown';
        botResponse = `Current conditions: ${farmData.weatherToday} at ${farmData.currentTemp ? Math.round(farmData.currentTemp) + '°C' : 'loading...'}. Tomorrow will be ${tomorrowCondition}. ${tomorrowCondition === 'Rainy' ? 'You might not need to water tomorrow!' : 'Plan your watering schedule accordingly.'}`;
      } else {
        // Default encouraging response that still provides growth
        growthBoost = simulateCropGrowth('interaction');
        const responses = [
          `Every question helps you become a better farmer! Your engagement boosted growth by ${growthBoost}%. Current stage: ${farmData.cropStage} (${Math.round(cropStage)}%).`,
          `Your attention to your crops is wonderful! Growth increased by ${growthBoost}%. Soil moisture: ${farmData.soilMoisture !== null ? farmData.soilMoisture + '%' : 'loading...'}, Temperature: ${farmData.currentTemp ? Math.round(farmData.currentTemp) + '°C' : 'loading...'}.`,
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-yellow-50 pt-20 sm:pt-24 pb-4 sm:pb-8">
      <div className="container mx-auto px-2 sm:px-4 h-full max-w-full overflow-hidden">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="space-y-4 sm:space-y-6 lg:grid lg:grid-cols-4 lg:gap-4 xl:gap-6 lg:space-y-0 h-full"
        >
          {/* Main Content Area - Reordered for mobile */}
          <div className="lg:col-span-3 space-y-4 sm:space-y-6 lg:order-1">
            {/* Header */}
            <motion.div variants={itemVariants} className="text-center px-2 sm:px-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-2">
                Virtual Crop Simulation
              </h1>
              {cropId && (
                <div className="bg-white/80 backdrop-blur-sm rounded-lg px-3 sm:px-4 py-2 mx-auto max-w-sm sm:max-w-md border border-green-200">
                  <p className="text-xs sm:text-sm text-gray-600">
                    <span className="font-medium">Crop ID:</span> {cropId}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600">
                    <span className="font-medium">Starting Growth:</span> {initialGrowthPercent}%
                  </p>
                  {isLoadingHarvest ? (
                    <div className="mt-2">
                      <LoadingSkeleton className="w-32 h-3 mx-auto" />
                    </div>
                  ) : harvestData && (
                    <p className="text-xs sm:text-sm text-gray-600">
                      <span className="font-medium">Crop:</span> {harvestData.crop_name || 'Loading...'}
                    </p>
                  )}
                </div>
              )}
              <p className="text-sm sm:text-base text-gray-600 px-2 sm:px-0">
                Watch your crops grow in real-time with AI-powered farming insights
              </p>
            </motion.div>

            {/* Real Crop Growth Visualization */}
            <motion.div
              variants={itemVariants}
              className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl border border-gray-200/50 p-3 sm:p-4 lg:p-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 space-y-2 sm:space-y-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800">Your Virtual Wheat Field</h2>
                <div className="flex flex-wrap items-center gap-2 sm:space-x-3 w-full sm:w-auto">
                  <div className="flex items-center space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-100 rounded-lg sm:rounded-xl text-xs sm:text-sm">
                    <FaCalendarAlt className="text-blue-600 text-xs sm:text-sm" />
                    <span className="font-medium text-blue-800">Day {daysSincePlanting}</span>
                  </div>
                  <div className="flex items-center space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-100 rounded-lg sm:rounded-xl text-xs sm:text-sm">
                    <FaSeedling className="text-green-600 text-xs sm:text-sm" />
                    <span className="font-medium text-green-800 truncate max-w-24 sm:max-w-none">{farmData.cropStage}</span>
                  </div>
                </div>
              </div>
              
              <div className="w-full h-48 sm:h-56 md:h-64 lg:h-72 rounded-lg sm:rounded-xl overflow-hidden bg-gradient-to-b from-sky-200 to-green-100 relative">
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
              
              <div className="mt-3 sm:mt-4 bg-gray-100 rounded-lg sm:rounded-xl p-2 sm:p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs sm:text-sm font-medium text-gray-600">Growth Progress</span>
                  <span className="text-xs sm:text-sm font-bold text-green-600">{Math.round(cropStage)}%</span>
                </div>
                <div className="w-full bg-gray-300 rounded-full h-1.5 sm:h-2">
                  <div
                    className="bg-gradient-to-r from-green-400 to-green-600 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                    style={{ width: `${cropStage}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  {cropStage < 10 && "🌱 Seeds are germinating..."}
                  {cropStage >= 10 && cropStage < 25 && "🌿 Young seedlings emerging"}
                  {cropStage >= 25 && cropStage < 45 && "🌱 Vegetative growth phase"}
                  {cropStage >= 45 && cropStage < 65 && "🌿 Tillering and branching"}
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
          </div>

          {/* Chatbot Sidebar - Mobile-optimized */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-1 lg:order-2 bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl border border-gray-200/50 p-3 sm:p-4 h-fit lg:sticky lg:top-24"
          >
            <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-gray-200">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <FaRobot className="text-white text-sm sm:text-base" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-800 text-sm sm:text-base truncate">Farm AI Assistant</h3>
                <p className="text-xs text-green-600">Online</p>
              </div>
            </div>

            {/* Chat Messages - Mobile-optimized height */}
            <div className="h-48 sm:h-56 md:h-64 overflow-y-auto mb-3 sm:mb-4 space-y-2 sm:space-y-3 pr-1">
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
                      className={`max-w-[85%] sm:max-w-[80%] p-2 sm:p-3 rounded-lg sm:rounded-xl text-xs sm:text-sm break-words ${
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
                  <div className="bg-gray-100 p-2 sm:p-3 rounded-lg sm:rounded-xl">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Chat Input - Mobile-optimized */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about your crops..."
                className="flex-1 min-w-0 px-2 sm:px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-xs sm:text-sm"
              />
              <button
                onClick={handleSendMessage}
                className="p-2 bg-green-500 text-white rounded-lg sm:rounded-xl hover:bg-green-600 transition-colors duration-300 flex-shrink-0"
              >
                <FaPaperPlane className="text-xs sm:text-sm" />
              </button>
            </div>

            {/* Quick Actions - Mobile-optimized */}
            <div className="mt-3 sm:mt-4 space-y-1 sm:space-y-2">
              <p className="text-xs text-gray-500 mb-2">Farm Actions:</p>
              <div className="max-h-32 sm:max-h-40 overflow-y-auto space-y-1 sm:space-y-2">
                {[
                  "Water my crops",
                  "Apply fertilizer", 
                  "Check for pests",
                  "How are my crops doing?",
                  "When will harvest be ready?",
                  "Check weather forecast",
                  "Give daily care"
                ].map((question, index) => (
                  <button
                    key={index}
                    onClick={() => setNewMessage(question)}
                    className="w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 hover:bg-gray-100 rounded-md sm:rounded-lg text-xs text-gray-600 transition-colors duration-300 truncate"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Detailed Dashboard - Mobile-optimized */}
          <div className="lg:col-span-3 lg:order-3">
            {/* Dashboard */}
            <motion.div
              variants={itemVariants}
              className="bg-white/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl border border-gray-200/50 p-3 sm:p-4 lg:p-6"
            >
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6">Farm Insights</h2>
              
              {/* Key Metrics - Mobile-first grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6">
                <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 text-center">
                  <FaTemperatureHigh className="text-lg sm:text-xl lg:text-2xl text-blue-600 mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs text-gray-600">Temperature</p>
                  {farmData.currentTemp !== null ? (
                    <p className="text-sm sm:text-lg lg:text-xl font-bold text-blue-800">{Math.round(farmData.currentTemp)}°C</p>
                  ) : (
                    <div className="h-5 sm:h-6 lg:h-7 bg-blue-200 rounded animate-pulse"></div>
                  )}
                </div>
                
                <div className="bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 text-center">
                  <FaTint className="text-lg sm:text-xl lg:text-2xl text-amber-600 mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs text-gray-600">Soil Moisture</p>
                  {farmData.soilMoisture !== null ? (
                    <p className="text-sm sm:text-lg lg:text-xl font-bold text-amber-800">{farmData.soilMoisture}%</p>
                  ) : (
                    <div className="h-5 sm:h-6 lg:h-7 bg-amber-200 rounded animate-pulse"></div>
                  )}
                </div>
                
                <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 text-center">
                  <FaTemperatureHigh className="text-lg sm:text-xl lg:text-2xl text-orange-600 mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs text-gray-600">Soil Temp</p>
                  {farmData.soilTemp !== null ? (
                    <p className="text-sm sm:text-lg lg:text-xl font-bold text-orange-800">{farmData.soilTemp}°C</p>
                  ) : (
                    <div className="h-5 sm:h-6 lg:h-7 bg-orange-200 rounded animate-pulse"></div>
                  )}
                </div>
                
                <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 text-center">
                  <FaSeedling className="text-lg sm:text-xl lg:text-2xl text-yellow-600 mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs text-gray-600">Days Old</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-yellow-800">
                    {isLoadingHarvest ? (
                      <LoadingSkeleton className="w-6 sm:w-8 h-4 sm:h-6 mx-auto" />
                    ) : (
                      daysSincePlanting
                    )}
                  </p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 text-center">
                  <FaCalendarAlt className="text-lg sm:text-xl lg:text-2xl text-purple-600 mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs text-gray-600">Harvest In</p>
                  {isLoadingHarvest ? (
                    <LoadingSkeleton className="w-12 sm:w-16 h-3 sm:h-4 mx-auto" />
                  ) : (
                    <>
                      <p className="text-xs sm:text-sm font-bold text-purple-800">
                        {farmData.expectedHarvest}
                      </p>
                      {harvestData && (
                        <p className="text-xs text-purple-600 mt-1">
                          {new Date(harvestData.estimated_harvest_date).toLocaleDateString()}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-lg sm:rounded-xl p-2 sm:p-3 lg:p-4 text-center">
                  <FaChartLine className="text-lg sm:text-xl lg:text-2xl text-green-600 mx-auto mb-1 sm:mb-2" />
                  <p className="text-xs text-gray-600">Growth</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-green-800">{Math.round(cropStage)}%</p>
                </div>
              </div>

              {/* Detailed Info - Mobile-responsive grid */}
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${harvestData ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 sm:gap-6`}>
                {/* Harvest Information - NEW SECTION */}
                {isLoadingHarvest ? (
                  <HarvestInfoSkeleton />
                ) : harvestData ? (
                  <div className="space-y-3 sm:space-y-4">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800">Harvest Information</h3>
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg sm:rounded-xl p-2 sm:p-3">
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                          <FaCalendarAlt className="text-green-500 text-xs sm:text-sm flex-shrink-0" />
                          <span className="text-xs sm:text-sm truncate">Estimated Harvest Date</span>
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-green-700 ml-2">
                          {new Date(harvestData.estimated_harvest_date).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-2 sm:p-3">
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                          <FaChartLine className="text-blue-500 text-xs sm:text-sm flex-shrink-0" />
                          <span className="text-xs sm:text-sm">Days Remaining</span>
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-blue-700">
                          {harvestData.days_remaining} days
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg sm:rounded-xl p-2 sm:p-3">
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                          <FaSeedling className="text-purple-500 text-xs sm:text-sm flex-shrink-0" />
                          <span className="text-xs sm:text-sm">Growth Progress</span>
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-purple-700">
                          {Math.round(harvestData.growth_percentage)}%
                        </span>
                      </div>

                      <div className={`flex items-center justify-between ${
                        harvestData.status === 'ready_for_harvest' 
                          ? 'bg-yellow-50 border-yellow-200' 
                          : 'bg-gray-50 border-gray-200'
                      } border rounded-lg sm:rounded-xl p-2 sm:p-3`}>
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                          <div className={`w-2 h-2 sm:w-3 sm:h-3 ${
                            harvestData.status === 'ready_for_harvest' ? 'bg-yellow-500' : 'bg-gray-500'
                          } rounded-full flex-shrink-0`}></div>
                          <span className="text-xs sm:text-sm">Status</span>
                        </div>
                        <span className={`text-xs sm:text-sm font-medium ${
                          harvestData.status === 'ready_for_harvest' 
                            ? 'text-yellow-700' 
                            : 'text-gray-700'
                        }`}>
                          {harvestData.status === 'ready_for_harvest' ? 'Ready for Harvest!' : 'Growing'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Farm Activities */}
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">Recent Activities</h3>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg sm:rounded-xl p-2 sm:p-3">
                      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                        <FaTint className="text-blue-500 text-xs sm:text-sm flex-shrink-0" />
                        <span className="text-xs sm:text-sm truncate">Last Irrigated</span>
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-gray-600 ml-2">{farmData.lastIrrigated}</span>
                    </div>
                    
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg sm:rounded-xl p-2 sm:p-3">
                      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                        <FaSeedling className="text-green-500 text-xs sm:text-sm flex-shrink-0" />
                        <span className="text-xs sm:text-sm truncate">Last Fertilized</span>
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-gray-600 ml-2">{farmData.lastFertilized}</span>
                    </div>

                    <div className="flex items-center justify-between bg-gray-50 rounded-lg sm:rounded-xl p-2 sm:p-3">
                      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                        <FaChartLine className="text-purple-500 text-xs sm:text-sm flex-shrink-0" />
                        <span className="text-xs sm:text-sm truncate">Growth Rate</span>
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-green-600 ml-2">{farmData.growthRate}</span>
                    </div>
                  </div>
                </div>

                {/* Weather Forecast */}
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">5-Day Forecast</h3>
                  <div className="space-y-2">
                    {isLoadingWeather ? (
                      // Pulsating loading animation
                      [...Array(5)].map((_, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg sm:rounded-xl p-2 sm:p-3">
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gray-200 rounded-full animate-pulse"></div>
                            <div className="h-3 sm:h-4 bg-gray-200 rounded w-12 sm:w-16 animate-pulse"></div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="h-3 sm:h-4 bg-gray-200 rounded w-6 sm:w-8 animate-pulse"></div>
                            <div className="h-2 sm:h-3 bg-gray-200 rounded w-8 sm:w-12 animate-pulse"></div>
                          </div>
                        </div>
                      ))
                    ) : weatherError ? (
                      // Error state
                      <div className="flex items-center justify-center bg-red-50 rounded-lg sm:rounded-xl p-2 sm:p-3">
                        <div className="text-xs sm:text-sm text-red-600">{weatherError}</div>
                      </div>
                    ) : farmData.forecast.length > 0 ? (
                      // Weather data
                      farmData.forecast.map((day, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg sm:rounded-xl p-2 sm:p-3">
                          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                            <day.icon className="text-yellow-500 text-xs sm:text-sm flex-shrink-0" />
                            <span className="text-xs sm:text-sm truncate">{day.day}</span>
                          </div>
                          <div className="text-right ml-2">
                            <p className="text-xs sm:text-sm font-medium">{day.temp}°C</p>
                            <p className="text-xs text-gray-500">{day.condition}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      // No data fallback
                      <div className="flex items-center justify-center bg-gray-50 rounded-lg sm:rounded-xl p-4 sm:p-6">
                        <div className="text-xs sm:text-sm text-gray-600">Weather data unavailable</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Irrigation & Alerts */}
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">System Status</h3>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg sm:rounded-xl p-2 sm:p-3">
                      <div className="flex items-center space-x-2 mb-1 sm:mb-2">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                        <span className="text-xs sm:text-sm font-medium text-green-800 truncate">Irrigation System</span>
                      </div>
                      <p className="text-xs text-green-600 truncate">Next: {farmData.irrigation.nextScheduled}</p>
                    </div>

                    <div className={`${farmData.pests.detected ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border rounded-lg sm:rounded-xl p-2 sm:p-3`}>
                      <div className="flex items-center space-x-2 mb-1 sm:mb-2">
                        <div className={`w-2 h-2 sm:w-3 sm:h-3 ${farmData.pests.detected ? 'bg-red-500' : 'bg-blue-500'} rounded-full flex-shrink-0`}></div>
                        <span className={`text-xs sm:text-sm font-medium ${farmData.pests.detected ? 'text-red-800' : 'text-blue-800'} truncate`}>
                          Pest Detection
                        </span>
                      </div>
                      <p className={`text-xs ${farmData.pests.detected ? 'text-red-600' : 'text-blue-600'} truncate`}>
                        Risk: {farmData.pests.risk} | Checked: {farmData.pests.lastChecked}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-lg sm:rounded-xl p-2 sm:p-3">
                      <div className="text-xs text-gray-600 space-y-1">
                        <p className="truncate">Total Water Used: {farmData.irrigation.totalWaterUsed}</p>
                        <p className="truncate">AI Recommendations: Active</p>
                        <p className="truncate">Sensor Status: Online</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nutrient Levels */}
              <div className="mt-4 sm:mt-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Soil Nutrients</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {Object.entries(farmData.nutrients).map(([nutrient, level]) => (
                    <div key={nutrient} className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs sm:text-sm font-medium text-gray-600 capitalize truncate">{nutrient}</span>
                        <span className="text-xs sm:text-sm font-bold text-green-600 ml-2">{level}%</span>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-1.5 sm:h-2">
                        <div
                          className="bg-gradient-to-r from-green-400 to-green-600 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                          style={{ width: `${level}%` }}
                        />
                      </div>
                    </div>
                  ))}
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
