import dotenv from "dotenv";

// Configure environment variables first
dotenv.config();

import dbConnect from "./db/index.js";
import { app } from "./app.js";

const port = process.env.PORT;

// Connect to database
dbConnect()
.then(() => {
    app.listen(port, () => console.log(`Server listening on port: ${port}`));
})
.catch(error => {
    console.error("Database connection error:", error);
    process.exit(1);
});


