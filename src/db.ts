import mongoose from "mongoose";
import dotenv from "dotenv"

dotenv.config()

export const connectToDb = async () =>{
    try {
        const mongoUrl = process.env.MONGO_URL
        if(!mongoUrl){
            throw new Error("Mongo url is not define in .env")
        }
        
        // 1. Connect to the database first
        await mongoose.connect(mongoUrl)
        console.log(`DB connected successfully`)
    
        // 2. Drop the problematic index right after connecting
        // try {
        //     // We use the exclamation mark (!) or optional chaining (?) to ensure TypeScript knows db is defined
        //     await mongoose.connection.db?.collection('schools').dropIndex('email_1');
        //     console.log("Dropped unique email index!");
        // } catch (indexError: any) {
        //     // It will throw an error if the index doesn't exist, which is fine!
        //     console.log("Note: email_1 index not found or already dropped.");
        // }

    } catch (error) {
        console.log("error connecting to data", error)
    }
}