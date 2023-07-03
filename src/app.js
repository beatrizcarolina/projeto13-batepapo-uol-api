import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import joi from "joi";
import dotenv from "dotenv";

dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
    await mongoClient.connect();
    console.log("MongoDB Connected!");
} catch (error) {
    console.log(error.message);
}
const db = mongoClient.db();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;
const nameSchema = joi.object({
    name: joi.string().required(),
});
const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
    from: joi.string().required(),
});

app.post('/participants', async (req,res) => {
    const participant = req.body;
    
    if(nameSchema.validate(participant).error) {
        console.log("Nome Inválido");
        return res.sendStatus(422);
    };

    participant.lastStatus = Date.now();
    console.log(participant);

    const message = {from: participant.name, 
        to: 'Todos', 
        text: 'entra na sala...', 
        type: 'status', 
        time: dayjs().format("HH:mm:ss")};

    try {
        const invalidName = await db.collection("participants").findOne({ name: participant.name });
        if(invalidName) {
            console.log("Participante já existe");
            console.log(invalidName);
            return res.status(409).send({message: "Esse nome de usuário já existe!"});
        }
    } catch (error) {
        return res.status(500).send({ message: error.message });
    };

    try {
        await db.collection("participants").insertOne(participant);
        await db.collection("messages").insertOne(message);
        return res.sendStatus(201);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    };
});

app.get('/participants', async (req,res) => {
    const users = await db.collection("participants").find().toArray();
    res.send(users);
});

app.post('/messages', async (req,res) => {
    const message = req.body;
    message.from = req.headers.user;

    if (messageSchema.validate(message, { abortEarly: false }).error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    };

    try {
        const invalidUser = await db.collection("participants").findOne({ name: message.from});
        if(!invalidUser) {
            console.log("Participante não existe");
            console.log(invalidUser);
            return res.status(422).send({message: "Esse usuário não existe!"});
        }
        message.time = dayjs().format("HH:mm:ss");
        await db.collection("messages").insertOne(message);
        return res.sendStatus(201);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

app.get('/messages', async (req,res) => {
    let limit = parseInt(req.query.limit);
    if (limit) {
        if (!(limit > 0)) {
            return res.status(422).send("Limite de mensagens inválido!");
        }
    };

    const user = req.headers.user;
    if (!user || typeof user !== "string") {
        res.status(400).send("User not sent.");
        return;
    };

    try {
        const messages = await db
            .collection("messages")
            .find({$or: [{ type: "message" }, { to: "Todos" }, { to: user }, { from: user }]})
            .toArray();

        if (limit === 0) {
            return res.send(messages);
        }
        return res.send(messages.slice(-limit));
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

app.listen(PORT,  () => console.log(`Running server on port ${PORT}`));