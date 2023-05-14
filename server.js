const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const server = require("http").Server(app);
const cors = require("cors");
const io = require("socket.io")(server);
const bcrypt = require('bcrypt');
const { setupSocketEvents } = require("./signalingserver");

const uri = "mongodb+srv://f-raps-db:rXwglEkxGfL07wP8@cluster0.fnkdvcm.mongodb.net/?retryWrites=true&w=majority";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error("Error connecting to MongoDB", error);
  }
}

connectToMongoDB();

app.use(bodyParser.json());
app.use(cors()); // Add this line before other middlewares

const setMimeTypes = (res, filePath) => {
  if (filePath.endsWith(".css")) {
    res.setHeader("Content-Type", "text/css");
  } else if (filePath.endsWith(".js")) {
    res.setHeader("Content-Type", "application/javascript");
  }
};

app.use((req, res, next) => {
  setMimeTypes(res, req.url);
  express.static(path.join(__dirname, "public"), { setHeaders: setMimeTypes })(req, res, next);
});

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public/pages/landing-page", "landingPage.html")
  );
});

app.get("/auth", (req, res) => {
  res.sendFile(path.join(__dirname, "public/pages/auth", "auth.html"));
});

app.get("/landing-page", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public/pages/landing-page", "landingPage.html")
  );
});

app.get("/battlefield", (req, res) => {
  res.sendFile(path.join(__dirname, "public/pages/battlefield", "battlefield.html"));
});

app.get("/signout", (req, res) => {
  // Perform any necessary sign-out actions, such as clearing session data

  // Redirect the user to the desired page after sign-out
  res.redirect("/auth");
});

app.post("/auth/login", async (req, res) => {
  const { nickname, password } = req.body;

  const db = client.db("f-raps-db");
  const usersCollection = db.collection("User");

  try {
    const user = await usersCollection.findOne({ nickname });

    if (!user) {
      res.status(401).send("Invalid nickname or password");
    } else {
      // Compare the provided password with the stored hashed password
      const isPasswordMatch = await bcrypt.compare(password, user.password);

      if (isPasswordMatch) {
        res.status(200).send("Login successful");
      } else {
        res.status(401).send("Invalid nickname or password");
      }
    }
  } catch (error) {
    console.error("Error in /auth/login", error);
    res.status(500).send("Server error");
  }
});

app.post("/auth/signup", async (req, res) => {
  const { nickname, password } = req.body;

  const db = client.db("f-raps-db");
  const usersCollection = db.collection("User");

  try {
    const existingUser = await usersCollection.findOne({ nickname });

    if (existingUser) {
      res.status(409).send("Nickname already in use");
    } else {
      // Hash the password using bcrypt
      const hashedPassword = await bcrypt.hash(password, 10);

      await usersCollection.insertOne({ nickname, password: hashedPassword });
      res.status(200).json({ message: "Signup successful", redirectUrl: "pages/battlefield/battlefield.html" });
    }
  } catch (error) {
    console.error("Error in /auth/signup", error);
    res.status(500).send("Server error");
  }
});

setupSocketEvents(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});