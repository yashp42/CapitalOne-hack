export async function callAIEngine(payload) {
  // Enhanced AI Engine client that ensures village data is included
  const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:7001';
  
  console.log('AI Engine client - Payload structure verification:');
  console.log('- Mode:', payload.mode);
  console.log('- Profile keys:', payload.profile ? Object.keys(payload.profile) : 'No profile');
  
  if (payload.profile) {
    console.log('- Location data:', {
      state: payload.profile.state,
      district: payload.profile.district,
      village: payload.profile.village,
      coordinates: payload.profile.lat && payload.profile.lon ? `${payload.profile.lat}, ${payload.profile.lon}` : 'Not available'
    });
    
    // Ensure village is included if available
    if (!payload.profile.village && payload.profile.location?.village) {
      payload.profile.village = payload.profile.location.village;
      console.log('- Village field moved from nested location to root level');
    }
  }
  
  try {
    const response = await fetch(`${AI_ENGINE_URL}/act`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      console.warn(`AI Engine returned ${response.status}, using fallback`);
      return { 
        intent: "general_advice", 
        facts: { 
          fallback: true, 
          location: payload.profile ? `${payload.profile.state}, ${payload.profile.district}${payload.profile.village ? `, ${payload.profile.village}` : ''}` : 'Unknown',
          message: "AI Engine unavailable, using general guidance" 
        } 
      };
    }
    
    const result = await response.json();
    console.log('AI Engine response received successfully');
    return result;
    
  } catch (error) {
    console.error('AI Engine call failed:', error.message);
    // Return enhanced fallback with location context
    return { 
      intent: "general_advice", 
      facts: { 
        fallback: true,
        location: payload.profile ? `${payload.profile.state}, ${payload.profile.district}${payload.profile.village ? `, ${payload.profile.village}` : ''}` : 'Unknown',
        message: "AI Engine unavailable, using general guidance" 
      } 
    };
  }
}
