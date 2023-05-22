const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const server = require("http").Server(app);
const cors = require("cors");
const io = require("socket.io")(server);
const bcrypt = require("bcryptjs");
const { setupSocketEvents } = require("./signalingserver");
const session = require("express-session");
const cookieParser = require("cookie-parser");
app.use(cookieParser());

const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

const uri =
  "mongodb+srv://f-raps-db:rXwglEkxGfL07wP8@cluster0.fnkdvcm.mongodb.net/?retryWrites=true&w=majority";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
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

// Configure Passport.js
passport.use(
  new LocalStrategy(
    { usernameField: "nickname", passwordField: "password" },
    async (nickname, password, done) => {
          // Check for existing sessions
    const db = client.db("f-raps-db");
    const activeSessionsCollection = db.collection("ActiveSessions");

    const existingSession = await activeSessionsCollection.findOne({ nickname });
    if (existingSession) {
      return done(null, false, { message: 'User already logged in' }); // Active session detected
    }
      // Add user authentication logic
      const usersCollection = db.collection("User");

      try {
        const user = await usersCollection.findOne({ nickname });
        if (user) {
          // Check if password is correct using bcrypt
          const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
          );

          if (isPasswordCorrect) {
            user.active = true; // Add this line
            done(null, user); // Success
          } else {
            done(null, false, { message: "Incorrect password" }); // Incorrect password
          }
        } else {
          done(null, false, { message: "User not found" }); // User not found
        }
      } catch (error) {
        done(error); // Error during authentication
      }
    }
  )
);
passport.serializeUser((user, done) => {
  done(null, user.nickname);
});

passport.deserializeUser(async (nickname, done) => {
  const db = client.db("f-raps-db");
  const usersCollection = db.collection("User");
  
  try {
    const user = await usersCollection.findOne({ nickname });
    
    if (user) {
      done(null, user);
    } else {
      done(new Error("User not found"), null);
    }
  } catch (error) {
    done(error, null);
  }
});
// Configure express-session middleware
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false, // should be false
    cookie: { secure: process.env.NODE_ENV === 'production' }, // should only be secure in production environment
  })
);

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/auth");
  }
}

// Initialize Passport.js middleware
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  setMimeTypes(res, req.url);
  express.static(path.join(__dirname, "public"), { setHeaders: setMimeTypes })(
    req,
    res,
    next
  );
});

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public/pages/landing-page", "landingPage.html")
  );
});

app.get("/auth", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/battlefield");
  } else {
    res.sendFile(path.join(__dirname, "public/pages/auth", "auth.html"));
  }
});

app.get("/landing-page", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public/pages/landing-page", "landingPage.html")
  );
});

app.get("/battlefield", ensureAuthenticated, (req, res) => { // Add ensureAuthenticated middleware
  res.sendFile(path.join(__dirname, "public/pages/battlefield", "battlefield.html"));
});

app.get('/signout', async (req, res) => {
  const db = client.db("f-raps-db");
  const activeSessionsCollection = db.collection("ActiveSessions");

  await activeSessionsCollection.deleteOne({ sessionId: req.session.id });
  
  // req.logout(); // Passport.js function to logout
  req.session.loggedIn = false;
  req.session.destroy(); // Destroy the session
  res.redirect('/auth');
});

app.post("/auth/login", (req, res, next) => {
  const db = client.db("f-raps-db");
  console.log("works");
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.log("Error during authentication:", err);
      return res.status(500).send("Server error");
    }
    if (!user) {
      if (info && info.message) {
        // Send the custom message from the LocalStrategy
        return res.status(401).send(info.message);
      } else {
        console.log("No user found");
        return res.status(401).send("Invalid nickname or password");
      }
    }

    console.log("User found:", user);

    req.logIn(user, async (err) => {
      if (err) {
        console.log("Error during logIn:", err);
        return res.status(500).send("Server error");
      }

      console.log("Login successful");
      req.session.loggedIn = true;
      res.cookie("fRapsUser", {nickname: user.nickname});
      req.session.user = user;

      // Insert session information into ActiveSessions collection
      const activeSessionsCollection = db.collection("ActiveSessions");
      await activeSessionsCollection.insertOne({
        nickname: user.nickname,
        sessionId: req.session.id,
      });

      return res.status(200).end();
    });
  })(req, res, next);
});

app.post("/auth/signup", async (req, res, next) => {
  const { nickname, password } = req.body;
  const db = client.db("f-raps-db");
  const usersCollection = db.collection("User");
  const activeSessionsCollection = db.collection("ActiveSessions");
  try {
    const existingUser = await usersCollection.findOne({ nickname });

    // Check if the user is already logged in before signing up
    const existingSession = await activeSessionsCollection.findOne({ nickname });
    if (existingSession) {
      return res.status(409).send("This user is already logged in");
    }

    if (existingUser) {
      res.status(409).send("Nickname already in use");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      await usersCollection.insertOne({ nickname, password: hashedPassword });

      passport.authenticate("local", (err, user) => {
        if (err) {
          return res.status(500).send("Server error");
        }
        if (!user) {
          return res.status(401).send("Invalid nickname or password");
        }
        req.logIn(user, async (err) => {
          if (err) {
            return res.status(500).send("Server error");
          }
          req.session.loggedIn = true;
          res.cookie("fRapsUser", {nickname: user.nickname});
          req.session.user = user;

          // Insert session information into ActiveSessions collection
          await activeSessionsCollection.insertOne({
            nickname: user.nickname,
            sessionId: req.session.id,
          });

          return res.status(200).end();
        });
      })(req, res, next);
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
