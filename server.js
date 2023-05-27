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

signalingEvents.on("userDisconnected", async (nickname) => {
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

passport.use(
  new LocalStrategy(
    { usernameField: "nickname", passwordField: "password" },
    async (nickname, password, done) => {
      const db = client.db("f-raps-db");
      const activeSessionsCollection = db.collection("ActiveSessions");

      const existingSession = await activeSessionsCollection.findOne({
        nickname,
      });
      if (existingSession) {
        return done(null, false, { message: "User already logged in" });
      }

      const usersCollection = db.collection("User");

      try {
        const user = await usersCollection.findOne({ nickname });
        if (user) {
          const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
          );

          if (isPasswordCorrect) {
            user.active = true;
            done(null, user);
          } else {
            done(null, false, { message: "Incorrect password" });
          }
        } else {
          done(null, false, { message: "User not found" });
        }
      } catch (error) {
        done(error);
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

app.use((req, res, next) => {
  if (
    req.header("x-forwarded-proto") !== "https" &&
    process.env.NODE_ENV === "production"
  ) {
    res.redirect(301, `https://${req.header("host")}${req.url}`);
  } else {
    next();
  }
});

const mongoStoreOptions = {
  uri: uri,
  collection: "sessions",
  clientPromise: client,
};

const sessionOptions = {
  secret: "your-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === "production" },
};

const store = new MongoDBStore(mongoStoreOptions);

store.on("error", function (error) {
  console.error("Session store error:", error);
});

sessionOptions.store = store;

const sessionMiddleware = session(sessionOptions);

app.use(sessionMiddleware);
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

app.get("/battlefield", redirectToAuthIfNotLoggedIn, async (req, res) => {
  if (req.isAuthenticated()) {
    const db = client.db("f-raps-db");
    const activeSessionsCollection = db.collection("ActiveSessions");

    const existingSession = await activeSessionsCollection.findOne({
      nickname: req.user.nickname,
    });
    if (existingSession && existingSession.sessionId !== req.session.id) {
      res.redirect("/auth");
    } else {
      res.sendFile(
        path.join(__dirname, "public/pages/battlefield", "battlefield.html")
      );
    }
  } else {
    res.redirect("/auth");
  }
});

app.get("/signout", async (req, res) => {
  const db = client.db("f-raps-db");
  const activeSessionsCollection = db.collection("ActiveSessions");

  await activeSessionsCollection.deleteOne({ sessionId: req.session.id });

  res.clearCookie("connect.sid", { path: "/" });

  req.logout(() => {
    req.session.loggedIn = false;
    req.session.destroy();
    res.redirect("/auth");
  });
});

app.post("/auth/login", (req, res, next) => {
  const db = client.db("f-raps-db");

  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return res.status(500).send("Server error");
    }
    if (!user) {
      if (info && info.message) {
        return res.status(401).send(info.message);
      } else {
        return res.status(401).send("Invalid nickname or password");
      }
    }

    req.logIn(user, async (err) => {
      if (err) {
        return res.status(500).send("Server error");
      }

      req.session.loggedIn = true;
      res.cookie("fRapsUser", user.nickname);
      req.session.user = user;

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
          res.cookie("fRapsUser", user.nickname);
          req.session.user = user;

          const activeSessionsCollection = db.collection("ActiveSessions");
          await activeSessionsCollection.insertOne({
            nickname: user.nickname,
            sessionId: req.session.id,
          });

          console.log("User authenticated:", user);
          console.log("Session:", req.session);
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