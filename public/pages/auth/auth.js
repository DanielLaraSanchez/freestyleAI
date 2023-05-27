document.addEventListener("DOMContentLoaded", function () {

  M.Tabs.init(document.querySelectorAll(".tabs"));

  function getCookie(cookieName) {
    const name = cookieName + "=";
    const decodedCookies = decodeURIComponent(document.cookie);
    const cookies = decodedCookies.split(";");
    for (let i = 0; i < cookies.length; i++) {
      let c = cookies[i];
      while (c.charAt(0) == " ") {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
  }

  // Get the login and signup button elements
  const loginBtn = document.getElementById("login-btn");
  const signupBtn = document.getElementById("signup-btn");

  loginBtn.addEventListener("click", async function () {
    const nickname = document.getElementById("login-nickname").value;
    const password = document.getElementById("login-password").value;
   // Call the new API endpoint to check if the user is already logged in
   const checkResponse = await fetch(`/auth/check-nickname/${nickname}`);
   const checkResult = await checkResponse.json();
 
   if (checkResult.isLoggedIn) {
     console.log("user already logged in");
     M.toast({ html: "user already logged in" });
     return;
   }


    if (nickname.trim() === "" || password.trim() === "") {
      M.toast({ html: "Please enter a nickname and password." });
      console.log("here");
      return;
    }
    console.log("here");

    try {
      console.log("Sending login request..."); // Add this line

      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nickname, password }),
      });
      console.log("Received login response:", response); // Add this line
      if (response.ok) {
        console.log("Redirecting to battlefield..."); // Add this line

        location.href = "/battlefield";
      } else {
        const errorMessage = await response.text();
        M.toast({ html: "Error: " + errorMessage });
      }
    } catch (error) {
      console.log(error);
      M.toast({ html: "Error: " + error.message });
    }
  });

  signupBtn.addEventListener("click", async function () {
    const nickname = document.getElementById("signup-nickname").value;
    const password = document.getElementById("signup-password").value;
    const profilePictureInput = document.getElementById(
      "signup-profile-picture"
    );
    const profilePictureFile = profilePictureInput.files[0];

    if (nickname.trim() === "" || password.trim() === "") {
      M.toast({ html: "Please enter a nickname and password." });
      return;
    }

    const formData = new FormData();
    formData.append("nickname", nickname);
    formData.append("password", password);
    formData.append("profilePicture", profilePictureFile);

    try {
      const response = await fetch("/auth/signup", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        location.href = "/battlefield";
      } else {
        const errorMessage = await response.text();
        M.toast({ html: "Error: " + errorMessage });
      }
    } catch (error) {
      M.toast({ html: "Error: " + error.message });
    }
  });
});
