import connectDB from "./db/db.js";
import dotenv from "dotenv"
import dns from "dns"
import app from "./app.js"

dns.setServers(["8.8.8.8", "1.1.1.1"]);

dotenv.config({path : './.env'})

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 5000 , ()=>{
        console.log(`Server is running on port ${process.env.PORT}`)
    })
})
.catch((err)=>{
    console.log("database connection failed")
})
