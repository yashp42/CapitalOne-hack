# API Endpoints Documentation

## Authentication Required
All endpoints except login/register require `Authorization: Bearer <token>` header.

## User Endpoints

### POST /api/users/register
Register a new user with phone number
```json
{
  "phoneNumber": "+919876543210",
  "firstName": "John",
  "lastName": "Doe"
}
```

### POST /api/users/login
Login with phone number
```json
{
  "phoneNumber": "+919876543210"
}
```

### GET /api/users/profile
Get current user profile

### PUT /api/users/profile
Update user profile
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "preferred_language": "hi",
  "location": {
    "state": "Punjab",
    "district": "Ludhiana",
    "lat": 30.9010,
    "lon": 75.8573
  },
  "land_area_acres": 5.5,
  "finance": {
    "has_kcc": true,
    "receives_pm_kisan": true,
    "collateral_available": false
  }
}
```

## Crop Management Endpoints

### POST /api/crops
Create a new crop
```json
{
  "crop_name": "wheat",
  "season": "rabi",
  "variety": "HD-2967",
  "sowing_date": "2024-11-15",
  "area_acres": 2.5,
  "irrigation_source": "tube_well",
  "location_override": {
    "state": "Punjab",
    "district": "Ludhiana",
    "lat": 30.9010,
    "lon": 75.8573
  }
}
```

### GET /api/crops
Get user's crops with optional filters
- Query params: `status`, `crop_name`, `limit`, `page`
- Example: `/api/crops?status=active&limit=5&page=1`

### GET /api/crops/stats
Get crop statistics for the user
```json
{
  "overview": {
    "total_crops": 5,
    "active_crops": 3,
    "completed_crops": 2,
    "total_area": 12.5,
    "avg_growth": 65.4
  },
  "by_crop_type": [
    {
      "_id": "wheat",
      "count": 3,
      "total_area": 7.5,
      "avg_growth": 70.2
    }
  ]
}
```

### GET /api/crops/:cropId
Get specific crop details

### PUT /api/crops/:cropId
Update crop information
```json
{
  "variety": "HD-3086",
  "irrigation_source": "drip",
  "area_acres": 3.0
}
```

### PATCH /api/crops/:cropId/growth
Update crop growth percentage
```json
{
  "growth_percent": 75
}
```

### PATCH /api/crops/:cropId/irrigate
Mark crop as irrigated (updates last_irrigation_at)

### PATCH /api/crops/:cropId/complete
Mark crop as completed (harvested)

### PATCH /api/crops/:cropId/abandon
Mark crop as abandoned

### DELETE /api/crops/:cropId
Delete a crop

## Query Endpoints

### POST /api/query
Submit a farming query
```json
{
  "message": "What is the best fertilizer for wheat?",
  "crop_context": "cropId_here", // optional
  "location_context": {
    "state": "Punjab",
    "district": "Ludhiana"
  }
}
```

## Voice Endpoints

### POST /api/voice/stt
Speech to text conversion
- Content-Type: multipart/form-data
- Body: audio file

### POST /api/voice/tts
Text to speech conversion
```json
{
  "text": "Your wheat crop is ready for irrigation",
  "language": "hi"
}
```

## Crop Schema Details

### Crop Model Fields
- `owner_id`: ObjectId (ref to User)
- `crop_name`: String (required)
- `season`: Enum ["kharif", "rabi", "zaid", "summer", "winter"]
- `variety`: String (required)
- `sowing_date`: Date (required)
- `growth_percent`: Number (0-100, default: 0)
- `area_acres`: Number (required, min: 0)
- `irrigation_source`: Enum ["canal", "tube_well", "rainfed", "drip", "sprinkler", "other", null]
- `location_override`: Object with state, district, lat, lon
- `derived`: Object with stage, days_after_sowing, last_irrigation_at
- `status`: Enum ["active", "completed", "abandoned"]

### User Model Updates
Added fields:
- `preferred_language`: String (default: "en")
- `location`: Object with state, district, lat, lon
- `land_area_acres`: Number
- `finance`: Object with has_kcc, receives_pm_kisan, collateral_available
- `profile_version`: Number (default: 1)

## Error Responses
All endpoints return errors in the format:
```json
{
  "success": false,
  "message": "Error description",
  "statusCode": 400
}
```

## Success Responses
All endpoints return success responses in the format:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "statusCode": 200
}
```