import dotenv from "dotenv";
import dbConnect from "./db/index.js";
import { app } from "./app.js";

dotenv.config();
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


