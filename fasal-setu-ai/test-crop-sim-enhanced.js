const http = require('http');

// Test configuration
const BASE_URL = 'localhost';
const PORT = 5000;
const TEST_USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NzYzYmZiNzBkYjllMmUyNmQxMTE1ZjAiLCJpYXQiOjE3MzQ2MjE0MDIsImV4cCI6MTczNTIyNjIwMn0.UvFhZWgAH9ZQp0l9PTJnvCPSGgN_h33WDBLIbPdkz94'; // Replace with valid token
const TEST_CROP_ID = '676457b4af2e8ceb88e3e3a7'; // Replace with valid crop ID

async function testCropSimChat(message, testName) {
    console.log(`\n🧪 Testing: ${testName}`);
    console.log(`📝 Message: "${message}"`);
    console.log('⏱️  Processing...');
    
    return new Promise((resolve) => {
        const postData = JSON.stringify({
            message: message,
            cropId: TEST_CROP_ID,
            farmContext: {
                weather: { current: 'sunny', temperature: 28 },
                soil: { moisture: 65, temperature: 25 },
                location: { state: 'Maharashtra', district: 'Pune' }
            }
        });

        const options = {
            hostname: BASE_URL,
            port: PORT,
            path: '/api/crop-sim/chat',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_USER_TOKEN}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        throw new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
                    }
                    
                    const result = JSON.parse(data);
                    
                    console.log('✅ Response received!');
                    console.log('📊 Classification:', result.data?.classification || result.data?.detection);
                    console.log('💬 Bot Response:');
                    console.log(result.data.response);
                    console.log('─'.repeat(80));
                    
                    resolve(result);
                } catch (error) {
                    console.error('❌ Test failed:', error.message);
                    console.log('📄 Raw response:', data);
                    console.log('─'.repeat(80));
                    resolve(null);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ Request failed:', error.message);
            console.log('─'.repeat(80));
            resolve(null);
        });

        req.write(postData);
        req.end();
    });
}

async function runTests() {
    console.log('🚀 Starting Enhanced Crop Simulation Chat Tests');
    console.log('🎯 Testing Gemini-based event/query classification and response stitching');
    console.log('═'.repeat(80));

    // Test 1: Pure query (should be detected as query only)
    await testCropSimChat(
        "What fertilizers are best for my crops?",
        "Pure Query - Fertilizer Advice"
    );

    // Test 2: Pure event (should be detected as event only)
    await testCropSimChat(
        "I just watered my crops this morning",
        "Pure Event - Irrigation Record"
    );

    // Test 3: Mixed event + query (should detect both and stitch responses)
    await testCropSimChat(
        "Just applied NPK fertilizer to my tomatoes. What should I do next for better growth?",
        "Mixed Event + Query - Fertilization + Growth Advice"
    );

    // Test 4: Complex query about crop status
    await testCropSimChat(
        "How are my crops doing? Should I be worried about anything?",
        "Crop Assessment Query"
    );

    // Test 5: Another mixed scenario
    await testCropSimChat(
        "Checked for pests today and found some aphids. Tomorrow's weather forecast shows rain - is that good or bad?",
        "Mixed Event + Weather Query"
    );

    // Test 6: General farming question
    await testCropSimChat(
        "What are the benefits of organic farming methods?",
        "General Farming Query"
    );

    console.log('\n🏁 All tests completed!');
    console.log('📋 Review the responses above to verify:');
    console.log('   ✓ Accurate event/query classification using Gemini AI');
    console.log('   ✓ Proper response stitching for mixed messages');
    console.log('   ✓ AI Engine integration with fallback to Gemini');
    console.log('   ✓ Formatted responses with bold text and emojis');
}

// Run the tests
runTests().catch(console.error);
