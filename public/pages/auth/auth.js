document.addEventListener('DOMContentLoaded', function () {
    // Initialize tabs
    M.Tabs.init(document.querySelectorAll('.tabs'));

    // Get the login and signup button elements
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');

    // Attach click event listeners
    loginBtn.addEventListener('click', function () {
        const nickname = document.getElementById('login-nickname').value;
        const password = document.getElementById('login-password').value;

        if (nickname.trim() === '' || password.trim() === '') {
            M.toast({ html: 'Please enter a nickname and password.' });
            return;
        }

        // Send the request to the server
        const xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                // Redirect to the desired route
                window.location.href = '/battlefield';
            } else if (this.readyState === 4) {
                M.toast({ html: 'Error: ' + this.responseText });
            }
        };
        xhttp.open('POST', '/auth/login', true);
        xhttp.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
        xhttp.send(JSON.stringify({ nickname, password }));
    });

    signupBtn.addEventListener('click', function () {
        const nickname = document.getElementById('signup-nickname').value;
        const password = document.getElementById('signup-password').value;

        if (nickname.trim() === '' || password.trim() === '') {
            M.toast({ html: 'Please enter a nickname and password.' });
            return;
        }

        // Send the request to the server
        const xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
              // Parse the response JSON and get the redirect URL
              const response = JSON.parse(this.responseText);
              const redirectUrl = response.redirectUrl;
        
              // Redirect to the desired route
              window.location.href = redirectUrl;
            } else if (this.readyState === 4) {
              M.toast({ html: 'Error: ' + this.responseText });
            }
          };
        xhttp.open('POST', '/auth/signup', true);
        xhttp.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
        xhttp.send(JSON.stringify({ nickname, password }));
    });
});