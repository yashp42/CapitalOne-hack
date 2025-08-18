#!/usr/bin/env node

import fetch from 'node-fetch';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8080';

async function testChatEndpoint() {
  console.log('🚀 Testing Fasal-Setu Chatbot Flow...\n');

  // Test 1: Health Check
  console.log('1. Testing Health Check...');
  try {
    const healthResponse = await fetch(`${SERVER_URL}/api/chat/health`);
    const healthData = await healthResponse.json();
    console.log(`   Status: ${healthResponse.status}`);
    console.log(`   Services:`, healthData.data.services);
    console.log(`   Overall: ${healthData.data.status}\n`);
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}\n`);
  }

  // Test 2: Simple Chat Request
  console.log('2. Testing Simple Chat Request...');
  const testPayload = {
    message: "What crops should I plant this season?",
    mode: "general",
    profile: {
      location: "Karnataka, India",
      farm_size: "2 acres",
      soil_type: "red_soil"
    },
    conversation: [
      {
        role: "user",
        content: "Hello, I need farming advice"
      },
      {
        role: "assistant", 
        content: "Hello! I'd be happy to help you with farming advice. What specific information do you need?"
      }
    ]
  };

  try {
    const startTime = Date.now();
    const chatResponse = await fetch(`${SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    const duration = Date.now() - startTime;
    const chatData = await chatResponse.json();

    console.log(`   Status: ${chatResponse.status}`);
    console.log(`   Duration: ${duration}ms`);
    
    if (chatData.success) {
      console.log(`   Answer: ${chatData.data.answer.substring(0, 100)}...`);
      console.log(`   Intent: ${chatData.data.llm1.intent}`);
      console.log(`   Missing Fields: ${chatData.data.llm1.missing.length > 0 ? chatData.data.llm1.missing.join(', ') : 'none'}`);
      console.log(`   Request ID: ${chatData.data._meta.requestId}`);
      console.log(`   Timings:`, chatData.data._meta.timings);
    } else {
      console.log(`   ❌ Chat failed: ${chatData.message}`);
    }
  } catch (error) {
    console.log(`   ❌ Chat request failed: ${error.message}`);
  }

  console.log('\n3. Testing Public Advisor Mode...');
  
  const publicAdvisorPayload = {
    message: "What is the best fertilizer for wheat?",
    mode: "public_advisor",
    conversation: []
  };

  try {
    const startTime = Date.now();
    const publicResponse = await fetch(`${SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(publicAdvisorPayload)
    });

    const duration = Date.now() - startTime;
    const publicData = await publicResponse.json();

    console.log(`   Status: ${publicResponse.status}`);
    console.log(`   Duration: ${duration}ms`);
    
    if (publicData.success) {
      console.log(`   Answer: ${publicData.data.answer.substring(0, 100)}...`);
      console.log(`   Intent: ${publicData.data.llm1.intent}`);
      console.log(`   Mode: ${publicData.data._meta.mode}`);
    } else {
      console.log(`   ❌ Public advisor failed: ${publicData.message}`);
    }
  } catch (error) {
    console.log(`   ❌ Public advisor request failed: ${error.message}`);
  }

  console.log('\n✅ Test completed!');
}

testChatEndpoint().catch(console.error);
