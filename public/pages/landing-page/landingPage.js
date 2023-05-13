document.addEventListener("DOMContentLoaded", function () {
  const allLetters = document.querySelectorAll("#mainContent span");
  allLetters.forEach((letter) =>
    letter.addEventListener("mousemove", handleLetterMouseMove)
  );

  // Array of Spanish words
  const randomWords = [
    "RedBull",
    "BatalladeGallos",
    "hiphop",
    "freestyle",
    "beat",
    "flow",
    "cypher",
    "lyrics",
    "rap",
    "trap",
    "Eminem",
    "Tupac",
    "Biggie",
    "Nas",
    "JayZ",
    "KendrickLamar",
    "J.Cole",
    "Drake",
    "KanyeWest",
    "TravisScott",
    "LilWayne",
    "SnoopDogg",
    "IceCube",
    "50Cent",
    "NickiMinaj",
    "CardiB",
    "MFDOOM",
    "OutKast",
    "WuTangClan",
    "N.W.A",
    "A$APRocky",
    "LilUziVert",
    "Migos",
    "PostMalone",
    "Logic",
    "Dr.Dre",
    "ChanceTheRapper",
    "TylerTheCreator",
    "ChildishGambino",
    "RunDMC",
    "PublicEnemy",
    "BoneThugsNHarmony",
    "DMX",
    "LLCoolJ",
    "Rakim",
    "KRSOne",
    "MCShan",
    "SaltNPepa",
    "Nelly",
    "Ludacris",
    "BustaRhymes",
    "LaurynHill",
    "MissyElliott",
    "QueenLatifah",
    "DaBrat",
    "FoxyBrown",
    "LilKim",
    "RemyMa",
    "Trina",
    "Eve",
    "RoddyRicch",
    "DaBaby",
    "LilNasX",
    "MeganTheeStallion",
    "Saweetie",
    "DojaCat",
    "YBNCordae",
    "KotaTheFriend",
    "DenzelCurry",
    "JoeyBadass",
    "AesopRock",
    "TechN9ne",
    "RoyceDa59",
    "Atmosphere",
    "MosDef",
    "LupeFiasco",
    "GangStarr",
    "MobbDeep",
    "DeLaSoul",
    "EPMD",
    "CypressHill",
    "BeastieBoys",
    "DigitalUnderground",
    "ThePharcyde",
    "UGK",
    "Scarface",
    "GetoBoys",
    "BigPun",
    "FatJoe",
    "BigL",
    "Camron",
    "Dipset",
    "Mase",
    "PuffDaddy",
    "Guru",
    "DJPremier",
    "PeteRock",
    "CLSmooth",
    "EricBandRakim",
    "GrandmasterFlash",
    "AfrikaBambaataa",
    "KoolMoeDee",
    "BigDaddyKane",
    "Whodini",
    "SlickRick",
    "DougEFresh",
    "KoolGRap",
    "BoogieDownProductions",
    "UltramagneticMCs",
    "JungleBrothers",
    "SchoollyD",
    "Mantronix",
    "Stetsasonic",
    "JustIce",
    "MCShan",
    "MarleyMarl",
    "CraigG",
    "KoolG",
    "BizMarkie",
    "MCShyD",
    "TheDOC",
    "TooShort",
    "EazyE",
    "MCRen",
    "DJYella",
    "IceT",
    "DJQuik",
    "SirMixALot",
    "2LiveCrew",
    "AfroRican",
    "GucciMane",
    "TI",
    "YoungJeezy",
    "Future",
    "LilYachty",
    "LilPump",
    "LilXan",
    "KodakBlack",
    "21Savage",
    "YoungThug",
    "GHerbo",
    "LilBibby",
    "ChiefKeef",
    "LilDurk",
    "FBGDuck",
    "PoloG",
    "JuiceWRLD",
    "LilPeep",
    "XXXTentacion",
    "TrippieRedd",
    "6ix9ine",
    "Blueface",
    "NLEChoppa",
    "YNWBSlime",
    "QuandoRondo",
    "LilTjay",
    "KingVon",
    "PoloG",
    "TeeGrizzley",
    "SadaBaby",
    "42Dugg",
    "BigSean",
    "DannyBrown",
    "RoyceDa59",
    "Eminem",
    "D12",
    "Proof",
    "ObieTrice",
    "Bizarre",
    "Cashis",
    "Yelawolf",
    "Slaughterhouse",
    "JoeBudden",
    "LilDicky",
    "NF",
    "LaCokaNostra",
    "Prodigy",
    "AboveTheLaw",
    "ComptonsMostWanted",
    "TheD.O.C",
    "IceCube",
    "EazyE",
    "DrDre",
    "Metalhead",
    "VanillaIce",
    "DimensionX",
    "FootClan",
  ];

  const randomWordsList = [];
  const usedWords = [];

  function isOverlappingAny(newWord) {
    const newWordRect = newWord.getBoundingClientRect();

    for (const existingWord of randomWordsList) {
      const existingWordRect = existingWord.getBoundingClientRect();

      if (
        newWordRect.left < existingWordRect.right &&
        newWordRect.right > existingWordRect.left &&
        newWordRect.top < existingWordRect.bottom &&
        newWordRect.bottom > existingWordRect.top
      ) {
        return true;
      }
    }
    return false;
  }

  function generateRandomWord() {
    const word = document.createElement("span");

    // Add any used words back to the randomWords array
    if (usedWords.length > 0) {
      randomWords.push(...usedWords);
      usedWords.length = 0;
    }

    const randomIndex = Math.floor(Math.random() * randomWords.length);
    word.innerText = randomWords[randomIndex];

    // Remove the chosen word from the array to avoid duplicates
    usedWords.push(...randomWords.splice(randomIndex, 1));

    // Set random font-size
    const fontSize = Math.floor(Math.random() * 10) + 16;
    word.style.fontSize = `${fontSize}px`;

    const edgeMargin = 100;
    const sentenceMargin = 50;

    let xPos, yPos;
    let validPosition = false;

    // Add the word to the DOM with hidden visibility
    word.style.visibility = "hidden";
    document.body.appendChild(word);

    while (!validPosition) {
      xPos = Math.random() * (window.innerWidth - 2 * edgeMargin) + edgeMargin;
      yPos = Math.random() * (window.innerHeight - 2 * edgeMargin) + edgeMargin;

      word.style.position = "absolute";
      word.style.left = `${xPos}px`;
      word.style.top = `${yPos}px`;

      const sentence1Rect = document
        .getElementById("parallaxText")
        .getBoundingClientRect();
      const sentence2Rect = document
        .getElementById("parallaxText2")
        .getBoundingClientRect();

      if (
        (xPos < sentence1Rect.left - sentenceMargin ||
          xPos > sentence1Rect.right + sentenceMargin ||
          yPos < sentence1Rect.top - sentenceMargin ||
          yPos > sentence1Rect.bottom + sentenceMargin) &&
        (xPos < sentence2Rect.left - sentenceMargin ||
          xPos > sentence2Rect.right + sentenceMargin ||
          yPos < sentence2Rect.top - sentenceMargin ||
          yPos > sentence2Rect.bottom + sentenceMargin) &&
        !isOverlappingAny(word)
      ) {
        validPosition = true;
      }
    }

    // Make the word visible
    word.style.visibility = "visible";

    return word;
  }

  let lastHoveredLetter = null;

  function handleLetterMouseMove(e) {
    const letter = e.target;

    if (letter === lastHoveredLetter) {
      // Do not add a new word if the mouse is still over the same letter
      return;
    }

    lastHoveredLetter = letter;

    const scaleFactor = 0.3;
    letter.style.transform = `scale(${1 + scaleFactor})`;

    // Add random word to the page
    const randomWord = generateRandomWord();
    randomWordsList.push(randomWord);

    // Remove the random word after a longer duration
    setTimeout(() => {
      randomWord.remove();
      randomWordsList.shift();
    }, 2000); // Increased duration to 2000ms (2 seconds)
  }

  document.addEventListener("mousemove", (e) => {
    if (e.target.id === "three-container") return;
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    allLetters.forEach((letter) => {
      const letterRect = letter.getBoundingClientRect();

      if (
        mouseX >= letterRect.left &&
        mouseX <= letterRect.right &&
        mouseY >= letterRect.top &&
        mouseY <= letterRect.bottom
      ) {
        const scaleFactor = 0.3;
        letter.style.transform = `scale(${1 + scaleFactor})`;
      } else {
        letter.style.transform = `scale(1)`;
      }
    });
  });

  document.getElementById("loginBtn").addEventListener("click", function () {
    window.location.href = "/auth";
  });

  document.getElementById("signupBtn").addEventListener("click", function () {
    window.location.href = "/auth";
  });

});
