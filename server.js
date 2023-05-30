const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");

const path = require("path");
const { MongoClient, ServerApiVersion } = require("mongodb");
const MongoDBStore = require("connect-mongodb-session")(session);
const app = express();
const server = require("http").Server(app);
const cors = require("cors");
const io = require("socket.io")(server);
const bcrypt = require("bcryptjs");
const { setupSocketEvents, signalingEvents } = require("./signalingserver");
const cookieParser = require("cookie-parser");
app.use(cookieParser());
const multer = require("multer");
const upload = multer();

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
async function logoutUserByNickname(nickname, userSessionId) {
  try {
    const db = client.db("f-raps-db");
    const activeSessionsCollection = db.collection("ActiveSessions");

    if (userSessionId) {
      await activeSessionsCollection.deleteOne({
        sessionId: userSessionId,
      });
      console.log(`User '${nickname}' has been logged out successfully.`);
      io.to(userSessionId).emit("clearCookies");
    } else {
      console.log(`User: '${nickname}' has not  been found`);
    }
  } catch (error) {
    console.error(`Error logging out user '${nickname}':`, error);
  }
}

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error("Error connecting to MongoDB", error);
  }
}

signalingEvents.on("userDisconnected", async (nickname, allUsers) => {
  console.log(`User ${nickname} disconnected from signaling server.`);
  const db = client.db("f-raps-db");

  const activeSessionsCollection = db.collection("ActiveSessions");

  const existingSession = await activeSessionsCollection.findOne({
    nickname,
  });
  await logoutUserByNickname(nickname, existingSession?.sessionId);
});

connectToMongoDB();

app.use(bodyParser.json());
app.use(cors());

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

      const existingSession = await activeSessionsCollection.findOne({
        nickname,
      });
      if (existingSession) {
        return done(null, false, { message: "User already logged in" }); // Active session detected
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


// Configure the session store
const store = new MongoDBStore({
  uri: uri,
  collection: "sessions",
  clientPromise: client,
});

// Configure express-session middleware
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
    // cookie: { secure: process.env.NODE_ENV === "production" },
    store: store, // Add this line
  })
);

// Catch errors
store.on("error", function (error) {
  console.error("Session store error:", error);
});

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


function redirectToAuthIfNotLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.redirect("/auth");
  }
}

async function getUserByNickName(nickname) {
  const db = client.db("f-raps-db");
  const usersCollection = db.collection("User");

  return await usersCollection.findOne({ nickname });
}

async function updateUserPoints(nickname, newPoints) {
  const db = client.db("f-raps-db");
  const usersCollection = db.collection("User");

  await usersCollection.updateOne({ nickname }, { $set: { points: newPoints } });
}

app.get("/vote/:nickname", async (req, res) => {
  const nickname = req.params.nickname;
  const user = await getUserByNickName(nickname);

  if (!user) {
    res.status(404).send({ error: "User not found" });
    return;
  }

  const updatedPoints = user.points + 2;
  await updateUserPoints(nickname, updatedPoints);

  res.status(200).send({ success: true, message: "User points updated", newPoints: updatedPoints });
});

async function getActiveSessionByNickName(nickname) {
  const db = client.db("f-raps-db");
  const activeSessionsCollection = db.collection("ActiveSessions");

  return await activeSessionsCollection.findOne({ nickname });
}

