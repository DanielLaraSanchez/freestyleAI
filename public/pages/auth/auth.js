document.addEventListener('DOMContentLoaded', function () {
    // (async () => {
    //     try {
    //       const response = await fetch('/checkLoginStatus');
    //       if (response.ok) {
    //         const responseData = await response.json();
    //         if (responseData.loggedIn) {
    //           M.toast({ html: 'You are already logged in.' });
    //         }
    //       }
    //     } catch (error) {
    //       console.error('Error fetching auth status:', error);
    //     }
    //   })();
    // Initialize tabs
    M.Tabs.init(document.querySelectorAll('.tabs'));

    // Get the login and signup button elements
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');

    // Attach click event listeners
    loginBtn.addEventListener('click', async function () {
        if (document.cookie.indexOf("fRapsUser") !== -1) {
          document.cookie = 'fRapsUser=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          console.log("user already logged in")
          return;
          }
        const nickname = document.getElementById('login-nickname').value;
        const password = document.getElementById('login-password').value;
      
        if (nickname.trim() === '' || password.trim() === '') {
          M.toast({ html: 'Please enter a nickname and password.' });
          console.log("here")
          return;
        }
        console.log("here")

        try {
            console.log('Sending login request...'); // Add this line

          const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nickname, password })
          });
          console.log('Received login response:', response); // Add this line
          if (response.ok) {
            console.log("Redirecting to battlefield..."); // Add this line

            location.href = '/battlefield';
          } else {
            const errorMessage = await response.text();
            M.toast({ html: 'Error: ' + errorMessage });
          }
        } catch (error) {
            console.log(error)
          M.toast({ html: 'Error: ' + error.message });
        }
      });

      signupBtn.addEventListener('click', async function () {
        const nickname = document.getElementById('signup-nickname').value;
        const password = document.getElementById('signup-password').value;
        const profilePictureInput = document.getElementById('signup-profile-picture');
        const profilePictureFile = profilePictureInput.files[0];

        if (nickname.trim() === '' || password.trim() === '') {
          M.toast({ html: 'Please enter a nickname and password.' });
          return;
        }

        const formData = new FormData();
        formData.append('nickname', nickname);
        formData.append('password', password);
        formData.append('profilePicture', profilePictureFile);

        try {
          const response = await fetch('/auth/signup', {
            method: 'POST',
            body: formData
          });

          if (response.ok) {
            location.href = '/battlefield';
          } else {
            const errorMessage = await response.text();
            M.toast({ html: 'Error: ' + errorMessage });
          }
        } catch (error) {
          M.toast({ html: 'Error: ' + error.message });
        }
    });
});