app.get("/auth/check-nickname/:nickname", async (req, res) => {
  const nickname = req.params.nickname;
  const existingSession = await getActiveSessionByNickName(nickname);
  if (existingSession) {
    res.status(200).send({ isLoggedIn: true });
  } else {
    res.status(200).send({ isLoggedIn: false });
  }
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

app.get("/auth/getuserbyname", async (req, res) => {
  const nickname = req.query.name; // Extract the name from the query string
  const db = client.db("f-raps-db");
  const usersCollection = db.collection("User");

  try {
    // Search for the user by nickname in the User collection
    const user = await usersCollection.findOne(
      { nickname: nickname },
      { projection: { _id: 0, password: 0 } }
    );

    if (user) {
      // Send the user data (excluding _id and password) to the client
      res.status(200).send(user);
    } else {
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error("Error in /auth/getuserbyname:", error);
    res.status(500).send("Server error");
  }
});

app.get("/auth/getonlineusers", async (req, res) => {
  const db = client.db("f-raps-db");
  const activeSessionsCollection = db.collection("ActiveSessions");
  const usersCollection = db.collection("User");

  try {
    // Query the ActiveSessions collection to get the data
    const activeSessions = await activeSessionsCollection.find({}).toArray();
    // Extract the online users' nicknames from the activeSessions array
    const onlineNicknames = activeSessions.map((session) => session.nickname);

    // Fetch the corresponding nickname and profilePicture from the "User" collection for each online nickname
    const onlineUsers = await usersCollection
      .find(
        { nickname: { $in: onlineNicknames } },
        { projection: { _id: 0, password: 0 } }
      )
      .toArray();

    // Send the online users array (with nickname and profilePicture) to the client
    res.status(200).send(onlineUsers);
  } catch (error) {
    console.error("Error in /auth/getonlineusers:", error);
    res.status(500).send("Server error");
  }
});

app.get("/auth/getallusers", async (req, res) => {
  const db = client.db("f-raps-db");
  const usersCollection = db.collection("User");

  try {
    // Query the User collection to get all users sorted by 'points' in descending order
    const allUsers = await usersCollection
      .find({}, { projection: { _id: 0, password: 0 } })
      .sort({ points: -1 })
      .toArray();

    // Send the sorted users array (with nickname, profilePicture and points) to the client
    res.status(200).send(allUsers);
  } catch (error) {
    console.error("Error in /auth/getallusers:", error);
    res.status(500).send("Server error");
  }
});

app.get("/battlefield", redirectToAuthIfNotLoggedIn, async (req, res) => {
  const referer = req.header("Referer");
  const protocol = req.header("X-Forwarded-Proto") || req.protocol; // Use the X-Forwarded-Proto header to determine the protocol
  const expectedReferer =
    protocol + "://" + req.header("host") + "/auth";
  if (referer === expectedReferer) {
    // Existing code for handling the battlefield request
    if (req.isAuthenticated() && req.session.loggedIn) {
      const db = client.db("f-raps-db");
      const activeSessionsCollection = db.collection("ActiveSessions");

      const existingSession = await activeSessionsCollection.findOne({
        nickname: req.user.nickname,
      });

      if (
        existingSession &&
        existingSession.sessionId === req.session.id &&
        existingSession.loginTimestamp === req.session.loginTimestamp // Add this condition
      ) {
        res.sendFile(
          path.join(
            __dirname,
            "public/pages/battlefield",
            "battlefield.html"
          )
        );
      } else {
        res.redirect("/auth");
      }
    } else {
      res.redirect("/auth");
    }
  } else {
    // Redirect to the login or another error page when referrer does not match
    res.redirect("/auth");
  }
});

app.get("/signout", async (req, res) => {
  const db = client.db("f-raps-db");
  const activeSessionsCollection = db.collection("ActiveSessions");

  await activeSessionsCollection.deleteOne({ sessionId: req.session.id });

  // Add this line - clear the session cookie
  res.clearCookie("connect.sid", { path: "/" });

  req.logout(() => {
    // Add this callback function
    req.session.loggedIn = false;
    req.session.destroy(); // Destroy the session
    res.redirect("/auth");
  });
});

app.post("/auth/login", (req, res, next) => {
  const db = client.db("f-raps-db");
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

    req.logIn(user, async (err) => {
      if (err) {
        console.log("Error during logIn:", err);
        return res.status(500).send("Server error");
      }

      console.log("Login successful");
      req.session.loggedIn = true;
      req.session.user = user;
      req.session.loginTimestamp = new Date().toISOString(); // Add this line

      res.cookie("fRapsUser", user.nickname);
      // Insert session information into ActiveSessions collection
      const activeSessionsCollection = db.collection("ActiveSessions");
      await activeSessionsCollection.insertOne({
        nickname: user.nickname,
        sessionId: req.session.id,
        loginTimestamp: req.session.loginTimestamp
      });

      return res.status(200).end();
    });
  })(req, res, next);
});

app.post(
  "/auth/signup",
  upload.single("profilePicture"),
  async (req, res, next) => {
    const { nickname, password } = req.body;
    const profilePicture = req.file ? req.file.buffer : null;
    const profilePictureBase64 = profilePicture
      ? profilePicture.toString("base64")
      : null;
    const db = client.db("f-raps-db");
    const usersCollection = db.collection("User");
    const activeSessionsCollection = db.collection("ActiveSessions");

    try {
      const existingUser = await usersCollection.findOne({ nickname });

      // Check if the user is already logged in before signing up
      const existingSession = await activeSessionsCollection.findOne({
        nickname,
      });

      if (existingSession) {
        return res.status(409).send("This user is already logged in");
      }

      if (existingUser) {
        res.status(409).send("Nickname already in use");
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCollection.insertOne({
          nickname,
          password: hashedPassword,
          profilePicture: profilePictureBase64,
          points: 0
        });

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
            res.cookie("fRapsUser", user.nickname);

            req.session.user = user;

            // Insert session information into ActiveSessions collection
            await activeSessionsCollection.insertOne({
              nickname: user.nickname,
              sessionId: req.session.id,
            });
            console.log("User authenticated:", user.nickname);
            return res.status(200).end();
          });
        })(req, res, next);
      }
    } catch (error) {
      console.error("Error in /auth/signup", error);
      res.status(500).send("Server error");
    }
  }
);
setupSocketEvents(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
